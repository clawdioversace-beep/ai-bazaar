/**
 * src/scripts/embed-listings.ts
 *
 * Batch-embed all verified listings into Pinecone for semantic search.
 *
 * Run: bun run embed:listings
 *
 * - Fetches all verified listings from the DB
 * - Embeds name + tagline + tags using Pinecone's multilingual-e5-large model
 * - Upserts vectors with metadata (slug, name, category, stars, downloads, hypeScore)
 * - Safe to re-run — upsert overwrites existing vectors by ID
 *
 * Batch size: 96 (Pinecone inference limit is 96/batch)
 */

import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import { listings } from '@/db/schema';
import { getPineconeIndex, embedTexts } from '@/lib/pinecone';

const BATCH_SIZE = 96;

async function main() {
  if (!process.env.PINECONE_API_KEY) {
    console.error('PINECONE_API_KEY is not set');
    process.exit(1);
  }

  const client = createClient({
    url: process.env.TURSO_DATABASE_URL ?? 'file:./dev.db',
    authToken: process.env.TURSO_AUTH_TOKEN,
  });
  const db = drizzle(client);

  console.log('Fetching all listings from DB...');
  const allListings = await db
    .select({
      id: listings.id,
      slug: listings.slug,
      name: listings.name,
      tagline: listings.tagline,
      tags: listings.tags,
      category: listings.category,
      stars: listings.stars,
      downloads: listings.downloads,
      hypeScore: listings.hypeScore,
      sourceUrl: listings.sourceUrl,
    })
    .from(listings);

  console.log(`Found ${allListings.length} verified listings`);

  const index = await getPineconeIndex();
  if (!index) {
    console.error('Failed to get Pinecone index');
    process.exit(1);
  }

  let embedded = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < allListings.length; i += BATCH_SIZE) {
    const batch = allListings.slice(i, i + BATCH_SIZE);

    // Build embedding text: name + tagline + tags
    const items = batch.map((l) => {
      let tags: string[] = [];
      try {
        tags = JSON.parse(l.tags ?? '[]');
      } catch {
        // ignore
      }
      const tagStr = tags.length > 0 ? ` Tags: ${tags.join(', ')}.` : '';
      return {
        id: l.id,
        text: `${l.name}. ${l.tagline}.${tagStr}`,
      };
    });

    const vectors = await embedTexts(items);

    if (vectors.length === 0) {
      console.error(`Batch ${i / BATCH_SIZE + 1}: embedding failed, skipping`);
      failed += batch.length;
      continue;
    }

    // Upsert vectors with metadata
    const records = vectors.map((v, idx) => {
      const l = batch[idx];
      return {
        id: v.id,
        values: v.values,
        metadata: {
          slug: l.slug,
          name: l.name,
          tagline: l.tagline,
          category: l.category,
          stars: l.stars ?? 0,
          downloads: l.downloads ?? 0,
          hypeScore: l.hypeScore ?? 0,
          sourceUrl: l.sourceUrl,
        },
      };
    });

    try {
      await index.upsert({ records });
      embedded += records.length;
      const pct = Math.round((embedded / allListings.length) * 100);
      process.stdout.write(`\r${embedded}/${allListings.length} embedded (${pct}%)`);
    } catch (err) {
      console.error(`\nBatch upsert failed:`, err);
      failed += batch.length;
    }
  }

  console.log(`\n\nDone!`);
  console.log(`  Embedded: ${embedded}`);
  if (failed > 0) console.log(`  Failed:   ${failed}`);

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
