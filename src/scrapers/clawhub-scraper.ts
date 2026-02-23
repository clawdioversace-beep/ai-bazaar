/**
 * ClawHub.ai scraper.
 *
 * Fetches OpenClaw skills from the ClawHub.ai public search API:
 *   GET https://clawhub.ai/api/search?limit=N&offset=N
 *
 * Returns JSON: { results: [{ score, slug, displayName, summary, version, updatedAt }] }
 *
 * Pagination: offset-based (limit=25, increment offset until results is empty).
 * No auth required. No rate limiting observed.
 */

import { normalizeClawHubResult, type ClawHubResult } from './normalizers/clawhub-normalizer';
import { upsertSkillBySourceUrl } from '../services/skills';

const CLAWHUB_API = 'https://clawhub.ai/api/search';
const BATCH_SIZE = 25;
const REQUEST_DELAY_MS = 200; // Polite delay between requests

/**
 * Fetch one page of skills from ClawHub API.
 *
 * The /api/search endpoint requires a query parameter — using a space character
 * as a wildcard to retrieve all skills in pagination order.
 */
async function fetchPage(offset: number): Promise<ClawHubResult[]> {
  // A single space acts as a broad match for the vector search endpoint
  const url = `${CLAWHUB_API}?q=${encodeURIComponent(' ')}&limit=${BATCH_SIZE}&offset=${offset}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    const data = await response.json() as { results?: ClawHubResult[] };
    return data.results ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrape OpenClaw skills from ClawHub.ai.
 *
 * Paginates through results using offset parameter.
 * Stops when API returns an empty page or maxResults is reached.
 *
 * @param maxResults - Maximum skills to process (default 500)
 * @returns Object with processed and error counts
 */
export async function scrapeClawHub(
  maxResults = 500
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  let offset = 0;

  console.log(`[clawhub-scraper] Starting: maxResults=${maxResults}`);

  while (processed + errors < maxResults) {
    let page: ClawHubResult[];

    try {
      page = await fetchPage(offset);
    } catch (err) {
      console.error(`[clawhub-scraper] Page fetch failed at offset=${offset}: ${err}`);
      errors++;
      break;
    }

    if (page.length === 0) {
      console.log(`[clawhub-scraper] Empty page at offset=${offset} — done.`);
      break;
    }

    for (const result of page) {
      if (processed + errors >= maxResults) break;

      try {
        const entry = normalizeClawHubResult(result);
        await upsertSkillBySourceUrl(entry);
        processed++;
      } catch (err) {
        console.error(`[clawhub-scraper] Failed to upsert skill "${result.displayName}": ${err}`);
        errors++;
      }
    }

    console.log(`[clawhub-scraper] offset=${offset} — batch done. processed=${processed}, errors=${errors}`);
    offset += BATCH_SIZE;

    // Polite delay between pages
    if (page.length === BATCH_SIZE && processed + errors < maxResults) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  console.log(`[clawhub-scraper] Done. processed=${processed}, errors=${errors}`);
  return { processed, errors };
}
