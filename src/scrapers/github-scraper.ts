/**
 * GitHub repository scraper.
 *
 * Fetches repositories by topic using the GitHub Search API via Octokit,
 * normalizes each repo through github-normalizer, and upserts into the
 * catalog via CatalogService.
 *
 * Rate limiting:
 * - Authenticated: 5000 requests/hour (requires GITHUB_TOKEN env var)
 * - Unauthenticated: 60 requests/hour
 * - Octokit handles automatic throttling and retry-after headers
 *
 * @module github-scraper
 */

import { Octokit } from 'octokit';
import { normalizeGitHubRepo } from './normalizers/github-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

/**
 * Scrape GitHub repositories by topic and upsert into catalog.
 *
 * @param topic - GitHub topic to search for (e.g. 'mcp-server', 'ai-agent')
 * @param maxResults - Maximum number of repos to process (default 500)
 * @returns Object with processed count and error count
 */
export async function scrapeGitHub(
  topic: string,
  maxResults = 500
): Promise<{ processed: number; errors: number }> {
  // Initialize Octokit with token if available
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    console.warn(
      '[github-scraper] GITHUB_TOKEN not set — using unauthenticated mode (60 req/hour limit). ' +
      'Set GITHUB_TOKEN for 5000 req/hour.'
    );
  }

  const octokit = new Octokit({ auth: token });

  let processed = 0;
  let errors = 0;

  try {
    // Use paginate.iterator for automatic pagination handling
    const iterator = octokit.paginate.iterator(
      octokit.rest.search.repos,
      {
        q: `topic:${topic}`,
        sort: 'stars',
        order: 'desc',
        per_page: 100,
      }
    );

    // Iterate through pages
    for await (const { data: repos } of iterator) {
      for (const repo of repos) {
        // Stop if we've hit the max results cap
        if (processed + errors >= maxResults) {
          console.log(`[github-scraper] topic=${topic}: Reached maxResults cap (${maxResults})`);
          break;
        }

        try {
          // Normalize repo data to CatalogEntryInput
          const entry = normalizeGitHubRepo(repo);

          // Upsert into catalog (creates new or updates existing)
          await upsertBySourceUrl(entry);

          processed++;
        } catch (err) {
          console.error(`[github-scraper] Failed: ${repo.full_name}: ${err}`);
          errors++;
        }
      }

      // Break out of pagination loop if we've hit the cap
      if (processed + errors >= maxResults) {
        break;
      }
    }

    console.log(`[github-scraper] topic=${topic}: ${processed} processed, ${errors} errors`);
  } catch (err) {
    console.error(`[github-scraper] Fatal error for topic=${topic}: ${err}`);
    throw err;
  }

  return { processed, errors };
}
