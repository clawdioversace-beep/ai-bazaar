/**
 * ClawHub skill normalizer.
 *
 * Transforms raw ClawHub API search result objects into SkillEntryInput
 * format for insertion into the AI Bazaar skills catalog.
 */

import { type SkillEntryInput, createSkillSlug } from '../../lib/skill-schema';
import type { SkillCategory } from '../../lib/categories';

/**
 * Raw ClawHub API search result shape.
 * From GET https://clawhub.ai/api/search?limit=N&offset=N
 */
export interface ClawHubResult {
  score: number;
  slug: string;
  displayName: string;
  summary: string;
  version: string;
  updatedAt: number; // Unix ms timestamp
}

/**
 * Infer a skill category from the skill name and description.
 *
 * Priority order mirrors the project's opinionated taxonomy.
 */
function inferSkillCategory(name: string, summary: string): SkillCategory {
  const combined = `${name} ${summary}`.toLowerCase();

  if (/web3|crypto|blockchain|defi|nft|wallet|solana|ethereum|token/.test(combined)) {
    return 'web3';
  }
  if (/code|coding|typescript|javascript|python|refactor|lint|debug|test|git|pr|pull request/.test(combined)) {
    return 'coding';
  }
  if (/research|search|find|discover|analyze|report|summarize|news|reddit/.test(combined)) {
    return 'research';
  }
  if (/image|video|audio|voice|music|art|generate|media|content|write|tweet|post/.test(combined)) {
    return 'media';
  }
  if (/schedule|automate|workflow|trigger|cron|remind|monitor|watch|notify/.test(combined)) {
    return 'automation';
  }

  return 'other';
}

/**
 * Extract publisher from a ClawHub slug.
 * ClawHub slugs are usually in "publisher-skill-name" format or just "skill-name".
 *
 * e.g. "getfoundry-unbrowse" → "getfoundry"
 * e.g. "alpha-finder" → "openclaw" (default publisher)
 */
function extractPublisher(slug: string): string | undefined {
  // Known publishers derived from the slug prefix
  const knownPublishers = ['getfoundry', 'voltai', 'openai', 'anthropic', 'google'];
  const parts = slug.split('-');
  if (parts.length > 1 && knownPublishers.includes(parts[0])) {
    return parts[0];
  }
  return undefined;
}

/**
 * Normalize a ClawHub API result to SkillEntryInput.
 *
 * @param result - Raw ClawHub API result object
 * @returns SkillEntryInput ready for SkillEntrySchema.parse()
 */
export function normalizeClawHubResult(result: ClawHubResult): SkillEntryInput {
  const skillSlug = result.slug || createSkillSlug(result.displayName);
  const category = inferSkillCategory(result.displayName, result.summary);
  const publisher = extractPublisher(result.slug);

  // Build a clean description — fallback if summary is very short
  const description = result.summary && result.summary.length >= 10
    ? result.summary
    : `OpenClaw skill: ${result.displayName}`;

  // Tagline is the first 160 chars of the description
  const tagline = description.slice(0, 160);

  // Derive tags from category and skill name words
  const nameTags = result.displayName
    .toLowerCase()
    .split(/[\s\-_]+/)
    .filter((w) => w.length > 2);
  const tags = Array.from(new Set([category, 'openclaw-skill', ...nameTags])).slice(0, 8);

  // Some ClawHub skills use the full description as displayName — truncate to 100 chars
  const name = result.displayName.length > 100
    ? result.displayName.slice(0, 97) + '...'
    : result.displayName;

  return {
    slug: createSkillSlug(skillSlug),
    name,
    tagline,
    description,
    category,
    tags,
    // ClawHub skill pages use the slug as the canonical URL
    sourceUrl: `https://clawhub.ai/skills/${result.slug}`,
    docsUrl: undefined,
    publisher,
    installCmd: `openclaw plugins install ${result.slug}`,
    skillType: 'agent-tool',
    stars: 0,
    verified: false,
    submittedBy: 'clawhub-scraper',
  } as SkillEntryInput;
}
