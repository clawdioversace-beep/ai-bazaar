/**
 * src/services/packs.ts
 *
 * Service layer for starter pack queries.
 *
 * Provides functions to fetch starter packs with their associated tools.
 * All pack queries should go through this service to maintain consistent
 * data access patterns and enable future caching/optimization.
 */

import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { starterPacks, packTools } from '../db/schema';

/**
 * Fetch a single starter pack by slug with all its tools.
 *
 * Uses Drizzle's relational query API to load the pack with nested
 * pack_tools rows (ordered by `order` field), where each pack_tool
 * includes the full listing record for the tool.
 *
 * @param slug - URL-safe slug for the pack (e.g., "defi-dev-starter")
 * @returns Pack with tools array, or undefined if slug not found
 *
 * @example
 * ```ts
 * const pack = await getPackWithTools('ai-agent-toolbox');
 * if (pack) {
 *   console.log(pack.name);
 *   pack.tools.forEach(pt => {
 *     console.log(`${pt.order}. ${pt.tool.name} - ${pt.narrative}`);
 *   });
 * }
 * ```
 */
export async function getPackWithTools(slug: string) {
  return await db.query.starterPacks.findFirst({
    where: eq(starterPacks.slug, slug),
    with: {
      tools: {
        orderBy: [asc(packTools.order)],
        with: {
          tool: true,
        },
      },
    },
  });
}

/**
 * Fetch all starter packs for the browse page.
 *
 * Returns packs ordered by creation date (oldest first, since early
 * packs are likely to be highest quality/most curated).
 *
 * Does NOT include nested tools — browse page only needs pack metadata
 * (name, tagline, slug) for pack cards. Use getPackWithTools() for
 * the individual pack detail page.
 *
 * @returns Array of all packs (without tool details)
 *
 * @example
 * ```ts
 * const allPacks = await listPacks();
 * allPacks.forEach(pack => {
 *   console.log(`${pack.name} - ${pack.tagline}`);
 * });
 * ```
 */
export async function listPacks() {
  return await db.query.starterPacks.findMany({
    orderBy: [asc(starterPacks.createdAt)],
  });
}

/**
 * Fetch all starter packs with their tool count for homepage display.
 *
 * Returns packs with nested tools (just enough to count them and show
 * the pack description). Used on the homepage for the curated packs section.
 *
 * @returns Array of packs with tools array included
 */
export async function listPacksWithToolCount() {
  return await db.query.starterPacks.findMany({
    orderBy: [asc(starterPacks.createdAt)],
    with: {
      tools: {
        columns: { toolId: true },
      },
    },
  });
}
