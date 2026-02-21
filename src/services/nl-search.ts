/**
 * src/services/nl-search.ts
 *
 * Natural Language Search orchestration.
 *
 * Pipeline: User query → Intent extraction (Groq 8B) → FTS5 retrieval → Context building
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
 * Perform the full NL search pipeline: intent extraction → FTS5 retrieval → context building.
 *
 * Returns the search results and a formatted context string ready for LLM synthesis.
 */
export async function nlSearch(query: string): Promise<NLSearchResult> {
  const intent = await extractIntent(query);

  let listings: Listing[] = [];

  try {
    // Try FTS5 search with extracted keywords
    listings = await searchCatalog({
      query: intent.keywords,
      category: intent.category ?? undefined,
      limit: 15,
    });
  } catch {
    // FTS5 match might fail on certain query patterns — try browse fallback
  }

  // If FTS5 returned nothing, try broader search without category filter
  if (listings.length === 0 && intent.category) {
    try {
      listings = await searchCatalog({
        query: intent.keywords,
        limit: 15,
      });
    } catch {
      // Still nothing — try browse by category
    }
  }

  // Final fallback: browse by category sorted by popularity
  if (listings.length === 0 && intent.category) {
    const result = await browseListings({
      category: intent.category,
      sort: 'popular',
      limit: 10,
    });
    listings = result.listings;
  }

  // Build context string for LLM synthesis
  const context = buildContext(listings);

  return { intent, listings, context };
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
