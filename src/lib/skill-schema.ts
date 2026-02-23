import { z } from 'zod';
import { SKILL_CATEGORIES } from './categories';

/**
 * SkillEntrySchema — validation contract for OpenClaw skills.
 *
 * ALL data entering the skills table MUST be parsed through this schema.
 * Mirrors CatalogEntrySchema (catalog-schema.ts) with skill-specific additions.
 *
 * Transforms applied at parse time:
 * - tags: lowercased, trimmed, deduplicated
 * - sourceUrl: trailing slash stripped, query params stripped
 */
export const SkillEntrySchema = z.object({
  /** UUID generated at insert time if not provided */
  id: z.string().uuid().optional(),

  /** URL-safe slug for the skill page, e.g. "alpha-finder" */
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens only'),

  /** Display name of the skill */
  name: z.string().min(1).max(100),

  /** Short description for cards (max 160 chars) */
  tagline: z.string().min(1).max(160),

  /** Full description supporting markdown (max 2000 chars) */
  description: z.string().min(1).max(2000),

  /** Canonical skill category */
  category: z.enum(SKILL_CATEGORIES),

  /** Tags — lowercased, trimmed, deduplicated at parse time */
  tags: z
    .array(z.string())
    .transform((tags) =>
      Array.from(new Set(tags.map((t) => t.toLowerCase().trim()).filter(Boolean)))
    ),

  /**
   * Canonical source URL — normalized at parse time.
   * Strips trailing slash, query params, and fragment.
   */
  sourceUrl: z.string().url().transform((url) => {
    const parsed = new URL(url);
    const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
    return normalized.replace(/\/$/, '') || normalized;
  }),

  /** Optional link to documentation */
  docsUrl: z.string().url().optional(),

  /** SPDX license identifier, e.g. "MIT" */
  licenseType: z.string().optional(),

  /** Skill publisher / author, e.g. "getfoundry" */
  publisher: z.string().optional(),

  /**
   * Install command for the skill.
   * e.g. "openclaw plugins install alpha-finder"
   */
  installCmd: z.string().optional(),

  /**
   * Skill type — what kind of capability it provides:
   * - 'agent-tool': extends agent actions (e.g. API calls, computations)
   * - 'api-wrapper': wraps a third-party API
   * - 'workflow': multi-step automation flow
   * - 'data-source': reads/queries external data
   * - 'other': miscellaneous
   */
  skillType: z.enum(['agent-tool', 'api-wrapper', 'workflow', 'data-source', 'other']).optional(),

  /** GitHub stars or equivalent popularity metric */
  stars: z.number().int().min(0).default(0),

  /** True if the sourceUrl returns 4xx — stale skill marker */
  deadLink: z.boolean().default(false),

  /** True if a human editor has reviewed and approved this skill */
  verified: z.boolean().default(false),
});

/** Output type — shape after all Zod transforms have been applied */
export type SkillEntry = z.infer<typeof SkillEntrySchema>;

/** Input type — raw shape before transforms (tags may have duplicates, URL may have params) */
export type SkillEntryInput = z.input<typeof SkillEntrySchema>;

/**
 * Generates a URL-safe slug from a skill name.
 *
 * @example
 * createSkillSlug('Alpha Finder') // → 'alpha-finder'
 * createSkillSlug('@getfoundry/unbrowse') // → 'getfoundry-unbrowse'
 */
export function createSkillSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);
}
