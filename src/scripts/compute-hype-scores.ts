/**
 * Hype score computation script.
 *
 * Computes a 0-100 hype score for every non-dead listing in the catalog
 * using a weighted combination of:
 *   - stars_score     (30%) — GitHub stars / Product Hunt votes (log scale)
 *   - downloads_score (25%) — npm/registry download count (log scale)
 *   - recency_score   (25%) — Days since last scraper update (linear decay, 30d)
 *   - upvotes_score   (20%) — Community upvotes on AI Bazaar (linear, cap 50)
 *
 * Results are batch-updated in a single transaction for efficiency.
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/scripts/compute-hype-scores.ts
 *
 * Via package.json:
 *   bun run hype:compute        # local dev.db
 *   bun run hype:compute:prod   # production
 */

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('Error: TURSO_DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = createClient({ url, authToken });

/**
 * Logarithmic star score.
 * Scale: 0 stars=0, 10=20, 100=40, 1k=60, 10k=80, 100k=100.
 */
function starsScore(stars: number): number {
  return Math.min(100, (Math.log10(stars + 1) / Math.log10(100_000)) * 100);
}

/**
 * Logarithmic download score.
 * Scale: calibrated for download counts (tends to be higher than stars).
 * 0 downloads=0, 100=33, 1k=50, 10k=67, 100k=83, 1M=100.
 */
function downloadsScore(downloads: number): number {
  return Math.min(100, (Math.log10(downloads + 1) / Math.log10(1_000_000)) * 100);
}

/**
 * Linear recency score based on updatedAt timestamp.
 * 100 = updated today, 50 = updated 15 days ago, 0 = updated 30+ days ago.
 *
 * @param updatedAtUnix - Unix timestamp in seconds (as stored in DB)
 */
function recencyScore(updatedAtUnix: number): number {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const daysSinceUpdate = (nowSeconds - updatedAtUnix) / 86400;
  return Math.max(0, 100 - (daysSinceUpdate * (100 / 30)));
}

/**
 * Linear upvotes score, capped at 50 upvotes = 100.
 */
function upvotesScore(upvotes: number): number {
  return Math.min(100, upvotes * 2);
}

/**
 * Compute the composite hype score (0-100).
 * Weights: stars 30%, downloads 25%, recency 25%, upvotes 20%.
 */
function computeHypeScore(
  stars: number,
  downloads: number,
  updatedAtUnix: number,
  upvotes: number
): number {
  const score =
    starsScore(stars) * 0.30 +
    downloadsScore(downloads) * 0.25 +
    recencyScore(updatedAtUnix) * 0.25 +
    upvotesScore(upvotes) * 0.20;

  return Math.round(score);
}

async function main() {
  console.log('=== AI Bazaar: Compute Hype Scores ===\n');
  const startTime = Date.now();

  // Fetch all non-dead listings with the signals we need
  const result = await client.execute(
    `SELECT id, stars, downloads, upvotes, updated_at
     FROM listings
     WHERE dead_link = 0`
  );

  const rows = result.rows;
  console.log(`Found ${rows.length} active listings to score\n`);

  if (rows.length === 0) {
    console.log('No listings to score. Run scrapers first.');
    client.close();
    return;
  }

  // Compute hype score for each listing
  const nowUnix = Math.floor(Date.now() / 1000);

  const scored: Array<{ id: string; hypeScore: number }> = [];

  for (const row of rows) {
    const id = row.id as string;
    const stars = (row.stars as number) || 0;
    const downloads = (row.downloads as number) || 0;
    const upvotes = (row.upvotes as number) || 0;
    const updatedAt = (row.updated_at as number) || nowUnix;

    const hypeScore = computeHypeScore(stars, downloads, updatedAt, upvotes);
    scored.push({ id, hypeScore });
  }

  // Batch update hype scores in a transaction
  console.log('Updating hype scores in database...');
  const hypeUpdatedAt = nowUnix;

  // Use batch() for atomic updates
  await client.batch(
    scored.map(({ id, hypeScore }) => ({
      sql: `UPDATE listings SET hype_score = ?, hype_updated_at = ? WHERE id = ?`,
      args: [hypeScore, hypeUpdatedAt, id],
    })),
    'write'
  );

  // Statistics
  const scores = scored.map(s => s.hypeScore);
  const total = scores.length;
  const withScore = scores.filter(s => s > 0).length;
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / total);
  const maxScore = Math.max(...scores);

  console.log(`\nResults:`);
  console.log(`  Total scored:       ${total}`);
  console.log(`  With score > 0:     ${withScore}`);
  console.log(`  Average score:      ${avgScore}`);
  console.log(`  Highest score:      ${maxScore}`);

  // Top 10 by score
  const topScored = [...scored]
    .sort((a, b) => b.hypeScore - a.hypeScore)
    .slice(0, 10);

  if (topScored.length > 0) {
    console.log('\nTop 10 by hype score:');
    for (let i = 0; i < topScored.length; i++) {
      // Fetch name for display
      const nameResult = await client.execute({
        sql: `SELECT name FROM listings WHERE id = ?`,
        args: [topScored[i].id],
      });
      const name = nameResult.rows[0]?.name || topScored[i].id;
      console.log(`  ${i + 1}. ${name} — ${topScored[i].hypeScore}`);
    }
  }

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nCompleted in ${duration}s`);

  client.close();
}

main().catch((err) => {
  console.error('[compute-hype-scores] Fatal error:', err);
  process.exit(1);
});
