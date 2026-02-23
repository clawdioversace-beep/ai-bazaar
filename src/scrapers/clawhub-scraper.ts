/**
 * ClawHub.ai scraper.
 *
 * Fetches OpenClaw skills from the ClawHub.ai public search API:
 *   GET https://clawhub.ai/api/search?q=<term>&limit=N&offset=N
 *
 * Returns JSON: { results: [{ score, slug, displayName, summary, version, updatedAt }] }
 *
 * Strategy: The endpoint requires a search query (blank/wildcard returns nothing).
 * We run a curated list of high-coverage query terms covering the most commonly
 * created skill categories, paginate each query, and deduplicate by slug so no
 * skill is inserted twice across queries.
 */

import { normalizeClawHubResult, type ClawHubResult } from './normalizers/clawhub-normalizer';
import { upsertSkillBySourceUrl } from '../services/skills';

const CLAWHUB_API = 'https://clawhub.ai/api/search';
const PAGE_SIZE = 25;
const REQUEST_DELAY_MS = 250; // Polite delay between requests

/**
 * Curated query list targeting the most commonly created OpenClaw skill types.
 *
 * Ordered by estimated frequency on the marketplace (highest coverage first).
 * Vector search is semantic, so these phrases capture related skills too.
 * Together, these 32 queries should surface the vast majority of ClawHub's
 * ~3,286 verified skills across all categories.
 *
 * Categories covered:
 *   Browser/Web     → browser, web scraping, playwright, screenshot
 *   Research        → web search, research assistant, reddit, news, wikipedia
 *   Coding          → github, code review, git, typescript, test runner, debugging
 *   Communication   → email, slack, telegram, discord, notion, calendar
 *   Media/Content   → image generation, twitter post, video, voice, pdf
 *   Automation      → workflow automation, schedule task, webhook, monitor, notify
 *   Data/APIs       → api integration, database query, csv, file manager
 *   AI/LLM          → claude, openai, groq, vector embeddings, summarize
 *   Finance/Web3    → crypto price, ethereum, defi, wallet, polymarket
 */
export const CLAWHUB_QUERIES = [
  // Browser & Web (highest volume — every agent needs web access)
  'browser automation',
  'web scraping',
  'playwright browser',
  'screenshot capture',

  // Research & Information Retrieval
  'web search',
  'research assistant',
  'reddit search',
  'news aggregator',
  'wikipedia lookup',

  // Coding & Development
  'github integration',
  'code review',
  'git operations',
  'run tests',
  'code debugging',

  // Communication & Productivity
  'send email',
  'slack message',
  'telegram bot',
  'discord integration',
  'notion database',
  'calendar events',

  // Media & Content Creation
  'image generation',
  'post to twitter',
  'video processing',
  'voice transcription',
  'pdf reader',

  // Automation & Monitoring
  'workflow automation',
  'schedule task',
  'webhook trigger',
  'system monitor',
  'send notification',

  // Data & APIs
  'api request',
  'database query',
  'csv file',
  'file manager',

  // AI & LLM Tools
  'vector search',
  'text summarizer',
  'openai assistant',

  // Finance & Web3
  'crypto price',
  'ethereum blockchain',
  'defi protocol',
  'prediction market',
];

/**
 * Fetch one page of skills for a given query.
 */
async function fetchPage(query: string, offset: number): Promise<ClawHubResult[]> {
  const url = `${CLAWHUB_API}?q=${encodeURIComponent(query)}&limit=${PAGE_SIZE}&offset=${offset}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data = await response.json() as { results?: ClawHubResult[] };
    return data.results ?? [];
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Scrape all skills for a single query, paginating until exhausted.
 *
 * @param query - Search term to query
 * @param seenSlugs - Set of slugs already processed (for cross-query dedup)
 * @param maxPerQuery - Max results to process per query (default 100)
 * @returns Object with processed and error counts for this query
 */
async function scrapeQuery(
  query: string,
  seenSlugs: Set<string>,
  maxPerQuery = 100,
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;
  let offset = 0;

  while (processed + errors < maxPerQuery) {
    let page: ClawHubResult[];

    try {
      page = await fetchPage(query, offset);
    } catch (err) {
      console.error(`[clawhub-scraper] Fetch failed q="${query}" offset=${offset}: ${err}`);
      errors++;
      break;
    }

    if (page.length === 0) break;

    for (const result of page) {
      if (processed + errors >= maxPerQuery) break;

      // Skip slugs we've already processed from a previous query
      if (seenSlugs.has(result.slug)) continue;
      seenSlugs.add(result.slug);

      try {
        const entry = normalizeClawHubResult(result);
        await upsertSkillBySourceUrl(entry);
        processed++;
      } catch (err) {
        console.error(`[clawhub-scraper] Upsert failed "${result.displayName}": ${err}`);
        errors++;
      }
    }

    offset += PAGE_SIZE;

    if (page.length === PAGE_SIZE && processed + errors < maxPerQuery) {
      await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
    }
  }

  return { processed, errors };
}

/**
 * Scrape OpenClaw skills from ClawHub.ai using a curated query list.
 *
 * Runs each query in CLAWHUB_QUERIES sequentially, deduplicating results
 * by ClawHub slug across queries. Skills already in the DB are upserted
 * (idempotent — safe to re-run).
 *
 * @param maxPerQuery - Max results per query term (default 100)
 * @returns Object with total processed and error counts
 */
export async function scrapeClawHub(
  maxPerQuery = 100
): Promise<{ processed: number; errors: number }> {
  let totalProcessed = 0;
  let totalErrors = 0;
  const seenSlugs = new Set<string>();

  console.log(`[clawhub-scraper] Starting: ${CLAWHUB_QUERIES.length} queries, maxPerQuery=${maxPerQuery}`);

  for (const query of CLAWHUB_QUERIES) {
    const { processed, errors } = await scrapeQuery(query, seenSlugs, maxPerQuery);
    totalProcessed += processed;
    totalErrors += errors;

    if (processed > 0 || errors > 0) {
      console.log(`[clawhub-scraper] q="${query}": +${processed} skills (${errors} errors) — total=${totalProcessed}`);
    } else {
      console.log(`[clawhub-scraper] q="${query}": no results`);
    }

    // Brief pause between query terms
    await new Promise((r) => setTimeout(r, REQUEST_DELAY_MS));
  }

  console.log(`[clawhub-scraper] Done. total processed=${totalProcessed}, errors=${totalErrors}`);
  return { processed: totalProcessed, errors: totalErrors };
}
