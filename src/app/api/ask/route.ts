/**
 * POST /api/ask — Natural language search endpoint.
 *
 * Accepts a user query, runs the NL search pipeline (intent extraction → FTS5
 * retrieval → LLM synthesis), and streams a conversational response.
 *
 * When Groq is unavailable, returns FTS5 results as a structured JSON fallback
 * instead of a streamed response.
 *
 * Rate limit: 10 requests/min/IP (enforced via simple in-memory counter).
 */

import { streamText } from 'ai';
import { groq, SYNTHESIS_MODEL, SYNTHESIS_SYSTEM_PROMPT } from '@/lib/ai';
import { nlSearch } from '@/services/nl-search';
import { NextRequest, NextResponse } from 'next/server';

/** Simple in-memory rate limiter */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }

  entry.count++;
  return entry.count > RATE_LIMIT;
}

export async function POST(request: NextRequest) {
  // Rate limit by IP
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  if (isRateLimited(ip)) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a minute.' },
      { status: 429 }
    );
  }

  // Parse and validate input
  let query: string;
  try {
    const body = await request.json();
    query = typeof body.query === 'string' ? body.query.trim() : '';
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!query || query.length < 3) {
    return NextResponse.json({ error: 'Query must be at least 3 characters' }, { status: 400 });
  }

  if (query.length > 500) {
    query = query.slice(0, 500);
  }

  // Run NL search pipeline
  const { intent, listings, context } = await nlSearch(query);

  // If Groq is not configured, return structured fallback
  if (!groq) {
    return NextResponse.json({
      fallback: true,
      intent,
      listings: listings.map(l => ({
        id: l.id,
        slug: l.slug,
        name: l.name,
        tagline: l.tagline,
        category: l.category,
        stars: l.stars,
        downloads: l.downloads,
        sourceUrl: l.sourceUrl,
        hypeScore: l.hypeScore,
      })),
    });
  }

  // Build listing data for client
  const listingData = listings.slice(0, 8).map(l => ({
    id: l.id,
    slug: l.slug,
    name: l.name,
    tagline: l.tagline,
    category: l.category,
    stars: l.stars,
    downloads: l.downloads,
    sourceUrl: l.sourceUrl,
    hypeScore: l.hypeScore,
  }));

  // Stream synthesis response
  const result = streamText({
    model: groq(SYNTHESIS_MODEL),
    system: SYNTHESIS_SYSTEM_PROMPT,
    prompt: `User question: "${query}"

Here are the relevant tools from our catalog:

${context}

Based on these tools, give a helpful recommendation. Reference tools by name.`,
    maxOutputTokens: 800,
    temperature: 0.3,
  });

  const textStream = result.toTextStreamResponse();

  // Attach listing data as a header so the client can render tool cards
  textStream.headers.set('X-Listings', encodeURIComponent(JSON.stringify(listingData)));

  return textStream;
}
