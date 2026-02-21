/**
 * src/lib/pinecone.ts
 *
 * Pinecone vector database client for semantic search.
 *
 * Uses Pinecone's built-in inference API (multilingual-e5-large, 768 dims)
 * to embed tool descriptions — no separate embedding API needed.
 *
 * Free tier: 5M vectors, 1M reads/month, 5M embedding tokens/month.
 * Falls back gracefully when PINECONE_API_KEY is not set.
 */

import { Pinecone } from '@pinecone-database/pinecone';

export const INDEX_NAME = process.env.PINECONE_INDEX_NAME ?? 'ai-bazaar-tools';

/** Embedding model — 768 dims, multilingual, included in Pinecone free tier */
export const EMBED_MODEL = 'multilingual-e5-large';

/** Pinecone client — undefined if API key is not configured */
export const pinecone = process.env.PINECONE_API_KEY
  ? new Pinecone({ apiKey: process.env.PINECONE_API_KEY })
  : null;

/**
 * Get the Pinecone index, ensuring it exists.
 * Creates the index with serverless spec if it doesn't exist yet.
 */
export async function getPineconeIndex() {
  if (!pinecone) return null;

  try {
    const { indexes } = await pinecone.listIndexes();
    const exists = indexes?.some((idx) => idx.name === INDEX_NAME);

    if (!exists) {
      await pinecone.createIndex({
        name: INDEX_NAME,
        dimension: 1024,
        metric: 'cosine',
        spec: {
          serverless: {
            cloud: 'aws',
            region: 'us-east-1',
          },
        },
      });

      // Wait for index to be ready (up to 60s)
      for (let i = 0; i < 12; i++) {
        await new Promise((r) => setTimeout(r, 5000));
        const description = await pinecone.describeIndex(INDEX_NAME);
        if (description.status?.ready) break;
      }
    }

    return pinecone.index(INDEX_NAME);
  } catch (err) {
    console.error('[pinecone] Failed to get index:', err);
    return null;
  }
}

/**
 * Embed a batch of texts using Pinecone's inference API.
 * Returns an array of { id, values } records for upsert.
 */
export async function embedTexts(
  items: Array<{ id: string; text: string }>
): Promise<Array<{ id: string; values: number[] }>> {
  if (!pinecone) return [];

  try {
    const result = await pinecone.inference.embed({
      model: EMBED_MODEL,
      inputs: items.map((item) => item.text),
      parameters: { inputType: 'passage', truncate: 'END' },
    });

    return items.map((item, i) => {
      const embedding = result.data[i];
      const values = embedding && 'values' in embedding ? embedding.values : [];
      return { id: item.id, values };
    });
  } catch (err) {
    console.error('[pinecone] Embedding failed:', err);
    return [];
  }
}

/**
 * Embed a single query string for similarity search.
 */
export async function embedQuery(text: string): Promise<number[] | null> {
  if (!pinecone) return null;

  try {
    const result = await pinecone.inference.embed({
      model: EMBED_MODEL,
      inputs: [text],
      parameters: { inputType: 'query', truncate: 'END' },
    });

    const embedding = result.data[0];
    return embedding && 'values' in embedding ? embedding.values : null;
  } catch (err) {
    console.error('[pinecone] Query embedding failed:', err);
    return null;
  }
}
