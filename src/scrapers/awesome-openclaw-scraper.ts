/**
 * Awesome-openclaw GitHub list scraper.
 *
 * Parses two curated lists of OpenClaw skills from GitHub:
 *   1. VoltAgent/awesome-openclaw-skills — 3,002 curated skills (primary)
 *   2. SamurAIGPT/awesome-openclaw — installation guides + skill references
 *
 * Format (VoltAgent list):
 *   - [skill-name](https://github.com/openclaw/skills/tree/main/skills/author/name/SKILL.md) - Description
 *
 * Section headers:
 *   ## Section Name (count) — used to infer category
 */

import { normalizeAwesomeRow, type AwesomeRow } from './normalizers/awesome-openclaw-normalizer';
import { upsertSkillBySourceUrl } from '../services/skills';

const REPOS = [
  {
    name: 'VoltAgent/awesome-openclaw-skills',
    url: 'https://raw.githubusercontent.com/VoltAgent/awesome-openclaw-skills/main/README.md',
  },
  {
    name: 'SamurAIGPT/awesome-openclaw',
    url: 'https://raw.githubusercontent.com/SamurAIGPT/awesome-openclaw/main/README.md',
  },
];

/**
 * Fetch markdown content from a GitHub raw URL.
 */
async function fetchMarkdown(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    return response.text();
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse skill rows from awesome-openclaw markdown content.
 *
 * Extracts entries matching:
 *   - [name](url) - description
 *
 * Also tracks the current section header for category inference.
 *
 * @param markdown - Full README.md content
 * @param filter - Optional URL filter: only keep rows whose URL matches this string
 * @returns Array of parsed AwesomeRow objects
 */
export function parseMarkdownRows(markdown: string, filter?: string): AwesomeRow[] {
  const rows: AwesomeRow[] = [];
  let currentSection = '';

  for (const line of markdown.split('\n')) {
    // Track section headers: ## Section Name or ### Section Name
    const sectionMatch = line.match(/^#{1,4}\s+(.+)/);
    if (sectionMatch) {
      // Strip count suffix like "(133)"
      currentSection = sectionMatch[1].replace(/\s*\(\d+\)\s*$/, '').trim();
      continue;
    }

    // Match skill links: - [name](url) - description
    // Also handles: * [name](url) - description
    const skillMatch = line.match(/^[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*[-–]\s*(.+)/);
    if (skillMatch) {
      const name = skillMatch[1].trim();
      const url = skillMatch[2].trim();
      const description = skillMatch[3].trim();

      // Apply URL filter if provided
      if (filter && !url.includes(filter)) continue;

      // Skip non-skill links (guides, articles, platforms)
      if (!url.startsWith('http')) continue;
      if (name.length < 2 || name.length > 100) continue;
      if (description.length < 5) continue;

      rows.push({ name, url, description, section: currentSection || undefined });
    }
  }

  return rows;
}

/**
 * Scrape OpenClaw skills from awesome-openclaw GitHub lists.
 *
 * Fetches and parses README.md from both repos.
 * Only processes skills whose URLs point to GitHub skill files
 * (to avoid including generic links from tutorial sections).
 *
 * @param maxResults - Maximum skills per repo (default 1500)
 * @returns Object with processed and error counts
 */
export async function scrapeAwesomeOpenclaw(
  maxResults = 1500
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  for (const repo of REPOS) {
    console.log(`[awesome-openclaw-scraper] Fetching ${repo.name}...`);

    let markdown: string;
    try {
      markdown = await fetchMarkdown(repo.url);
    } catch (err) {
      console.error(`[awesome-openclaw-scraper] Failed to fetch ${repo.name}: ${err}`);
      errors++;
      continue;
    }

    // Filter to skill-related URLs only (GitHub skill files or clawhub pages)
    const rows = parseMarkdownRows(markdown, 'github.com/openclaw/skills');

    console.log(`[awesome-openclaw-scraper] ${repo.name}: found ${rows.length} skill rows`);

    let repoProcessed = 0;
    for (const row of rows) {
      if (repoProcessed >= maxResults) break;

      try {
        const entry = normalizeAwesomeRow(row);
        await upsertSkillBySourceUrl(entry);
        processed++;
        repoProcessed++;
      } catch (err) {
        console.error(`[awesome-openclaw-scraper] Failed to upsert "${row.name}": ${err}`);
        errors++;
      }
    }

    console.log(`[awesome-openclaw-scraper] ${repo.name}: processed=${repoProcessed}`);
  }

  console.log(`[awesome-openclaw-scraper] Done. processed=${processed}, errors=${errors}`);
  return { processed, errors };
}
