/**
 * src/scripts/seed-skills.ts
 *
 * Seeds the skills table from two OpenClaw data sources:
 *   1. ClawHub.ai API (primary — ~500 verified skills)
 *   2. VoltAgent/awesome-openclaw-skills GitHub list (curated — ~1500 skills)
 *
 * Usage:
 *   bun run seed:skills              (local dev)
 *   bun run seed:skills:prod         (production Turso)
 *
 * Idempotent — safe to re-run. Uses upsert by sourceUrl.
 *
 * Success criteria: at least 30 skills inserted.
 */

import { scrapeClawHub } from '../scrapers/clawhub-scraper';
import { scrapeAwesomeOpenclaw } from '../scrapers/awesome-openclaw-scraper';
import { countBySkillCategory } from '../services/skills';
import { sql } from 'drizzle-orm';
import { db } from '../db/client';

async function main() {
  const startTime = Date.now();
  console.log('[seed-skills] Starting skills seed...\n');

  const stats = {
    clawhub: { processed: 0, errors: 0 },
    awesome: { processed: 0, errors: 0 },
  };

  // Phase 1: ClawHub.ai API (fast, structured JSON)
  console.log('[seed-skills] Phase 1: ClawHub.ai API scrape...');
  try {
    stats.clawhub = await scrapeClawHub(500);
    console.log(
      `[seed-skills] ClawHub: ${stats.clawhub.processed} processed, ${stats.clawhub.errors} errors\n`
    );
  } catch (err) {
    console.error(`[seed-skills] ClawHub scrape failed: ${err}\n`);
  }

  // Phase 2: Awesome-openclaw GitHub lists (curated, quality-filtered)
  console.log('[seed-skills] Phase 2: Awesome-openclaw GitHub scrape...');
  try {
    stats.awesome = await scrapeAwesomeOpenclaw(1500);
    console.log(
      `[seed-skills] Awesome-openclaw: ${stats.awesome.processed} processed, ${stats.awesome.errors} errors\n`
    );
  } catch (err) {
    console.error(`[seed-skills] Awesome-openclaw scrape failed: ${err}\n`);
  }

  // Final counts
  const categoryCounts = await countBySkillCategory();
  const total = categoryCounts.reduce((sum, c) => sum + c.count, 0);

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('[seed-skills] ─────────────────────────────────────');
  console.log(`[seed-skills] Total skills in DB: ${total}`);
  console.log(`[seed-skills] Category breakdown:`);
  for (const { category, count } of categoryCounts) {
    console.log(`[seed-skills]   ${category}: ${count}`);
  }
  console.log(`[seed-skills] Elapsed: ${elapsed}s`);
  console.log('[seed-skills] ─────────────────────────────────────');

  // Success check
  if (total < 30) {
    console.error(`[seed-skills] FAIL: only ${total} skills — expected at least 30`);
    process.exit(1);
  }

  console.log('[seed-skills] Seed complete.');
}

main().catch((err) => {
  console.error('[seed-skills] Fatal error:', err);
  process.exit(1);
});
