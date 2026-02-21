/**
 * src/services/nl-search.ts
 *
 * Natural Language Search orchestration.
 *
 * Pipeline: User query → Intent extraction (Groq 8B) → Pinecone semantic search
 *           (falls back to FTS5 if Pinecone is unavailable) → Context building
 *
 * The synthesis step (Groq 70B streaming) happens in the API route via Vercel AI SDK
 * streamText. This service handles everything up to building the context for synthesis.
 */

import { generateText } from 'ai';
import { groq, INTENT_MODEL, INTENT_SYSTEM_PROMPT } from '@/lib/ai';
import { searchCatalog, browseListings } from '@/services/search';
import type { Listing } from '@/db/schema';
import { CATEGORY_LABELS } from '@/lib/categories';
import type { Category } from '@/lib/categories';
import { getPineconeIndex, embedQuery } from '@/lib/pinecone';

/** Parsed intent from user query */
export interface SearchIntent {
  keywords: string;
  category: string | null;
  chain: string | null;
}

/** Search result with context for synthesis */
export interface NLSearchResult {
  intent: SearchIntent;
  listings: Listing[];
  context: string;
}

/**
 * Extract search intent from a natural language query using Groq LLM.
 *
 * Falls back to using the raw query as keywords if LLM is unavailable or fails.
 */
export async function extractIntent(query: string): Promise<SearchIntent> {
  if (!groq) {
    return { keywords: query, category: null, chain: null };
  }

  try {
    const { text } = await generateText({
      model: groq(INTENT_MODEL),
      system: INTENT_SYSTEM_PROMPT,
      prompt: query,
      maxOutputTokens: 100,
      temperature: 0,
    });

    const parsed = JSON.parse(text.trim());
    return {
      keywords: typeof parsed.keywords === 'string' ? parsed.keywords : query,
      category: typeof parsed.category === 'string' ? parsed.category : null,
      chain: typeof parsed.chain === 'string' ? parsed.chain : null,
    };
  } catch {
    // LLM failed — fall back to raw query
    return { keywords: query, category: null, chain: null };
  }
}

/**
 * Semantic search via Pinecone vector similarity.
 *
 * Embeds the query and retrieves the top-K most similar tool descriptions.
 * Returns null if Pinecone is not configured or the query fails.
 */
async function pineconeSearch(
  query: string,
  category: string | null,
  topK = 15
): Promise<Partial<Listing>[] | null> {
  try {
    const [index, queryVector] = await Promise.all([
      getPineconeIndex(),
      embedQuery(query),
    ]);

    if (!index || !queryVector) return null;

    const queryOptions: Parameters<typeof index.query>[0] = {
      vector: queryVector,
      topK,
      includeMetadata: true,
    };

    // Apply category filter if present
    if (category) {
      queryOptions.filter = { category: { $eq: category } };
    }

    const result = await index.query(queryOptions);

    if (!result.matches || result.matches.length === 0) return null;

    // Map Pinecone matches back to partial Listing shape
    return result.matches.map((match) => {
      const m = match.metadata as Record<string, unknown>;
      return {
        id: match.id,
        slug: String(m.slug ?? ''),
        name: String(m.name ?? ''),
        tagline: String(m.tagline ?? ''),
        category: String(m.category ?? ''),
        stars: typeof m.stars === 'number' ? m.stars : null,
        downloads: typeof m.downloads === 'number' ? m.downloads : null,
        hypeScore: typeof m.hypeScore === 'number' ? m.hypeScore : null,
        sourceUrl: String(m.sourceUrl ?? ''),
      };
    });
  } catch (err) {
    console.error('[nl-search] Pinecone search failed:', err);
    return null;
  }
}

/**
 * Perform the full NL search pipeline: intent extraction → Pinecone semantic retrieval
 * (with FTS5 fallback) → context building.
 *
 * Returns the search results and a formatted context string ready for LLM synthesis.
 */
export async function nlSearch(query: string): Promise<NLSearchResult> {
  const intent = await extractIntent(query);

  let listings: Partial<Listing>[] = [];

  // 1. Try Pinecone semantic search first
  const semanticResults = await pineconeSearch(query, intent.category);
  if (semanticResults && semanticResults.length > 0) {
    listings = semanticResults;
  }

  // 2. Fall back to FTS5 keyword search if Pinecone returned nothing
  if (listings.length === 0) {
    try {
      listings = await searchCatalog({
        query: intent.keywords,
        category: intent.category ?? undefined,
        limit: 15,
      });
    } catch {
      // FTS5 match might fail on certain query patterns
    }
  }

  // 3. Try FTS5 without category filter
  if (listings.length === 0 && intent.category) {
    try {
      listings = await searchCatalog({
        query: intent.keywords,
        limit: 15,
      });
    } catch {
      // ignore
    }
  }

  // 4. Final fallback: browse by category sorted by popularity
  if (listings.length === 0 && intent.category) {
    const result = await browseListings({
      category: intent.category,
      sort: 'popular',
      limit: 10,
    });
    listings = result.listings;
  }

  // Build context string for LLM synthesis
  const context = buildContext(listings as Listing[]);

  return { intent, listings: listings as Listing[], context };
}

/**
 * Build a formatted context string from search results for LLM synthesis.
 */
function buildContext(listings: Listing[]): string {
  if (listings.length === 0) {
    return 'No matching tools found in the catalog.';
  }

  const lines = listings.map((l, i) => {
    const categoryLabel = CATEGORY_LABELS[l.category as Category] ?? l.category;
    const stars = l.stars ? `${l.stars.toLocaleString()} stars` : '';
    const downloads = l.downloads ? `${l.downloads.toLocaleString()} downloads` : '';
    const metrics = [stars, downloads].filter(Boolean).join(', ');

    return `${i + 1}. **${l.name}** [${categoryLabel}]${metrics ? ` (${metrics})` : ''}
   ${l.tagline}
   URL: ${l.sourceUrl}`;
  });

  return lines.join('\n\n');
}
