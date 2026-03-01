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
    sql`SELECT category, COUNT(*) as count FROM listings WHERE dead_link = 0
    AND name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'
    GROUP BY category ORDER BY count DESC`,
  );
  return result.rows as unknown as Array<{ category: string; count: number }>;
}

/**
 * Returns top listings sorted by stars (for featured/homepage sections).
 *
 * Dead links are always excluded. Results are sorted by stars descending
 * to show the most popular tools first.
 *
 * @param limit - Maximum results to return (default 6)
 * @returns Top listings by stars, dead links excluded
 */
export async function getFeaturedListings(limit = 6): Promise<Listing[]> {
  const result = await db.run(sql`
    SELECT *
    FROM listings
    WHERE dead_link = 0
    AND name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'
    ORDER BY stars DESC
    LIMIT ${limit}
  `);
  return result.rows as unknown as Listing[];
}

/**
 * Returns quality-filtered listings created within the last 7 days.
 *
 * Used for "New This Week" homepage section. Applies quality filters to
 * exclude hex ID names, empty descriptions, and templated placeholder
 * descriptions that slip through the scraper. Dead links are always excluded.
 *
 * Timestamps are stored as Unix seconds (INTEGER), not Date objects.
 * Quality filters:
 * - name != '' (not empty)
 * - name NOT GLOB hex pattern (not a 20+ char hex string)
 * - LENGTH(description) >= 10 (meaningful description)
 * - description NOT LIKE 'HuggingFace model %' (not a templated placeholder)
 *
 * @param limit - Maximum results to return (default 12)
 * @returns Quality listings created in the last 7 days, newest first
 */
export async function getNewThisWeek(limit = 12): Promise<Listing[]> {
  // Timestamps stored as Unix seconds — compute cutoff in seconds
  const sevenDaysAgoUnix = Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60;

  const result = await db.run(sql`
    SELECT *
    FROM listings
    WHERE dead_link = 0
    AND created_at >= ${sevenDaysAgoUnix}
    AND name != ''
    AND name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'
    AND LENGTH(description) >= 10
    AND description NOT LIKE 'HuggingFace model %'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return result.rows as unknown as Listing[];
}

/**
 * Returns quality-filtered listings regardless of date, for use as a fallback
 * when fewer than 6 new-this-week listings pass quality filters.
 *
 * Applies the same quality filters as getNewThisWeek minus the date constraint.
 * Dead links are always excluded. Results are sorted newest first.
 *
 * @param limit - Maximum results to return (default 12)
 * @returns Most recent quality listings, newest first
 */
export async function getRecentlyAdded(limit = 12): Promise<Listing[]> {
  const result = await db.run(sql`
    SELECT *
    FROM listings
    WHERE dead_link = 0
    AND name != ''
    AND name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'
    AND LENGTH(description) >= 10
    AND description NOT LIKE 'HuggingFace model %'
    ORDER BY created_at DESC
    LIMIT ${limit}
  `);

  return result.rows as unknown as Listing[];
}

/**
 * Parameters for browsing catalog listings.
 *
 * All fields are optional. Filters are applied as AND conditions.
 */
export interface BrowseParams {
  /** Filter to a specific canonical category, e.g. "mcp-server" */
  category?: string;
  /** Filter by chainSupport JSON containing this chain */
  chain?: string;
  /** Filter by runtime column */
  runtime?: string;
  /** Filter by protocol: 'mcp' | 'acp' */
  protocol?: 'mcp' | 'acp';
  /** Sort order: 'recent' (createdAt DESC), 'popular' (stars+downloads DESC), or 'trending' (hype_score DESC) */
  sort?: 'recent' | 'popular' | 'trending';
  /** Optional text search query */
  query?: string;
  /** Maximum results to return (default 24) */
  limit?: number;
  /** Pagination offset (default 0) */
  offset?: number;
}

/**
 * Result from browsing catalog listings.
 *
 * Includes total count for pagination UI.
 */
export interface BrowseResult {
  /** Matching listings for current page */
  listings: Listing[];
  /** Total matching count (all pages) */
  total: number;
  /** Limit used in this query */
  limit: number;
  /** Offset used in this query */
  offset: number;
}

/**
 * Browse catalog listings with filters, sorting, and pagination.
 *
 * This is the primary browse function for /tools page. Supports:
 * - Multi-filter (category, chain, runtime, protocol)
 * - Text search (optional)
 * - Sort by recency or popularity
 * - Pagination with total count
 *
 * Dead links are always excluded from results.
 *
 * @param params - Browse parameters with optional filters and pagination
 * @returns BrowseResult with listings and pagination info
 */
export async function browseListings(params: BrowseParams): Promise<BrowseResult> {
  const {
    category,
    chain,
    runtime,
    protocol,
    sort = 'popular',
    query,
    limit = 24,
    offset = 0,
  } = params;

  // Build SQL query using sql`` template for proper parameter binding
  // Start with base query — exclude dead links and hex ID listings
  let baseQuery = sql`SELECT l.* FROM listings l WHERE l.dead_link = 0
    AND l.name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'`;

  // Add filters
  if (category !== undefined) {
    baseQuery = sql`${baseQuery} AND l.category = ${category}`;
  }

  if (chain !== undefined) {
    // Use LIKE for JSON array contains check
    const chainPattern = `%"${chain}"%`;
    baseQuery = sql`${baseQuery} AND l.chain_support LIKE ${chainPattern}`;
  }

  if (runtime !== undefined) {
    baseQuery = sql`${baseQuery} AND l.runtime = ${runtime}`;
  }

  if (protocol === 'mcp') {
    baseQuery = sql`${baseQuery} AND l.mcp_compatible = 1`;
  } else if (protocol === 'acp') {
    baseQuery = sql`${baseQuery} AND l.acp_compatible = 1`;
  }

  if (query !== undefined && query.trim() !== '') {
    // Use FTS5 for text search
    baseQuery = sql`
      SELECT l.*
      FROM listings_fts
      JOIN listings l ON listings_fts.rowid = l.rowid
      WHERE listings_fts MATCH ${query}
      AND l.dead_link = 0
      AND l.name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'
    `;
    // Re-apply filters after FTS join
    if (category !== undefined) {
      baseQuery = sql`${baseQuery} AND l.category = ${category}`;
    }
    if (chain !== undefined) {
      const chainPattern = `%"${chain}"%`;
      baseQuery = sql`${baseQuery} AND l.chain_support LIKE ${chainPattern}`;
    }
    if (runtime !== undefined) {
      baseQuery = sql`${baseQuery} AND l.runtime = ${runtime}`;
    }
    if (protocol === 'mcp') {
      baseQuery = sql`${baseQuery} AND l.mcp_compatible = 1`;
    } else if (protocol === 'acp') {
      baseQuery = sql`${baseQuery} AND l.acp_compatible = 1`;
    }
  }

  // Build ORDER BY clause
  if (sort === 'recent') {
    baseQuery = sql`${baseQuery} ORDER BY l.created_at DESC`;
  } else if (sort === 'trending') {
    baseQuery = sql`${baseQuery} ORDER BY l.hype_score DESC NULLS LAST, l.stars DESC`;
  } else {
    // popular (default)
    baseQuery = sql`${baseQuery} ORDER BY l.stars DESC, l.downloads DESC`;
  }

  // Get total count first (same query without LIMIT/OFFSET)
  const countQuery = sql`SELECT COUNT(*) as count FROM (${baseQuery})`;
  const countResult = await db.run(countQuery);
  const total = (countResult.rows[0] as any).count as number;

  // Add pagination
  const dataQuery = sql`${baseQuery} LIMIT ${limit} OFFSET ${offset}`;
  const dataResult = await db.run(dataQuery);

  return {
    listings: dataResult.rows as unknown as Listing[],
    total,
    limit,
    offset,
  };
}

/**
 * Get distinct filter options for dropdowns.
 *
 * Returns unique chains and runtimes from non-dead listings.
 *
 * @returns Object with arrays of chain and runtime values
 */
export async function getFilterOptions(): Promise<{
  chains: string[];
  runtimes: string[];
}> {
  // Get distinct runtimes
  const runtimeResult = await db.run(
    sql`SELECT DISTINCT runtime FROM listings WHERE dead_link = 0 AND runtime IS NOT NULL ORDER BY runtime`,
  );
  const runtimes = runtimeResult.rows.map((row: any) => row.runtime as string);

  // Get distinct chains from chainSupport JSON
  const chainResult = await db.run(
    sql`SELECT DISTINCT chain_support FROM listings WHERE dead_link = 0 AND chain_support IS NOT NULL`,
  );

  // Parse JSON arrays and collect unique values
  const chainSet = new Set<string>();
  for (const row of chainResult.rows) {
    const chainSupport = (row as any).chain_support;
    if (chainSupport) {
      try {
        const chains = JSON.parse(chainSupport) as string[];
        for (const chain of chains) {
          chainSet.add(chain);
        }
      } catch (e) {
        // Skip invalid JSON
      }
    }
  }

  const chains = Array.from(chainSet).sort();

  return {
    chains,
    runtimes,
  };
}

/**
 * Returns top listings by hype score for the Trending section.
 *
 * Only returns listings with a non-zero hype score.
 * Dead links are always excluded.
 *
 * @param limit - Maximum results to return (default 6)
 * @returns Top listings sorted by hype_score descending
 */
export async function getTrendingListings(limit = 6): Promise<Listing[]> {
  const result = await db.run(sql`
    SELECT *
    FROM listings
    WHERE dead_link = 0
    AND hype_score > 0
    AND name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'
    ORDER BY hype_score DESC
    LIMIT ${limit}
  `);
  return result.rows as unknown as Listing[];
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

/**
 * Returns related listings for a given tool.
 *
 * Finds listings in the same category, excluding the current tool.
 * Sorted by stars descending to show the most popular related tools.
 *
 * @param listingId - ID of the current listing to exclude
 * @param category - Category to match on
 * @param limit - Maximum results (default 4)
 * @returns Related listings sorted by popularity
 */
export async function getRelatedListings(
  listingId: string,
  category: string,
  limit = 4,
): Promise<Listing[]> {
  const result = await db.run(sql`
    SELECT *
    FROM listings
    WHERE dead_link = 0
    AND category = ${category}
    AND id != ${listingId}
    ORDER BY hype_score DESC NULLS LAST, stars DESC
    LIMIT ${limit}
  `);
  return result.rows as unknown as Listing[];
}
