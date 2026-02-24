/**
 * src/db/seed-skills-sh.ts
 *
 * Scrapes skills.sh leaderboard (all-time + trending 24h) and upserts into skills_sh table.
 *
 * Two-step process:
 * 1. Scrape HTML from skills.sh and skills.sh/trending for rankings + install counts
 * 2. Enrich top skills with descriptions via skills.sh API
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/db/seed-skills-sh.ts
 *   TURSO_DATABASE_URL=libsql://... TURSO_AUTH_TOKEN=... bun src/db/seed-skills-sh.ts
 */

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const authToken = process.env.TURSO_AUTH_TOKEN;

if (!url) {
  console.error('Error: TURSO_DATABASE_URL environment variable is required');
  process.exit(1);
}

const client = createClient({ url, authToken });

interface SkillEntry {
  name: string;
  sourceRepo: string;
  installCount: number;
  allTimeRank: number | null;
  trendingRank: number | null;
  href: string;
}

/**
 * Parse install count string like "304.5K" or "1.2M" into a number.
 */
function parseInstallCount(raw: string): number {
  const cleaned = raw.trim().toUpperCase();
  if (cleaned.endsWith('M')) {
    return Math.round(parseFloat(cleaned.replace('M', '')) * 1_000_000);
  }
  if (cleaned.endsWith('K')) {
    return Math.round(parseFloat(cleaned.replace('K', '')) * 1_000);
  }
  return parseInt(cleaned.replace(/,/g, ''), 10) || 0;
}

/**
 * Scrape a skills.sh page (/ or /trending) and extract skill entries.
 * Returns up to `limit` entries.
 */
async function scrapePage(path: '/' | '/trending', limit: number): Promise<SkillEntry[]> {
  const res = await fetch(`https://skills.sh${path}`, {
    headers: { 'User-Agent': 'AI-Bazaar-Scraper/1.0 (https://ai-bazaar.vercel.app)' },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch skills.sh${path}: ${res.status} ${res.statusText}`);
  }

  const html = await res.text();
  const entries: SkillEntry[] = [];

  // Parse skill entries from the HTML.
  // Each entry is an <a> tag with href pattern: /owner/repo/skill-name
  // containing 3 child divs: [rank, name+source, installs]
  //
  // We use regex to extract from the known HTML structure:
  // <a ... href="/owner/repo/skill-name">
  //   <div ...><span ...>RANK</span></div>
  //   <div ...><h3 ...>NAME</h3><p ...>SOURCE</p></div>
  //   <div ...><span ...>INSTALLS</span></div>
  // </a>
  const linkPattern = /<a[^>]+href="(\/[^"]+\/[^"]+\/[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null && entries.length < limit) {
    const href = match[1];
    const inner = match[2];

    // Extract rank (first span with font-mono class containing just a number)
    const rankMatch = inner.match(/<span[^>]*>(\d+)<\/span>/);
    if (!rankMatch) continue;
    const rank = parseInt(rankMatch[1], 10);

    // Extract name from h3
    const nameMatch = inner.match(/<h3[^>]*>([^<]+)<\/h3>/);
    if (!nameMatch) continue;
    const name = nameMatch[1].trim();

    // Extract source repo from p tag
    const sourceMatch = inner.match(/<p[^>]*>([^<]+)<\/p>/);
    if (!sourceMatch) continue;
    const sourceRepo = sourceMatch[1].trim();

    // Extract install count — last span with font-mono class
    const installMatches = [...inner.matchAll(/<span[^>]*font-mono[^>]*>([^<]+)<\/span>/g)];
    // Skip the rank span — take the last font-mono span
    const installStr = installMatches.length > 0
      ? installMatches[installMatches.length - 1][1].trim()
      : '0';

    // The install count span is in the last div, not the rank div
    // If installStr is just a number matching the rank, look for the other format
    let installCount: number;
    if (installStr === String(rank)) {
      // Fallback: look for the K/M formatted number anywhere
      const kMatch = inner.match(/(\d+\.?\d*[KMkm])/);
      installCount = kMatch ? parseInstallCount(kMatch[1]) : 0;
    } else {
      installCount = parseInstallCount(installStr);
    }

    entries.push({
      name,
      sourceRepo,
      installCount,
      allTimeRank: path === '/' ? rank : null,
      trendingRank: path === '/trending' ? rank : null,
      href,
    });
  }

  return entries;
}

/**
 * Fetch description for a skill from skills.sh API.
 */
async function fetchDescription(href: string): Promise<string | null> {
  try {
    const res = await fetch(`https://skills.sh/api/agent/skills${href}?format=text`, {
      headers: { 'User-Agent': 'AI-Bazaar-Scraper/1.0' },
    });
    if (!res.ok) return null;
    const text = await res.text();
    // Truncate to reasonable length
    return text.slice(0, 500) || null;
  } catch {
    return null;
  }
}

async function main() {
  console.log('Scraping skills.sh leaderboard...');

  // Scrape both pages
  const [allTimeEntries, trendingEntries] = await Promise.all([
    scrapePage('/', 50),
    scrapePage('/trending', 50),
  ]);

  console.log(`  All-time: ${allTimeEntries.length} entries`);
  console.log(`  Trending: ${trendingEntries.length} entries`);

  // Merge: use all-time as base, overlay trending ranks
  const merged = new Map<string, SkillEntry>();

  for (const entry of allTimeEntries) {
    merged.set(entry.name, entry);
  }

  for (const entry of trendingEntries) {
    const existing = merged.get(entry.name);
    if (existing) {
      existing.trendingRank = entry.trendingRank;
    } else {
      merged.set(entry.name, entry);
    }
  }

  console.log(`  Merged: ${merged.size} unique skills`);

  // Enrich top 30 with descriptions
  console.log('Enriching top skills with descriptions...');
  const topSkills = [...merged.values()]
    .sort((a, b) => (a.allTimeRank ?? 999) - (b.allTimeRank ?? 999))
    .slice(0, 30);

  let enriched = 0;
  for (const skill of topSkills) {
    const desc = await fetchDescription(skill.href);
    if (desc) {
      const entry = merged.get(skill.name);
      if (entry) {
        (entry as any).description = desc;
        enriched++;
      }
    }
    // Rate limit: 100ms between API calls
    await new Promise(r => setTimeout(r, 100));
  }
  console.log(`  Enriched ${enriched}/${topSkills.length} skills with descriptions`);

  // Upsert into database
  const now = Math.floor(Date.now() / 1000);
  let upserted = 0;

  for (const entry of merged.values()) {
    const installCmd = `npx skills add ${entry.sourceRepo}`;
    const id = entry.name; // Use name as ID since it's unique

    await client.execute({
      sql: `INSERT INTO skills_sh (id, name, source_repo, description, install_count, all_time_rank, trending_rank, install_cmd, scraped_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(name) DO UPDATE SET
              source_repo = excluded.source_repo,
              description = COALESCE(excluded.description, skills_sh.description),
              install_count = excluded.install_count,
              all_time_rank = excluded.all_time_rank,
              trending_rank = excluded.trending_rank,
              install_cmd = excluded.install_cmd,
              scraped_at = excluded.scraped_at`,
      args: [
        id,
        entry.name,
        entry.sourceRepo,
        (entry as any).description ?? null,
        entry.installCount,
        entry.allTimeRank,
        entry.trendingRank,
        installCmd,
        now,
      ],
    });
    upserted++;
  }

  console.log(`Upserted ${upserted} skills into skills_sh table.`);

  // Verify
  const countResult = await client.execute('SELECT COUNT(*) as count FROM skills_sh');
  const totalRows = (countResult.rows[0] as any).count;
  console.log(`Total rows in skills_sh: ${totalRows}`);

  const topResult = await client.execute(
    'SELECT name, install_count, all_time_rank, trending_rank FROM skills_sh WHERE all_time_rank IS NOT NULL ORDER BY all_time_rank LIMIT 5'
  );
  console.log('\nTop 5 all-time:');
  for (const row of topResult.rows) {
    console.log(`  #${row.all_time_rank} ${row.name} — ${Number(row.install_count).toLocaleString()} installs${row.trending_rank ? ` (trending #${row.trending_rank})` : ''}`);
  }

  client.close();
  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
