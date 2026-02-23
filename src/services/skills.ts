/**
 * src/services/skills.ts
 *
 * SkillService — the ONLY valid write and read path for the skills table.
 *
 * Mirrors catalog.ts patterns exactly. All code that creates, updates,
 * reads, or browses skills MUST use these functions.
 */

import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client';
import { skills } from '../db/schema';
import type { NewSkill, Skill } from '../db/schema';
import { SkillEntrySchema } from '../lib/skill-schema';
import type { SkillEntryInput } from '../lib/skill-schema';

/**
 * Normalize a sourceUrl the same way SkillEntrySchema does.
 * Used internally to ensure upsertBySourceUrl lookup matches stored value.
 */
function normalizeSourceUrl(url: string): string {
  const parsed = new URL(url);
  const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  return normalized.replace(/\/$/, '') || normalized;
}

/**
 * Creates a new skill entry.
 *
 * Input is validated and normalized through SkillEntrySchema before insert.
 * Tags are deduplicated and lowercased. sourceUrl is normalized.
 *
 * @param input - Raw skill data
 * @returns The inserted record as stored in the database
 * @throws If input fails Zod validation or if slug/sourceUrl is already taken
 */
export async function createSkill(input: SkillEntryInput): Promise<NewSkill> {
  const entry = SkillEntrySchema.parse(input);

  const record: NewSkill = {
    id: entry.id ?? crypto.randomUUID(),
    slug: entry.slug,
    name: entry.name,
    tagline: entry.tagline,
    description: entry.description,
    category: entry.category,
    tags: JSON.stringify(entry.tags),
    sourceUrl: entry.sourceUrl,
    docsUrl: entry.docsUrl,
    licenseType: entry.licenseType,
    publisher: entry.publisher,
    installCmd: entry.installCmd,
    skillType: entry.skillType,
    stars: entry.stars,
    deadLink: entry.deadLink,
    verified: entry.verified,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(skills).values(record);
  return record;
}

/**
 * Retrieves a single skill by its URL-safe slug.
 */
export async function getSkillBySlug(slug: string): Promise<Skill | undefined> {
  return db.query.skills.findFirst({
    where: (s, { eq }) => eq(s.slug, slug),
  });
}

/**
 * Retrieves a single skill by its normalized sourceUrl.
 * Used for deduplication checks in the scraper pipeline.
 */
export async function getSkillBySourceUrl(url: string): Promise<Skill | undefined> {
  const normalized = normalizeSourceUrl(url);
  return db.query.skills.findFirst({
    where: (s, { eq }) => eq(s.sourceUrl, normalized),
  });
}

/**
 * Updates an existing skill by ID.
 * Only the provided fields are updated. updatedAt is always refreshed.
 */
export async function updateSkill(id: string, input: Partial<SkillEntryInput>): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (input.tags !== undefined) {
    const normalized = Array.from(
      new Set(input.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))
    );
    updates.tags = JSON.stringify(normalized);
  }

  if (input.name !== undefined) updates.name = input.name;
  if (input.slug !== undefined) updates.slug = input.slug;
  if (input.tagline !== undefined) updates.tagline = input.tagline;
  if (input.description !== undefined) updates.description = input.description;
  if (input.category !== undefined) updates.category = input.category;
  if (input.sourceUrl !== undefined) updates.sourceUrl = normalizeSourceUrl(input.sourceUrl);
  if (input.docsUrl !== undefined) updates.docsUrl = input.docsUrl;
  if (input.licenseType !== undefined) updates.licenseType = input.licenseType;
  if (input.publisher !== undefined) updates.publisher = input.publisher;
  if (input.installCmd !== undefined) updates.installCmd = input.installCmd;
  if (input.skillType !== undefined) updates.skillType = input.skillType;
  if (input.stars !== undefined) updates.stars = input.stars;
  if (input.verified !== undefined) updates.verified = input.verified;

  updates.updatedAt = new Date();

  await db.update(skills).set(updates).where(eq(skills.id, id));
}

/**
 * Upserts a skill by sourceUrl — updates if exists, creates if new.
 *
 * Preferred write method for scrapers: handles re-runs gracefully
 * without creating duplicate entries.
 *
 * @param input - Full skill data (validated through SkillEntrySchema)
 * @returns The skill record (either updated or newly created)
 */
export async function upsertSkillBySourceUrl(input: SkillEntryInput): Promise<NewSkill> {
  const normalizedUrl = normalizeSourceUrl(input.sourceUrl);

  const existing = await db.query.skills.findFirst({
    where: (s, { eq }) => eq(s.sourceUrl, normalizedUrl),
  });

  if (existing) {
    await updateSkill(existing.id, input);
    const updated = await db.query.skills.findFirst({
      where: (s, { eq }) => eq(s.id, existing.id),
    });
    return updated as NewSkill;
  }

  return createSkill(input);
}

/**
 * Browse parameters for the /skills page.
 */
export interface BrowseSkillsParams {
  /** Filter by skill category */
  category?: string;
  /** Sort: 'popular' (stars DESC) | 'recent' (createdAt DESC) */
  sort?: 'popular' | 'recent';
  /** Optional text search on name and tagline */
  query?: string;
  /** Maximum results to return (default 24) */
  limit?: number;
  /** Pagination offset (default 0) */
  offset?: number;
}

export interface BrowseSkillsResult {
  skills: Skill[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Browse skills with optional filters, sort, and pagination.
 *
 * Dead-linked skills are always excluded.
 *
 * @param params - Browse parameters
 * @returns Skills for the current page plus total count for pagination
 */
export async function browseSkills(params: BrowseSkillsParams): Promise<BrowseSkillsResult> {
  const { category, sort = 'popular', query, limit = 24, offset = 0 } = params;

  // Base query — exclude dead links
  let baseQuery = sql`SELECT s.* FROM skills s WHERE s.dead_link = 0`;

  if (category !== undefined) {
    baseQuery = sql`${baseQuery} AND s.category = ${category}`;
  }

  if (query !== undefined && query.trim() !== '') {
    const q = `%${query.trim()}%`;
    baseQuery = sql`${baseQuery} AND (s.name LIKE ${q} OR s.tagline LIKE ${q})`;
  }

  // Sort
  if (sort === 'recent') {
    baseQuery = sql`${baseQuery} ORDER BY s.created_at DESC`;
  } else {
    baseQuery = sql`${baseQuery} ORDER BY s.stars DESC, s.upvotes DESC`;
  }

  // Count first
  const countResult = await db.run(sql`SELECT COUNT(*) as count FROM (${baseQuery})`);
  const total = (countResult.rows[0] as any).count as number;

  // Paginate
  const dataResult = await db.run(sql`${baseQuery} LIMIT ${limit} OFFSET ${offset}`);

  return {
    skills: dataResult.rows as unknown as Skill[],
    total,
    limit,
    offset,
  };
}

/**
 * Returns the count of live skills per category.
 * Used for the CategoryNav on the /skills page.
 */
export async function countBySkillCategory(): Promise<Array<{ category: string; count: number }>> {
  const result = await db.run(
    sql`SELECT category, COUNT(*) as count FROM skills WHERE dead_link = 0 GROUP BY category ORDER BY count DESC`,
  );
  return result.rows as unknown as Array<{ category: string; count: number }>;
}

/**
 * Returns related skills in the same category.
 * Used for the "Related Skills" section on skill detail pages.
 */
export async function getRelatedSkills(
  skillId: string,
  category: string,
  limit = 4,
): Promise<Skill[]> {
  const result = await db.run(sql`
    SELECT *
    FROM skills
    WHERE dead_link = 0
    AND category = ${category}
    AND id != ${skillId}
    ORDER BY stars DESC
    LIMIT ${limit}
  `);
  return result.rows as unknown as Skill[];
}

/**
 * Returns top skills by stars, for homepage featured section.
 */
export async function getFeaturedSkills(limit = 6): Promise<Skill[]> {
  const result = await db.run(sql`
    SELECT * FROM skills
    WHERE dead_link = 0
    ORDER BY stars DESC
    LIMIT ${limit}
  `);
  return result.rows as unknown as Skill[];
}
