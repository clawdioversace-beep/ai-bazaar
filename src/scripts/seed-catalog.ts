/**
 * Catalog pre-seed script.
 *
 * Runs all scrapers with predefined topics/keywords to pre-populate the
 * catalog with 200+ entries across 5+ categories.
 *
 * This is the PRIMARY deliverable of Phase 2 — it proves end-to-end
 * scraping functionality and satisfies the success criteria:
 * - 200+ catalog entries after seed run
 * - 5+ categories with at least 1 entry each
 * - Idempotent: re-running does not create duplicates
 *
 * Usage:
 *   bun run seed       # Local dev (file:./dev.db)
 *   bun run seed:prod  # Production (requires TURSO_DATABASE_URL env var)
 */

import { scrapeGitHub } from '../scrapers/github-scraper';
import { scrapeNpm } from '../scrapers/npm-scraper';
import { scrapeHuggingFace } from '../scrapers/huggingface-scraper';
import { rebuildFtsIndex } from '../services/search';
import { countByCategory } from '../services/search';

interface SeedStats {
  github: { processed: number; errors: number };
  npm: { processed: number; errors: number };
  huggingface: { processed: number; errors: number };
}

async function main() {
  console.log('=== AI Bazaar Catalog Seed ===\n');

  const startTime = Date.now();
  const stats: SeedStats = {
    github: { processed: 0, errors: 0 },
    npm: { processed: 0, errors: 0 },
    huggingface: { processed: 0, errors: 0 },
  };

  // GitHub topics (6 searches designed to hit all 6 categories)
  console.log('[seed] Running GitHub scrapers...');
  const githubTopics = ['mcp-server', 'ai-agent', 'model-context-protocol', 'web3', 'defi', 'kubernetes'];

  for (const topic of githubTopics) {
    try {
      const result = await scrapeGitHub(topic, 300);
      stats.github.processed += result.processed;
      stats.github.errors += result.errors;
    } catch (err) {
      console.error(`[seed] GitHub scrape failed for topic=${topic}:`, err);
      stats.github.errors++;
    }
  }

  // npm keywords (6 searches designed to hit all 6 categories)
  console.log('\n[seed] Running npm scrapers...');
  const npmKeywords = ['mcp', 'ai-agent', 'web3', 'agent-framework', 'defi', 'docker'];

  for (const keyword of npmKeywords) {
    try {
      const result = await scrapeNpm(keyword, 250);
      stats.npm.processed += result.processed;
      stats.npm.errors += result.errors;
    } catch (err) {
      console.error(`[seed] npm scrape failed for keyword=${keyword}:`, err);
      stats.npm.errors++;
    }
  }

  // HuggingFace tags (3 searches, expect ~30-100 per tag)
  console.log('\n[seed] Running HuggingFace scrapers...');
  const hfTags = ['agent', 'web3', 'mcp'];

  for (const tag of hfTags) {
    try {
      const result = await scrapeHuggingFace(tag, 200);
      stats.huggingface.processed += result.processed;
      stats.huggingface.errors += result.errors;
    } catch (err) {
      console.error(`[seed] HuggingFace scrape failed for tag=${tag}:`, err);
      stats.huggingface.errors++;
    }
  }

  // Rebuild FTS5 index after bulk inserts
  console.log('\n[seed] Rebuilding FTS5 index...');
  await rebuildFtsIndex();

  // Get final counts
  const categoryCounts = await countByCategory();
  const totalEntries = categoryCounts.reduce((sum, c) => sum + c.count, 0);
  const uniqueCategories = categoryCounts.filter(c => c.count > 0).length;

  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);

  console.log('\n=== Seed Complete ===');
  console.log(`GitHub: ${stats.github.processed} processed, ${stats.github.errors} errors`);
  console.log(`npm: ${stats.npm.processed} processed, ${stats.npm.errors} errors`);
  console.log(`HuggingFace: ${stats.huggingface.processed} processed, ${stats.huggingface.errors} errors`);
  console.log(`\nTotal catalog entries: ${totalEntries}`);
  console.log(`Categories with entries: ${uniqueCategories}`);
  console.log(`Duration: ${duration}s`);

  console.log('\nCategory breakdown:');
  for (const cat of categoryCounts) {
    if (cat.count > 0) {
      console.log(`  ${cat.category}: ${cat.count}`);
    }
  }

  // Validate success criteria
  console.log('\n=== Validation ===');

  if (totalEntries < 200) {
    console.error(`FAILURE: Only ${totalEntries} entries (target: 200+)`);
    process.exit(1);
  }

  if (uniqueCategories < 5) {
    console.error(`FAILURE: Only ${uniqueCategories} categories (target: 5+)`);
    process.exit(1);
  }

  console.log('SUCCESS: Catalog meets pre-seed targets (200+ entries, 5+ categories)');
}

main().catch((err) => {
  console.error('[seed] Fatal error:', err);
  process.exit(1);
});
