import { db } from '@/db/client';
import { reads, type NewRead } from '@/db/schema';
import { desc, eq, sql } from 'drizzle-orm';

/**
 * Get recent reads, sorted by createdAt DESC.
 * Used on homepage and as fallback when no featured reads exist.
 */
export async function getRecentReads(limit: number = 6) {
  return db
    .select()
    .from(reads)
    .orderBy(desc(reads.createdAt))
    .limit(limit);
}

/**
 * Get featured reads for homepage display.
 * Falls back to recent reads if none are featured.
 */
export async function getFeaturedReads(limit: number = 3) {
  const featured = await db
    .select()
    .from(reads)
    .where(eq(reads.featured, true))
    .orderBy(desc(reads.createdAt))
    .limit(limit);

  if (featured.length > 0) return featured;

  // Fallback to most recent
  return getRecentReads(limit);
}

/**
 * Browse reads with optional category and tag filters + pagination.
 */
export async function browseReads({
  category,
  tag,
  limit = 20,
  offset = 0,
}: {
  category?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}) {
  const conditions: ReturnType<typeof eq>[] = [];

  if (category) {
    conditions.push(eq(reads.category, category));
  }

  const where = conditions.length > 0
    ? conditions.reduce((acc, cond) => sql`${acc} AND ${cond}`)
    : undefined;

  // If tag filter, use LIKE on JSON tags field
  const tagCondition = tag
    ? sql`json_each.value = ${tag}`
    : undefined;

  if (tag) {
    // Query with tag filter via json_each
    const items = await db.all(sql`
      SELECT DISTINCT r.* FROM reads r, json_each(r.tags)
      WHERE json_each.value = ${tag}
      ${category ? sql`AND r.category = ${category}` : sql``}
      ORDER BY r.created_at DESC
      LIMIT ${limit} OFFSET ${offset}
    `);

    const countResult = await db.all<{ total: number }>(sql`
      SELECT COUNT(DISTINCT r.id) as total FROM reads r, json_each(r.tags)
      WHERE json_each.value = ${tag}
      ${category ? sql`AND r.category = ${category}` : sql``}
    `);

    return {
      reads: items as typeof reads.$inferSelect[],
      total: countResult[0]?.total ?? 0,
    };
  }

  // Query without tag filter
  const items = await db
    .select()
    .from(reads)
    .where(where)
    .orderBy(desc(reads.createdAt))
    .limit(limit)
    .offset(offset);

  const countQuery = category
    ? db.select({ count: sql<number>`count(*)` }).from(reads).where(eq(reads.category, category))
    : db.select({ count: sql<number>`count(*)` }).from(reads);

  const countResult = await countQuery;

  return {
    reads: items,
    total: countResult[0]?.count ?? 0,
  };
}

/**
 * Insert a new read entry.
 */
export async function createRead(input: NewRead) {
  await db.insert(reads).values(input);
}
