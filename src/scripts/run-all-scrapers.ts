/**
 * Run-all-scrapers orchestrator.
 *
 * Runs all 5 catalog scraper sources sequentially:
 * 1. GitHub (by topic)
 * 2. npm (by keyword)
 * 3. HuggingFace (by tag)
 * 4. GitHub Trending (daily + weekly pages)
 * 5. Product Hunt (AI + Developer Tools topic pages)
 *
 * Each source is run directly (not via bunqueue workers) so this script
 * can be called from the command line without a running worker process.
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/scripts/run-all-scrapers.ts
 *
 * Via package.json:
 *   bun run scrape:all        # local dev.db
 *   bun run scrape:all:prod   # production (requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
 */

import { scrapeGitHub } from '../scrapers/github-scraper';
import { scrapeNpm } from '../scrapers/npm-scraper';
import { scrapeHuggingFace } from '../scrapers/huggingface-scraper';
import { scrapeGitHubTrending } from '../scrapers/github-trending-scraper';
import { scrapeProductHunt } from '../scrapers/producthunt-scraper';

const START_TIME = Date.now();

function elapsed(): string {
  return `${((Date.now() - START_TIME) / 1000).toFixed(1)}s`;
}

async function main() {
  console.log('=== AI Bazaar: Run All Scrapers ===\n');

  const totals = {
    processed: 0,
    errors: 0,
  };

  // 1. GitHub topic scrapes
  console.log('--- 1. GitHub Topic Scraper ---');
  const githubTopics = [
    'mcp-server',
    'ai-agent',
    'model-context-protocol',
    'web3',
    'defi',
  ];
  let githubProcessed = 0;
  let githubErrors = 0;
  const githubStart = Date.now();
  for (const topic of githubTopics) {
    try {
      const result = await scrapeGitHub(topic, 100);
      githubProcessed += result.processed;
      githubErrors += result.errors;
    } catch (err) {
      console.error(`[run-all] GitHub topic=${topic} failed: ${err}`);
      githubErrors++;
    }
  }
  const githubDuration = ((Date.now() - githubStart) / 1000).toFixed(1);
  console.log(`GitHub: ${githubProcessed} processed, ${githubErrors} errors in ${githubDuration}s\n`);
  totals.processed += githubProcessed;
  totals.errors += githubErrors;

  // 2. npm keyword scrapes
  console.log('--- 2. npm Keyword Scraper ---');
  const npmKeywords = ['mcp', 'ai-agent', 'web3', 'agent-framework', 'defi'];
  let npmProcessed = 0;
  let npmErrors = 0;
  const npmStart = Date.now();
  for (const keyword of npmKeywords) {
    try {
      const result = await scrapeNpm(keyword, 100);
      npmProcessed += result.processed;
      npmErrors += result.errors;
    } catch (err) {
      console.error(`[run-all] npm keyword=${keyword} failed: ${err}`);
      npmErrors++;
    }
  }
  const npmDuration = ((Date.now() - npmStart) / 1000).toFixed(1);
  console.log(`npm: ${npmProcessed} processed, ${npmErrors} errors in ${npmDuration}s\n`);
  totals.processed += npmProcessed;
  totals.errors += npmErrors;

  // 3. HuggingFace tag scrapes
  console.log('--- 3. HuggingFace Tag Scraper ---');
  const hfTags = ['agent', 'web3', 'mcp'];
  let hfProcessed = 0;
  let hfErrors = 0;
  const hfStart = Date.now();
  for (const tag of hfTags) {
    try {
      const result = await scrapeHuggingFace(tag, 100);
      hfProcessed += result.processed;
      hfErrors += result.errors;
    } catch (err) {
      console.error(`[run-all] HuggingFace tag=${tag} failed: ${err}`);
      hfErrors++;
    }
  }
  const hfDuration = ((Date.now() - hfStart) / 1000).toFixed(1);
  console.log(`HuggingFace: ${hfProcessed} processed, ${hfErrors} errors in ${hfDuration}s\n`);
  totals.processed += hfProcessed;
  totals.errors += hfErrors;

  // 4. GitHub Trending
  console.log('--- 4. GitHub Trending Scraper ---');
  const trendingStart = Date.now();
  let trendingResult = { processed: 0, errors: 0 };
  try {
    trendingResult = await scrapeGitHubTrending(50);
  } catch (err) {
    console.error(`[run-all] GitHub Trending failed: ${err}`);
  }
  const trendingDuration = ((Date.now() - trendingStart) / 1000).toFixed(1);
  console.log(`GitHub Trending: ${trendingResult.processed} processed, ${trendingResult.errors} errors in ${trendingDuration}s\n`);
  totals.processed += trendingResult.processed;
  totals.errors += trendingResult.errors;

  // 5. Product Hunt
  console.log('--- 5. Product Hunt Scraper ---');
  const phStart = Date.now();
  let phResult = { processed: 0, errors: 0 };
  try {
    phResult = await scrapeProductHunt(100);
  } catch (err) {
    console.error(`[run-all] Product Hunt failed: ${err}`);
  }
  const phDuration = ((Date.now() - phStart) / 1000).toFixed(1);
  console.log(`Product Hunt: ${phResult.processed} processed, ${phResult.errors} errors in ${phDuration}s\n`);
  totals.processed += phResult.processed;
  totals.errors += phResult.errors;

  // Summary
  console.log('=== Run Complete ===');
  console.log(`Total processed: ${totals.processed}`);
  console.log(`Total errors:    ${totals.errors}`);
  console.log(`Total time:      ${elapsed()}`);
}

main().catch((err) => {
  console.error('[run-all] Fatal error:', err);
  process.exit(1);
});
