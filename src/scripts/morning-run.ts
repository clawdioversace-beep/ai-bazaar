/**
 * Morning Run — AI Bazaar Content Engine daily orchestrator.
 *
 * Runs the full daily pipeline:
 *   1. Run all scrapers (refreshes tool data)
 *   2. Compute hype scores
 *   3. Generate daily report
 *   4. Send condensed brief to Jet via Telegram
 *
 * Designed to run at 7am daily (cron or manual).
 *
 * Usage:
 *   bun run morning-run              # full pipeline (scrape + report)
 *   bun run morning-run --skip-scrape  # skip scrapers, just report + telegram
 *
 * Via cron:
 *   0 7 * * * cd /Users/clawdioversace/ai-bazaar && TURSO_DATABASE_URL=file:./dev.db bun src/scripts/morning-run.ts
 */

import { createClient } from '@libsql/client';
import { CATEGORY_LABELS, type Category } from '../lib/categories';

const BAZAAR_URL = 'https://ai-bazaar-eight.vercel.app';
const skipScrape = process.argv.includes('--skip-scrape');

async function runCommand(label: string, cmd: string[]): Promise<boolean> {
  console.log(`\n--- ${label} ---`);
  const start = Date.now();

  try {
    const proc = Bun.spawn(cmd, {
      cwd: new URL('../../', import.meta.url).pathname,
      env: { ...process.env },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    const duration = ((Date.now() - start) / 1000).toFixed(1);

    if (exitCode === 0) {
      console.log(`  [OK] ${label} completed in ${duration}s`);
      return true;
    } else {
      const stderr = await new Response(proc.stderr).text();
      console.error(`  [FAIL] ${label} exited with code ${exitCode} (${duration}s)`);
      if (stderr) console.error(`  ${stderr.slice(0, 200)}`);
      return false;
    }
  } catch (err) {
    console.error(`  [ERROR] ${label}: ${err}`);
    return false;
  }
}

/**
 * Build a condensed Telegram-friendly summary (< 4000 chars for TG limit).
 */
async function buildTelegramBrief(): Promise<string> {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) return 'Error: TURSO_DATABASE_URL not set';

  const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });

  try {
    // Top 5 tools
    const topResult = await client.execute(
      `SELECT name, hype_score, category, slug
       FROM listings
       WHERE dead_link = 0 AND hype_score > 0
       ORDER BY hype_score DESC
       LIMIT 5`
    );

    // New in last 24h
    const oneDayAgo = Math.floor((Date.now() - 86_400_000) / 1000);
    const newResult = await client.execute({
      sql: `SELECT COUNT(*) as count FROM listings WHERE created_at > ?`,
      args: [oneDayAgo],
    });

    // Total stats
    const statsResult = await client.execute(
      `SELECT COUNT(*) as total, AVG(hype_score) as avg_hype FROM listings WHERE dead_link = 0`
    );

    const today = new Date().toISOString().split('T')[0];
    const newCount = (newResult.rows[0]?.count as number) || 0;
    const totalTools = (statsResult.rows[0]?.total as number) || 0;
    const avgHype = Math.round((statsResult.rows[0]?.avg_hype as number) || 0);

    // Content calendar
    const epoch = new Date('2026-02-22T00:00:00Z').getTime();
    const dayOfCycle = (Math.floor((Date.now() - epoch) / 86_400_000) % 14) + 1;
    const CONTENT_TYPES: Record<number, string> = {
      1: 'Hot Tool Drop', 2: 'Quick Take', 3: 'Web3 + AI',
      4: 'Hot Tool Drop', 5: 'Top 5 Thread', 6: 'VS Comparison',
      7: 'Quick Take', 8: 'Hot Tool Drop', 9: 'Web3 + AI',
      10: 'Hot Tool Drop', 11: 'Quick Take', 12: 'Top 5 Thread',
      13: 'VS Comparison', 14: 'RECAP Thread',
    };

    let msg = `📊 AI Bazaar Daily Brief — ${today}\n\n`;
    msg += `Day ${dayOfCycle}/14 | Today: ${CONTENT_TYPES[dayOfCycle] || 'Hot Tool Drop'}\n`;
    msg += `${totalTools} tools tracked | avg hype ${avgHype}/100 | ${newCount} new today\n\n`;
    msg += `🔥 Top 5 Trending:\n`;

    for (let i = 0; i < topResult.rows.length; i++) {
      const r = topResult.rows[i];
      const label = CATEGORY_LABELS[(r.category as string) as Category] || r.category;
      msg += `${i + 1}. ${r.name} — ${r.hype_score}/100 (${label})\n`;
      msg += `   ${BAZAAR_URL}/tools/${r.slug}\n`;
    }

    msg += `\n📋 Full brief saved. Paste into Claude to generate tweets.`;
    msg += `\nRun: bun run daily-report`;

    return msg;
  } finally {
    client.close();
  }
}

/**
 * Send message to Telegram via the existing telegram-notify script.
 */
async function sendTelegram(message: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(
      ['/Users/clawdioversace/.claude/scripts/telegram-notify.sh', message],
      { stdout: 'pipe', stderr: 'pipe' }
    );
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch (err) {
    console.error(`  [ERROR] Telegram send failed: ${err}`);
    return false;
  }
}

async function main() {
  const startTime = Date.now();
  console.log('=== AI Bazaar Morning Run ===');
  console.log(`Time: ${new Date().toISOString()}`);
  console.log(`Skip scrape: ${skipScrape}\n`);

  const results: { step: string; success: boolean }[] = [];

  // Step 1: Run scrapers (optional)
  if (!skipScrape) {
    const ok = await runCommand(
      'Run all scrapers',
      ['bun', 'run', 'scrape:all']
    );
    results.push({ step: 'Scrapers', success: ok });

    // Step 2: Compute hype scores
    if (ok) {
      const hypeOk = await runCommand(
        'Compute hype scores',
        ['bun', 'run', 'hype:compute']
      );
      results.push({ step: 'Hype scores', success: hypeOk });
    }
  } else {
    console.log('\n--- Skipping scrapers (--skip-scrape) ---');
  }

  // Step 3: Generate daily report
  const reportOk = await runCommand(
    'Generate daily report',
    ['bun', 'src/scripts/daily-report.ts']
  );
  results.push({ step: 'Daily report', success: reportOk });

  // Step 4: Run engagement radar
  const radarOk = await runCommand(
    'Run engagement radar',
    ['bun', 'src/scripts/engagement-radar.ts']
  );
  results.push({ step: 'Engagement radar', success: radarOk });

  // Step 5: Send Telegram brief
  console.log('\n--- Send Telegram brief ---');
  const brief = await buildTelegramBrief();
  const tgOk = await sendTelegram(brief);
  results.push({ step: 'Telegram delivery', success: tgOk });

  if (tgOk) {
    console.log('  [OK] Brief sent to Telegram');
  } else {
    console.error('  [FAIL] Could not send to Telegram');
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Morning Run Complete (${duration}s) ===`);
  for (const r of results) {
    console.log(`  ${r.success ? '✓' : '✗'} ${r.step}`);
  }

  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('[morning-run] Fatal error:', err);
  process.exit(1);
});
