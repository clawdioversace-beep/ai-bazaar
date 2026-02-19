/**
 * npm registry scraper.
 *
 * Fetches packages by keyword using the npm registry search API,
 * normalizes each package through npm-normalizer, and upserts into
 * the catalog via CatalogService.
 *
 * Rate limiting:
 * - npm registry has no documented rate limits for search API
 * - Uses fetchWithRetry for resilience against transient failures
 *
 * Search limitations:
 * - npm search API caps at 250 results per query (Pitfall 2 from research)
 * - To get more coverage, run multiple queries with different keywords
 *
 * @module npm-scraper
 */

import { fetchWithRetry } from '../lib/fetch-with-retry';
import { normalizeNpmPackage } from './normalizers/npm-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

/**
 * Scrape npm packages by keyword and upsert into catalog.
 *
 * @param keyword - npm keyword to search for (e.g. 'mcp', 'ai-agent')
 * @param maxResults - Maximum number of packages to process (default 250, which is also the npm API cap)
 * @returns Object with processed count and error count
 */
export async function scrapeNpm(
  keyword: string,
  maxResults = 250
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Construct npm search API URL
    const url = `https://registry.npmjs.org/-/v1/search?text=keywords:${encodeURIComponent(keyword)}&size=${maxResults}&from=0`;

    // Fetch with retry handling
    const response = await fetchWithRetry(url, {}, {
      maxAttempts: 3,
      baseDelay: 1000,
      timeout: 15000,
    });

    // Check response status
    if (!response.ok) {
      throw new Error(`npm search API returned ${response.status} ${response.statusText}`);
    }

    // Parse response JSON
    const data = await response.json();

    // Validate response structure
    if (!data.objects || !Array.isArray(data.objects)) {
      throw new Error('npm search API response missing "objects" array');
    }

    // Handle empty results (valid case — no packages match)
    if (data.objects.length === 0) {
      console.log(`[npm-scraper] keyword=${keyword}: No packages found`);
      return { processed: 0, errors: 0 };
    }

    // Process each package
    for (const item of data.objects) {
      if (!item.package) {
        console.warn('[npm-scraper] Skipping item with missing "package" field');
        errors++;
        continue;
      }

      try {
        // Normalize package data to CatalogEntryInput
        const entry = normalizeNpmPackage(item.package);

        // Upsert into catalog (creates new or updates existing)
        await upsertBySourceUrl(entry);

        processed++;
      } catch (err) {
        console.error(`[npm-scraper] Failed: ${item.package?.name || 'unknown'}: ${err}`);
        errors++;
      }
    }

    console.log(`[npm-scraper] keyword=${keyword}: ${processed} processed, ${errors} errors`);
  } catch (err) {
    console.error(`[npm-scraper] Fatal error for keyword=${keyword}: ${err}`);
    throw err;
  }

  return { processed, errors };
}
