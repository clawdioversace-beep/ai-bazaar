/**
 * src/services/catalog.ts
 *
 * CatalogService — the ONLY valid write path to the listings database.
 *
 * ALL code that creates, updates, or deletes catalog entries MUST go through
 * these functions. API routes, scrapers, and MCP tools are consumers — they
 * never touch the database directly or write raw SQL.
 *
 * Data integrity guarantees enforced here:
 * - Tags are normalized via CatalogEntrySchema (dedup + canonical form)
 * - sourceUrl is normalized (strips query params + hash) before insert/lookup
 * - JSON arrays (tags, chainSupport) are serialized/deserialized at the boundary
 * - Timestamps (createdAt, updatedAt) are always set correctly
 * - FTS5 sync is handled automatically via DB triggers
 */

import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { listings } from '../db/schema';
import type { NewListing } from '../db/schema';
import { CatalogEntrySchema } from '../lib/catalog-schema';
import type { CatalogEntryInput } from '../lib/catalog-schema';
import { normalizeTag } from '../lib/tags';

/**
 * Normalize a sourceUrl the same way CatalogEntrySchema does.
 * Used internally to ensure upsertBySourceUrl lookup matches the stored value.
 *
 * Strips query params, hash, and trailing slash from a URL.
 * e.g. "https://github.com/org/repo/?ref=ph" → "https://github.com/org/repo"
 */
function normalizeSourceUrl(url: string): string {
  const parsed = new URL(url);
  const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`;
  return normalized.replace(/\/$/, '') || normalized;
}

/**
 * Creates a new catalog listing.
 *
 * Input is validated and normalized through CatalogEntrySchema before insert.
 * Tags are deduplicated and mapped to canonical forms. sourceUrl is normalized
 * to prevent duplicates from URL variants pointing to the same resource.
 *
 * @param input - Raw listing data (tags may have variants, URL may have params)
 * @returns The inserted record as stored in the database
 * @throws If input fails Zod validation or if slug/sourceUrl is already taken
 */
export async function createListing(input: CatalogEntryInput): Promise<NewListing> {
  const entry = CatalogEntrySchema.parse(input);

  const record: NewListing = {
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
    runtime: entry.runtime,
    chainSupport: entry.chainSupport ? JSON.stringify(entry.chainSupport) : null,
    mcpCompatible: entry.mcpCompatible,
    acpCompatible: entry.acpCompatible,
    stars: entry.stars,
    downloads: entry.downloads,
    lastVerifiedAt: entry.lastVerifiedAt,
    deadLink: entry.deadLink,
    submittedBy: entry.submittedBy,
    verified: entry.verified,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await db.insert(listings).values(record);
  return record;
}

/**
 * Retrieves a single listing by its UUID primary key.
 *
 * @param id - UUID of the listing
 * @returns The listing record, or undefined if not found
 */
export async function getListingById(id: string) {
  return db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.id, id),
  });
}

/**
 * Retrieves a single listing by its URL-safe slug.
 *
 * @param slug - URL slug, e.g. "anthropic-claude-mcp"
 * @returns The listing record, or undefined if not found
 */
export async function getListingBySlug(slug: string) {
  return db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.slug, slug),
  });
}

/**
 * Retrieves a single listing by its normalized sourceUrl.
 *
 * Used for deduplication checks in submission forms and import pipelines.
 * The URL is normalized using the same logic as CatalogEntrySchema to ensure
 * lookup matches the stored value.
 *
 * @param url - Source URL to look up (will be normalized automatically)
 * @returns The listing record, or undefined if not found
 */
export async function getListingBySourceUrl(url: string) {
  const normalized = normalizeSourceUrl(url);
  return db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.sourceUrl, normalized),
  });
}

/**
 * Updates an existing listing by ID.
 *
 * Only the fields provided in `input` are updated. Tags are re-normalized if
 * provided. updatedAt is always set to the current time.
 *
 * Note: This does NOT go through CatalogEntrySchema.parse() because input is
 * partial — instead, normalization is applied field-by-field for tag arrays.
 *
 * @param id - UUID of the listing to update
 * @param input - Partial listing fields to update
 */
export async function updateListing(id: string, input: Partial<CatalogEntryInput>): Promise<void> {
  const updates: Record<string, unknown> = {};

  if (input.tags !== undefined) {
    const normalized = Array.from(new Set(input.tags.map(normalizeTag)));
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
  if (input.runtime !== undefined) updates.runtime = input.runtime;
  if (input.chainSupport !== undefined) updates.chainSupport = JSON.stringify(input.chainSupport);
  if (input.mcpCompatible !== undefined) updates.mcpCompatible = input.mcpCompatible;
  if (input.acpCompatible !== undefined) updates.acpCompatible = input.acpCompatible;
  if (input.stars !== undefined) updates.stars = input.stars;
  if (input.downloads !== undefined) updates.downloads = input.downloads;
  if (input.submittedBy !== undefined) updates.submittedBy = input.submittedBy;
  if (input.verified !== undefined) updates.verified = input.verified;

  updates.updatedAt = new Date();

  await db.update(listings).set(updates).where(eq(listings.id, id));
}

/**
 * Upserts a listing by sourceUrl — updates if exists, creates if new.
 *
 * Uses normalized sourceUrl as the dedup key. This is the preferred write
 * method for scrapers and importers that may encounter the same tool multiple
 * times across runs.
 *
 * @param input - Full listing data (will be validated through CatalogEntrySchema)
 * @returns The listing record (either updated or newly created)
 */
export async function upsertBySourceUrl(input: CatalogEntryInput): Promise<NewListing> {
  // Normalize URL the same way the schema does, so the lookup matches stored value
  const normalizedUrl = normalizeSourceUrl(input.sourceUrl);

  const existing = await db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.sourceUrl, normalizedUrl),
  });

  if (existing) {
    await updateListing(existing.id, input);
    // Return updated record by re-fetching (updateListing returns void)
    const updated = await getListingById(existing.id);
    return updated as NewListing;
  }

  return createListing(input);
}

/**
 * Updates ONLY the dead-link flag and last-verified timestamp for a listing.
 *
 * This is the correct way to record health check results (CAT-06, CAT-07).
 * It does NOT modify any other fields — name, tags, description, etc. are
 * untouched so manual edits are never overwritten by health checks.
 *
 * @param id - UUID of the listing to update
 * @param isDead - true if the sourceUrl returned 404/410, false otherwise
 */
export async function markDeadLink(id: string, isDead: boolean): Promise<void> {
  await db.update(listings).set({
    deadLink: isDead,
    lastVerifiedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(listings.id, id));
}

/**
 * Performs a HEAD request to check if a URL returns a definitive dead-link response.
 *
 * Returns true (dead) ONLY for HTTP 404 or 410 responses. All other status codes
 * (including 403, 405, 5xx) return false — these are inconclusive (the server may
 * be temporarily unavailable, or may not support HEAD). This prevents false positives
 * from servers that disallow HEAD requests.
 *
 * Per research Pitfall 5: Do not treat 403 or 5xx as definitively dead.
 *
 * Uses manual AbortController + setTimeout (NOT AbortSignal.timeout()) due to a
 * known Bun bug where AbortSignal.timeout() does not abort fetch correctly.
 *
 * @param sourceUrl - The URL to check
 * @returns true if URL is definitively dead (404/410), false if alive or inconclusive
 */
export async function checkDeadLink(sourceUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const response = await fetch(sourceUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    // Only 404 and 410 are definitively dead — other errors are inconclusive
    return response.status === 404 || response.status === 410;
  } catch {
    // Network error, timeout, or abort — treat as inconclusive (not dead)
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Returns a paginated list of all listings, newest first.
 *
 * Intended for admin dashboards and debug tooling. Not for public search —
 * use SearchService.searchCatalog() and SearchService.browseByCategory() instead.
 *
 * @param limit - Maximum results to return (default 50)
 * @param offset - Pagination offset (default 0)
 */
export async function getAllListings(limit = 50, offset = 0) {
  return db.query.listings.findMany({
    limit,
    offset,
    orderBy: (l, { desc }) => [desc(l.createdAt)],
  });
}
