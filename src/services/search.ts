/**
 * src/services/search.ts
 *
 * SearchService — the ONLY valid read path for search and browsing queries.
 *
 * All code that searches or browses catalog entries MUST go through these
 * functions. API routes and MCP tools are consumers — they never write
 * raw SQL or query the database directly.
 *
 * FTS5 notes:
 * - listings_fts is an external content table backed by the listings table
 * - The rank column is an alias for bm25() — lower (more negative) = more relevant
 * - ORDER BY rank ASC returns best matches first
 * - FTS5 sync is maintained by INSERT/UPDATE/DELETE triggers on listings
 * - After bulk inserts that bypass triggers, call rebuildFtsIndex()
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { listings } from '../db/schema';
import type { Listing } from '../db/schema';

/**
 * Parameters for full-text catalog search.
 *
 * All fields are optional except `query`. Filters are applied as AND conditions.
 */
export interface SearchParams {
  /** FTS5 MATCH query string, e.g. "claude mcp" or "defi tool" */
  query: string;
  /** Filter to a specific canonical category, e.g. "mcp-server" */
  category?: string;
  /** Filter to listings that have ALL of these tags (AND, not OR) */
  tags?: string[];
  /** Filter to listings that implement the Model Context Protocol */
  mcpCompatible?: boolean;
  /** Maximum results to return (default 20) */
  limit?: number;
  /** Pagination offset (default 0) */
  offset?: number;
}

/**
 * Performs full-text search against the FTS5 index with optional filters.
 *
 * Uses FTS5 BM25 ranking — results are ordered by relevance (best first).
 * Dead links are always excluded from results.
 *
 * FTS5 rank column: lower (more negative) values = more relevant.
 * ORDER BY rank ASC = best matches first.
 *
 * @param params - Search parameters with query and optional filters
 * @returns Array of matching listings ordered by BM25 relevance
 */
export async function searchCatalog(params: SearchParams): Promise<Listing[]> {
  const { query, category, tags, mcpCompatible, limit = 20, offset = 0 } = params;

  // Build SQL with conditional fragments
  // FTS5 MATCH query + dead_link exclusion are always applied
  // Category, mcpCompatible, and tag filters are conditional
  let sqlQuery = sql`
    SELECT l.*
    FROM listings_fts
    JOIN listings l ON listings_fts.rowid = l.rowid
    WHERE listings_fts MATCH ${query}
    AND l.dead_link = 0
  `;

  if (category !== undefined) {
    sqlQuery = sql`${sqlQuery} AND l.category = ${category}`;
  }

  if (mcpCompatible === true) {
    sqlQuery = sql`${sqlQuery} AND l.mcp_compatible = 1`;
  }

  if (tags && tags.length > 0) {
    // JSON contains check: each tag must appear as an exact JSON string value
    // e.g. for tag "mcp-server": l.tags LIKE '%"mcp-server"%'
    // This is safe for our controlled tag taxonomy (<5k rows, no SQL injection from normalizedTag)
    for (const tag of tags) {
      const pattern = `%"${tag}"%`;
      sqlQuery = sql`${sqlQuery} AND l.tags LIKE ${pattern}`;
    }
  }

  sqlQuery = sql`${sqlQuery} ORDER BY listings_fts.rank LIMIT ${limit} OFFSET ${offset}`;

  const result = await db.run(sqlQuery);
  return result.rows as unknown as Listing[];
}

/**
 * Returns all listings in a given category, sorted by stars descending.
 *
 * This is the category browsing view (CAT-04) — sorted by popularity rather
 * than relevance. Dead links are always excluded.
 *
 * @param category - Canonical category slug, e.g. "mcp-server", "ai-agent"
 * @param limit - Maximum results to return (default 20)
 * @param offset - Pagination offset (default 0)
 * @returns Listings in the category, sorted by stars desc
 */
export async function browseByCategory(
  category: string,
  limit = 20,
  offset = 0,
): Promise<Listing[]> {
  return db.query.listings.findMany({
    where: (l, { eq, and }) => and(eq(l.category, category), eq(l.deadLink, false)),
    limit,
    offset,
    orderBy: (l, { desc }) => [desc(l.stars)],
  }) as Promise<Listing[]>;
}

/**
 * Returns the count of live (non-dead) listings per category.
 *
 * Useful for category navigation UI to show entry counts next to each category.
 * Results are ordered by count descending (most populated category first).
 *
 * @returns Array of { category, count } sorted by count desc
 */
export async function countByCategory(): Promise<Array<{ category: string; count: number }>> {
  const result = await db.run(
    sql`SELECT category, COUNT(*) as count FROM listings WHERE dead_link = 0 GROUP BY category ORDER BY count DESC`,
  );
  return result.rows as unknown as Array<{ category: string; count: number }>;
}

/**
 * Rebuilds the FTS5 index from the current listings table contents.
 *
 * Call this after any bulk insert operation that bypasses the FTS5 sync
 * triggers (e.g. raw SQL batch inserts, drizzle-kit migrations with data).
 *
 * Normal single-row inserts via CatalogService.createListing() do NOT need
 * this — the INSERT trigger handles those automatically.
 *
 * Scrapers doing batch inserts should call this once after all rows are loaded.
 */
export async function rebuildFtsIndex(): Promise<void> {
  await db.run(sql`INSERT INTO listings_fts(listings_fts) VALUES('rebuild')`);
}
