/**
 * GitHub Trending scraper.
 *
 * Fetches trending repositories from github.com/trending by parsing
 * the server-rendered HTML. GitHub Trending has no public API but
 * the HTML structure is stable enough for regex-based extraction.
 *
 * Sources:
 * - github.com/trending?since=daily (today's trending repos)
 * - github.com/trending?since=weekly (this week's trending repos)
 *
 * HTML structure (as of 2026):
 * - Each repo is an <article class="Box-row">
 * - Repo name in <h2 class="..."><a href="/owner/repo">
 * - Description in <p class="col-9 color-fg-muted my-1 pr-4">
 * - Language in <span itemprop="programmingLanguage">
 * - Stars today in last <span class="d-inline-block float-sm-right">
 *
 * Non-blocking: returns {processed: 0, errors: 0} on fatal errors.
 *
 * @module github-trending-scraper
 */

import { fetchWithRetry } from '../lib/fetch-with-retry';
import { normalizeTrendingRepo, type TrendingRepo } from './normalizers/github-trending-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

const TRENDING_URLS = [
  'https://github.com/trending?since=daily',
  'https://github.com/trending?since=weekly',
];

/**
 * Parse an integer from a string, returning 0 if parsing fails.
 * Handles comma-formatted numbers like "1,234".
 */
function parseStarCount(raw: string): number {
  const cleaned = raw.replace(/,/g, '').replace(/\s+/g, '').trim();
  const parsed = parseInt(cleaned, 10);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Extract trending repos from GitHub Trending HTML.
 *
 * Strategy: split on Box-row class markers, parse each chunk individually.
 * This avoids multi-line regex complexity and is more robust to HTML changes.
 *
 * @param html - Raw HTML from github.com/trending
 * @returns Array of extracted repo data
 */
function extractTrendingRepos(html: string): TrendingRepo[] {
  const repos: TrendingRepo[] = [];
  const seen = new Set<string>();

  // Split HTML on article boundaries (each repo is an <article class="Box-row">)
  // GitHub uses various class combinations; split on the common anchor
  const chunks = html.split(/(?=<article\s[^>]*class="[^"]*Box-row[^"]*")/);

  for (const chunk of chunks) {
    // Must contain a repo link
    const repoMatch = chunk.match(/href="\/([a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+)"/);
    if (!repoMatch) continue;

    const repoFullName = repoMatch[1];

    // Skip duplicates (same URL may appear in daily + weekly)
    if (seen.has(repoFullName)) continue;

    // Filter out non-repo links (GitHub UI links, topic links, etc.)
    if (repoFullName.includes('/trending') || repoFullName.startsWith('trending')) continue;
    // Reject paths with more than one slash (e.g. /owner/repo/blob/...)
    if (repoFullName.split('/').length > 2) continue;

    seen.add(repoFullName);

    // Extract description — inside a <p> tag within the article
    let description = '';
    const descMatch = chunk.match(/<p\s[^>]*>\s*([\s\S]*?)\s*<\/p>/);
    if (descMatch) {
      // Strip any HTML tags from description content
      description = descMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Extract programming language
    let language: string | null = null;
    const langMatch = chunk.match(/itemprop="programmingLanguage">\s*([^<]+)\s*</);
    if (langMatch) {
      language = langMatch[1].trim();
    }

    // Extract total star count — link containing "/stargazers"
    let stars = 0;
    const starsMatch = chunk.match(/href="\/[^"]+\/stargazers[^"]*"[^>]*>\s*[\s\S]*?([0-9][0-9,]*)\s*<\/a>/);
    if (starsMatch) {
      stars = parseStarCount(starsMatch[1]);
    }

    // Extract stars today/this week — last stat span
    let starsToday = 0;
    const starsTodayMatch = chunk.match(/([0-9][0-9,]*)\s+stars\s+(?:today|this week)/i);
    if (starsTodayMatch) {
      starsToday = parseStarCount(starsTodayMatch[1]);
    }

    repos.push({
      repoFullName,
      description,
      language,
      stars,
      starsToday,
      url: `https://github.com/${repoFullName}`,
    });
  }

  return repos;
}

/**
 * Scrape GitHub Trending pages and upsert repos into catalog.
 *
 * @param maxResults - Maximum number of repos to process across all pages (default 50)
 * @returns Object with processed count and error count
 */
export async function scrapeGitHubTrending(
  maxResults = 50
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    for (const trendingUrl of TRENDING_URLS) {
      if (processed + errors >= maxResults) break;

      console.log(`[github-trending-scraper] Fetching ${trendingUrl}...`);

      let response: Response;
      try {
        response = await fetchWithRetry(
          trendingUrl,
          {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
          },
          { maxAttempts: 3, baseDelay: 1000, timeout: 20000 }
        );
      } catch (fetchErr) {
        console.warn(`[github-trending-scraper] Failed to fetch ${trendingUrl}: ${fetchErr}`);
        continue;
      }

      if (!response.ok) {
        console.warn(`[github-trending-scraper] Got ${response.status} from ${trendingUrl} — skipping`);
        continue;
      }

      const html = await response.text();
      const repos = extractTrendingRepos(html);

      console.log(`[github-trending-scraper] Found ${repos.length} repos from ${trendingUrl}`);

      for (const repo of repos) {
        if (processed + errors >= maxResults) break;

        try {
          const entry = normalizeTrendingRepo(repo);
          await upsertBySourceUrl(entry);
          processed++;
        } catch (err) {
          console.error(`[github-trending-scraper] Failed: ${repo.repoFullName}: ${err}`);
          errors++;
        }
      }
    }

    console.log(`[github-trending-scraper] ${processed} processed, ${errors} errors`);
  } catch (err) {
    // Non-blocking fatal error — log and return zeros
    console.error(`[github-trending-scraper] Fatal error: ${err}`);
    return { processed: 0, errors: 0 };
  }

  return { processed, errors };
}
