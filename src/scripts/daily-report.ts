/**
 * Daily Trend Report Generator for AI Bazaar Content Engine.
 *
 * Generates a formatted daily brief containing:
 *   - Top 10 trending tools by hype score
 *   - New launches in the last 24 hours
 *   - Suggested content angle (rotates through 5 content types)
 *   - Reply targets placeholder (filled by engagement radar)
 *
 * Output:
 *   - Saved to outputs/daily-brief-YYYY-MM-DD.md
 *   - Also printed to stdout for piping to Telegram
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/scripts/daily-report.ts
 *
 * Via package.json:
 *   bun run daily-report          # local dev.db
 *   bun run daily-report:prod     # production
 */

import { createClient } from '@libsql/client';
import { CATEGORY_LABELS, type Category } from '../lib/categories';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('Error: TURSO_DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = createClient({ url, authToken });

const BAZAAR_URL = 'https://ai-bazaar-eight.vercel.app';

/**
 * Content type rotation following the 14-day calendar from the spec.
 * Maps day-of-cycle (1-14) to content type.
 */
const CONTENT_CALENDAR: Record<number, { type: string; angle: string }> = {
  1: { type: 'Hot Tool Drop', angle: 'Highest hype score tool of the week' },
  2: { type: 'Quick Take', angle: 'Opinion on a major AI launch/news' },
  3: { type: 'Web3 + AI Angle', angle: '"AI tools every DeFi user needs"' },
  4: { type: 'Hot Tool Drop', angle: 'A tool most people haven\'t heard of' },
  5: { type: 'Top 5 Thread 🧵', angle: 'Weekly roundup (best day: Tue/Wed)' },
  6: { type: 'VS Comparison', angle: 'Two competing tools in same category' },
  7: { type: 'Quick Take', angle: 'Weekend hot take (lighter, more engagement-focused)' },
  8: { type: 'Hot Tool Drop', angle: 'A tool in the MCP Server category (trending)' },
  9: { type: 'Web3 + AI Angle', angle: '"How I use AI tools for crypto research"' },
  10: { type: 'Hot Tool Drop', angle: 'A newly submitted tool from AI Bazaar' },
  11: { type: 'Quick Take', angle: 'React to someone else\'s AI tweet with your angle' },
  12: { type: 'Top 5 Thread 🧵', angle: 'Weekly roundup #2' },
  13: { type: 'VS Comparison', angle: 'An AI coding tool comparison' },
  14: { type: 'RECAP Thread 🧵', angle: '"I tracked AI tool trends for 2 weeks. Here\'s what I learned."' },
};

interface TrendingTool {
  name: string;
  tagline: string;
  hypeScore: number;
  category: string;
  slug: string;
  stars: number;
  downloads: number;
  sourceUrl: string;
}

interface NewLaunch {
  name: string;
  tagline: string;
  category: string;
  slug: string;
  submittedBy: string | null;
  sourceUrl: string;
  createdAt: number;
}

/**
 * Detect the biggest hype score movers in the last 24h by comparing
 * hype_score to what it "should be" without the recency boost.
 */
function suggestAngleFromData(
  topTools: TrendingTool[],
  newLaunches: NewLaunch[],
  dayOfCycle: number,
): string {
  const calendar = CONTENT_CALENDAR[dayOfCycle] || CONTENT_CALENDAR[1];
  let reason = '';

  if (calendar.type === 'Hot Tool Drop' && topTools.length > 0) {
    const tool = topTools[0];
    reason = `${tool.name} leads with hype score ${tool.hypeScore}/100 (${tool.stars.toLocaleString()} stars)`;
  } else if (calendar.type.includes('Thread') && topTools.length >= 5) {
    reason = `Top 5 span hype scores ${topTools[4].hypeScore}-${topTools[0].hypeScore}`;
  } else if (calendar.type === 'VS Comparison' && topTools.length >= 2) {
    // Find two tools in the same category
    const catMap = new Map<string, TrendingTool[]>();
    for (const t of topTools) {
      const arr = catMap.get(t.category) || [];
      arr.push(t);
      catMap.set(t.category, arr);
    }
    for (const [cat, tools] of catMap) {
      if (tools.length >= 2) {
        reason = `${tools[0].name} vs ${tools[1].name} — both top in ${CATEGORY_LABELS[cat as Category] || cat}`;
        break;
      }
    }
    if (!reason) reason = 'Multiple high-scoring tools available for comparison';
  } else if (newLaunches.length > 0) {
    reason = `${newLaunches.length} new tool${newLaunches.length > 1 ? 's' : ''} added in last 24h`;
  } else {
    reason = calendar.angle;
  }

  return reason;
}

/**
 * Get the posting schedule for today.
 */
function getPostingSchedule(): string {
  const dayOfWeek = new Date().getDay(); // 0=Sun, 6=Sat
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return '1 tweet — 11am EST (weekend schedule)';
  }
  return '2 tweets — 9am EST + 1pm EST (weekday schedule)';
}

/**
 * Determine which day of the 14-day content cycle we're on.
 * Uses a fixed epoch so the cycle is consistent across runs.
 */
function getDayOfCycle(): number {
  // Epoch: Feb 22, 2026 (today) = Day 1
  const epoch = new Date('2026-02-22T00:00:00Z').getTime();
  const now = Date.now();
  const daysSinceEpoch = Math.floor((now - epoch) / 86_400_000);
  return (daysSinceEpoch % 14) + 1; // 1-indexed, wraps every 14 days
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  const dayOfCycle = getDayOfCycle();
  const calendar = CONTENT_CALENDAR[dayOfCycle] || CONTENT_CALENDAR[1];

  // 1. Get top 10 trending tools by hype score
  const topResult = await client.execute(
    `SELECT name, tagline, hype_score, category, slug, stars, downloads, source_url
     FROM listings
     WHERE dead_link = 0 AND hype_score > 0
     ORDER BY hype_score DESC
     LIMIT 10`
  );

  const topTools: TrendingTool[] = topResult.rows.map(row => ({
    name: row.name as string,
    tagline: row.tagline as string,
    hypeScore: row.hype_score as number,
    category: row.category as string,
    slug: row.slug as string,
    stars: (row.stars as number) || 0,
    downloads: (row.downloads as number) || 0,
    sourceUrl: row.source_url as string,
  }));

  // 2. Get tools added in the last 24 hours
  const oneDayAgo = Math.floor((Date.now() - 86_400_000) / 1000);
  const newResult = await client.execute({
    sql: `SELECT name, tagline, category, slug, submitted_by, source_url, created_at
          FROM listings
          WHERE dead_link = 0 AND created_at > ?
          ORDER BY created_at DESC
          LIMIT 20`,
    args: [oneDayAgo],
  });

  const newLaunches: NewLaunch[] = newResult.rows.map(row => ({
    name: row.name as string,
    tagline: row.tagline as string,
    category: row.category as string,
    slug: row.slug as string,
    submittedBy: row.submitted_by as string | null,
    sourceUrl: row.source_url as string,
    createdAt: row.created_at as number,
  }));

  // 3. Get category distribution of top tools
  const catResult = await client.execute(
    `SELECT category, COUNT(*) as count, AVG(hype_score) as avg_hype
     FROM listings
     WHERE dead_link = 0 AND hype_score > 0
     GROUP BY category
     ORDER BY avg_hype DESC
     LIMIT 5`
  );

  // 4. Get a pair of comparable tools for VS content
  const vsResult = await client.execute(
    `SELECT l1.name as name1, l1.slug as slug1, l1.hype_score as hype1,
            l2.name as name2, l2.slug as slug2, l2.hype_score as hype2,
            l1.category
     FROM listings l1
     JOIN listings l2 ON l1.category = l2.category AND l1.id < l2.id
     WHERE l1.dead_link = 0 AND l2.dead_link = 0
       AND l1.hype_score > 30 AND l2.hype_score > 30
       AND ABS(l1.hype_score - l2.hype_score) <= 10
     ORDER BY (l1.hype_score + l2.hype_score) DESC
     LIMIT 3`
  );

  // 5. Build the markdown brief
  const reason = suggestAngleFromData(topTools, newLaunches, dayOfCycle);
  const schedule = getPostingSchedule();

  let md = `## AI Bazaar Daily Brief — ${today}\n\n`;
  md += `**Day ${dayOfCycle}/14** of content cycle | ${schedule}\n\n`;
  md += `---\n\n`;

  // Top Trending Tools
  md += `### 🔥 Top Trending Tools\n\n`;
  for (let i = 0; i < topTools.length; i++) {
    const t = topTools[i];
    const label = CATEGORY_LABELS[t.category as Category] || t.category;
    md += `${i + 1}. **${t.name}** — ${t.tagline.slice(0, 120)}\n`;
    md += `   Hype: ${t.hypeScore}/100 | ${label} | ⭐ ${t.stars.toLocaleString()}`;
    if (t.downloads > 0) md += ` | 📦 ${t.downloads.toLocaleString()} downloads`;
    md += `\n`;
    md += `   AI Bazaar: ${BAZAAR_URL}/tools/${t.slug}\n\n`;
  }

  // New Launches
  md += `### 🆕 New Launches (Last 24h)\n\n`;
  if (newLaunches.length === 0) {
    md += `_No new tools added in the last 24 hours._\n\n`;
  } else {
    for (const n of newLaunches) {
      const source = n.submittedBy || 'unknown';
      const label = CATEGORY_LABELS[n.category as Category] || n.category;
      md += `- **${n.name}** — ${n.tagline.slice(0, 120)}\n`;
      md += `  ${label} | Source: ${source}\n`;
      md += `  AI Bazaar: ${BAZAAR_URL}/tools/${n.slug}\n\n`;
    }
  }

  // VS Comparison Candidates
  if (vsResult.rows.length > 0) {
    md += `### ⚔️ VS Comparison Candidates\n\n`;
    for (const row of vsResult.rows) {
      const label = CATEGORY_LABELS[row.category as string as Category] || row.category;
      md += `- **${row.name1}** (${row.hype1}) vs **${row.name2}** (${row.hype2}) — ${label}\n`;
    }
    md += `\n`;
  }

  // Hot Categories
  md += `### 📊 Hottest Categories\n\n`;
  for (const row of catResult.rows) {
    const label = CATEGORY_LABELS[row.category as string as Category] || row.category;
    const avgHype = Math.round(row.avg_hype as number);
    md += `- ${label}: ${row.count} tools, avg hype ${avgHype}/100\n`;
  }
  md += `\n`;

  // Suggested Content Angle
  md += `### 🎯 Suggested Content\n\n`;
  md += `**Content Type:** ${calendar.type}\n`;
  md += `**Angle:** ${calendar.angle}\n`;
  md += `**Based on:** ${reason}\n\n`;

  // Reply Targets placeholder
  md += `### 💬 Reply Targets\n\n`;
  md += `_Run \`bun run engagement-radar\` to populate reply targets._\n\n`;

  // Daily Input Template (ready to paste into Claude)
  md += `---\n\n`;
  md += `### 📋 Claude Prompt Input (copy-paste ready)\n\n`;
  md += '```\n';
  md += `Today's date: ${today}\n\n`;
  md += `TOP TRENDING TOOLS (from hype score pipeline):\n`;
  for (let i = 0; i < Math.min(5, topTools.length); i++) {
    const t = topTools[i];
    const label = CATEGORY_LABELS[t.category as Category] || t.category;
    md += `${i + 1}. ${t.name} — ${t.tagline.slice(0, 80)} — hype score: ${t.hypeScore} — ${label} — ${BAZAAR_URL}/tools/${t.slug}\n`;
  }
  md += `\n`;
  md += `NEW LAUNCHES TODAY:\n`;
  if (newLaunches.length === 0) {
    md += `- No new launches today\n`;
  } else {
    for (const n of newLaunches.slice(0, 5)) {
      md += `- ${n.name} — ${n.submittedBy || 'scraped'}\n`;
    }
  }
  md += `\n`;
  md += `WHAT I POSTED YESTERDAY:\n`;
  md += `[paste yesterday's tweets here]\n\n`;
  md += `Generate today's content. Give me:\n`;
  md += `1. A content type (rotate from the 5 types — suggest: ${calendar.type})\n`;
  md += `2. The full tweet text(s), ready to copy-paste\n`;
  md += `3. Suggested posting time (optimize for US + EU overlap: 8-10am EST or 12-2pm EST)\n`;
  md += `4. One engagement reply I should leave on a trending AI tweet today\n`;
  md += '```\n';

  // 6. Save to file
  const outputDir = new URL('../../outputs/', import.meta.url).pathname;
  const outputPath = `${outputDir}daily-brief-${today}.md`;

  await Bun.write(outputPath, md);

  // 7. Print to stdout for Telegram piping
  console.log(md);

  // 8. Summary to stderr (doesn't interfere with stdout piping)
  console.error(`\n[daily-report] Brief saved to outputs/daily-brief-${today}.md`);
  console.error(`[daily-report] Top tools: ${topTools.length}, New launches: ${newLaunches.length}`);
  console.error(`[daily-report] Day ${dayOfCycle}/14: ${calendar.type}`);

  client.close();
}

main().catch((err) => {
  console.error('[daily-report] Fatal error:', err);
  process.exit(1);
});
