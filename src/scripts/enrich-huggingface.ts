/**
 * src/scripts/enrich-huggingface.ts
 *
 * Enrichment script for HuggingFace listings that were ingested with raw hex
 * hash IDs instead of real `owner/model` format IDs.
 *
 * The HF SDK occasionally returns 24-char hex strings as model IDs. This script:
 * 1. Finds all HF listings whose name is a hex hash
 * 2. Tries to resolve each hex ID via the HF REST API (models → spaces → datasets)
 * 3. If resolved: updates the listing with real metadata (name, slug, description, etc.)
 * 4. If all 3 API endpoints 404: marks the listing as a dead link
 *
 * Usage:
 *   bun run enrich-hf              # Uses file:./dev.db (via package.json script)
 *   bun src/scripts/enrich-huggingface.ts   # Direct invocation (requires TURSO_DATABASE_URL)
 *
 * Rate limiting: 200ms delay between API calls to avoid hitting HF rate limits.
 */

import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import { updateListing, markDeadLink } from '../services/catalog';
import { fetchWithRetry } from '../lib/fetch-with-retry';
import { isHexId } from '../scrapers/normalizers/huggingface-normalizer';
import { createSlug } from '../lib/catalog-schema';
import type { Listing } from '../db/schema';

/** 200ms pause between API calls */
const API_DELAY_MS = 200;

/** HF API base URL */
const HF_API_BASE = 'https://huggingface.co/api';

/**
 * Try to resolve a hex ID against a HuggingFace API endpoint.
 *
 * @param endpoint - One of 'models', 'spaces', 'datasets'
 * @param hexId - The raw hex hash to look up
 * @returns Parsed JSON response if found, null if 404 or error
 */
async function tryHfEndpoint(endpoint: string, hexId: string): Promise<Record<string, unknown> | null> {
  const url = `${HF_API_BASE}/${endpoint}/${hexId}`;
  try {
    const response = await fetchWithRetry(url, {}, { maxAttempts: 2, baseDelay: 500, timeout: 8000 });
    if (response.status === 404 || response.status === 410) {
      return null;
    }
    if (!response.ok) {
      return null;
    }
    return await response.json() as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Extract a real display name from an HF API response.
 *
 * Prefers `modelId` (set on model responses), falls back to `id`,
 * then to the last segment of the `id` field (after the slash).
 */
function extractName(data: Record<string, unknown>): string {
  const modelId = data.modelId ?? data.id;
  if (typeof modelId === 'string' && modelId.includes('/')) {
    // Return the model part (after the slash) as display name
    return modelId.split('/').slice(1).join('/') || modelId;
  }
  if (typeof modelId === 'string') {
    return modelId;
  }
  return String(data.id ?? 'unknown');
}

/**
 * Extract a description from an HF API response.
 *
 * Tries cardData.description, then description, then generates a minimal fallback.
 */
function extractDescription(data: Record<string, unknown>, realId: string): string {
  const cardData = data.cardData as Record<string, unknown> | undefined;
  const fromCard = typeof cardData?.description === 'string' ? cardData.description : null;
  const fromTop = typeof data.description === 'string' ? data.description : null;
  const desc = fromCard ?? fromTop ?? `HuggingFace model ${realId}`;
  // Truncate to schema max (2000 chars)
  return desc.slice(0, 2000);
}

/**
 * Extract tags from HF API response.
 */
function extractTags(data: Record<string, unknown>): string[] {
  const tags = data.tags;
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === 'string').slice(0, 50);
  }
  return [];
}

/**
 * Main enrichment loop.
 */
async function main(): Promise<void> {
  console.log('[enrich-hf] Starting HuggingFace hex ID enrichment...');

  // Find all HF listings whose name is a hex hash
  // Using the same GLOB pattern as the quality filter in search.ts
  const result = await db.run(sql`
    SELECT id, name, source_url
    FROM listings
    WHERE source_url LIKE 'https://huggingface.co/%'
    AND name GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'
  `);

  const listings = result.rows as unknown as Array<Pick<Listing, 'id' | 'name' | 'sourceUrl'>>;
  const total = listings.length;

  if (total === 0) {
    console.log('[enrich-hf] No hex ID listings found. Nothing to do.');
    return;
  }

  console.log(`[enrich-hf] Found ${total} hex ID listings to process.\n`);

  let enriched = 0;
  let dead = 0;
  let errors = 0;

  for (let i = 0; i < listings.length; i++) {
    const listing = listings[i];
    const hexId = listing.name;
    const current = i + 1;

    // Double-check it's actually a hex ID (defensive)
    if (!isHexId(hexId)) {
      console.log(`[enrich-hf] ${current}/${total}: ${hexId} -> SKIPPED (not a hex ID)`);
      continue;
    }

    try {
      // Try models endpoint first, then spaces, then datasets
      let data: Record<string, unknown> | null = null;
      let resolvedEndpoint: string | null = null;

      for (const endpoint of ['models', 'spaces', 'datasets']) {
        data = await tryHfEndpoint(endpoint, hexId);
        if (data !== null) {
          resolvedEndpoint = endpoint;
          break;
        }
        // Small delay between endpoint attempts
        await new Promise(r => setTimeout(r, API_DELAY_MS));
      }

      if (data === null) {
        // All 3 endpoints returned 404 — mark as dead link
        await markDeadLink(listing.id, true);
        dead++;
        console.log(`[enrich-hf] ${current}/${total}: ${hexId} -> DEAD`);
      } else {
        // Resolved — extract real metadata
        const realId = String(data.id ?? hexId);
        const name = extractName(data);
        const slug = createSlug(realId);
        const description = extractDescription(data, realId);
        const tagline = `HuggingFace ${resolvedEndpoint?.replace(/s$/, '') ?? 'model'}: ${realId}`.slice(0, 160);
        const tags = extractTags(data);
        const stars = typeof data.likes === 'number' ? data.likes : 0;
        const downloads = typeof data.downloads === 'number' ? data.downloads : 0;
        const sourceUrl = `https://huggingface.co/${realId}`;

        await updateListing(listing.id, {
          name,
          slug,
          tagline,
          description,
          sourceUrl,
          stars,
          downloads,
          tags,
        });

        enriched++;
        console.log(`[enrich-hf] ${current}/${total}: ${hexId} -> ${realId}`);
      }
    } catch (err) {
      errors++;
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[enrich-hf] ${current}/${total}: ${hexId} -> ERROR: ${message}`);
    }

    // Rate limit delay after each listing (except the last)
    if (i < listings.length - 1) {
      await new Promise(r => setTimeout(r, API_DELAY_MS));
    }
  }

  console.log(`\n[enrich-hf] Done: ${enriched} enriched, ${dead} marked dead, ${errors} errors out of ${total} total`);
}

main().catch((err) => {
  console.error('[enrich-hf] Fatal error:', err);
  process.exit(1);
});
