/**
 * Awesome-openclaw GitHub list normalizer.
 *
 * Transforms parsed rows from VoltAgent/awesome-openclaw-skills README markdown
 * into SkillEntryInput format.
 *
 * Source format from the VoltAgent list:
 *   - [skill-name](https://github.com/openclaw/skills/tree/main/skills/author/skill-name/SKILL.md) - Description text
 */

import { type SkillEntryInput, createSkillSlug } from '../../lib/skill-schema';
import type { SkillCategory } from '../../lib/categories';

export interface AwesomeRow {
  /** Display name from the markdown link text */
  name: string;
  /** GitHub URL to the SKILL.md file or skills directory */
  url: string;
  /** Description after the " - " delimiter */
  description: string;
  /** Section/category header the row was found under */
  section?: string;
}

/**
 * Map VoltAgent section headers to our SkillCategory taxonomy.
 */
function sectionToCategory(section: string | undefined, description: string): SkillCategory {
  if (!section) {
    return inferFromDescription(description);
  }

  const s = section.toLowerCase();

  // Skip generic/navigation sections — fall through to description inference
  if (/table of contents|toc|introduction|overview|about|getting started|installation/.test(s)) {
    return inferFromDescription(description);
  }

  if (/web3|crypto|blockchain|defi|nft|wallet|finance/.test(s)) return 'web3';
  if (/cod|ide|developer|debug|git|refactor|test/.test(s)) return 'coding';
  if (/research|search|analys|data|news|reddit/.test(s)) return 'research';
  // Use word boundary to avoid "contents" matching "content"
  if (/image|video|audio|\bmedia\b|\bcontent\b|creat|generat|write/.test(s)) return 'media';
  if (/automat|workflow|schedul|monitor|integrat|trigger/.test(s)) return 'automation';

  return inferFromDescription(description);
}

function inferFromDescription(description: string): SkillCategory {
  const d = description.toLowerCase();
  if (/web3|crypto|blockchain|defi|nft|wallet/.test(d)) return 'web3';
  if (/\bcode\b|coding|typescript|javascript|python|\bdebug\b|git/.test(d)) return 'coding';
  if (/research|search|find|analy|summarize|news|reddit/.test(d)) return 'research';
  if (/image|video|audio|\bmedia\b|\bcontent\b|generate|write|tweet/.test(d)) return 'media';
  if (/schedule|automate|workflow|trigger|cron|monitor|notify/.test(d)) return 'automation';
  return 'other';
}

/**
 * Extract author/publisher from a GitHub skills URL.
 *
 * e.g. https://github.com/openclaw/skills/tree/main/skills/getfoundry/unbrowse/SKILL.md
 *   → 'getfoundry'
 */
function extractPublisher(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    // Path: /openclaw/skills/tree/main/skills/<author>/<skill-name>/SKILL.md
    const parts = parsed.pathname.split('/');
    const skillsIdx = parts.indexOf('skills', 3); // skip /openclaw/skills/tree
    if (skillsIdx !== -1 && parts[skillsIdx + 1]) {
      return parts[skillsIdx + 1];
    }
  } catch {
    // Invalid URL — skip
  }
  return undefined;
}

/**
 * Normalize a parsed awesome-openclaw markdown row to SkillEntryInput.
 *
 * @param row - Parsed row from the markdown list
 * @returns SkillEntryInput ready for SkillEntrySchema.parse()
 */
export function normalizeAwesomeRow(row: AwesomeRow): SkillEntryInput {
  const category = sectionToCategory(row.section, row.description);
  const publisher = extractPublisher(row.url);

  const description = row.description && row.description.length >= 10
    ? row.description
    : `OpenClaw skill: ${row.name}`;

  const tagline = description.slice(0, 160);

  // Derive tags from section, category, and name words
  const nameTags = row.name
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter((w) => w.length > 2);
  const sectionTags = row.section
    ? row.section.toLowerCase().split(/[\s\-_]+/).filter((w) => w.length > 2)
    : [];
  const tags = Array.from(new Set([category, 'openclaw-skill', ...nameTags, ...sectionTags])).slice(0, 8);

  // Derive install command from the slug (last part of the GitHub path)
  let installSlug = row.name.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  let skillDirName = installSlug;
  try {
    const urlParts = new URL(row.url).pathname.split('/').filter(Boolean);
    // Get the skill directory name (second-to-last part before SKILL.md or at end)
    const mdIdx = urlParts.findIndex((p) => p === 'SKILL.md');
    if (mdIdx > 0) {
      installSlug = urlParts[mdIdx - 1];
      skillDirName = urlParts[mdIdx - 1];
    } else if (urlParts.length > 0) {
      installSlug = urlParts[urlParts.length - 1];
      skillDirName = urlParts[urlParts.length - 1];
    }
  } catch {
    // Keep default
  }

  // Make slug unique by combining publisher + skill dir name when available
  // This prevents collisions when multiple authors publish a skill with the same name
  const uniqueSlug = publisher
    ? createSkillSlug(`${publisher}-${skillDirName}`)
    : createSkillSlug(installSlug);

  return {
    slug: uniqueSlug,
    name: row.name,
    tagline,
    description,
    category,
    tags,
    sourceUrl: row.url,
    publisher,
    installCmd: `openclaw plugins install ${installSlug}`,
    skillType: 'agent-tool',
    stars: 0,
    verified: false,
    submittedBy: 'awesome-openclaw-scraper',
  } as SkillEntryInput;
}
