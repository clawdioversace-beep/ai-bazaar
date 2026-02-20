/**
 * src/app/api/feed/route.ts
 *
 * JSON Feed 1.1 endpoint for agent crawlers and power users.
 *
 * Exposes the catalog as a machine-readable feed at /api/feed, enabling agent
 * crawlers and feed readers to discover new listings without scraping HTML.
 * Follows the JSON Feed 1.1 specification for maximum interoperability.
 *
 * Spec: https://jsonfeed.org/version/1.1
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAllListings } from '@/services/catalog';

/**
 * Safely parses a JSON string, returning a fallback value on error.
 * Used to parse the tags field which is stored as JSON in the database.
 */
function safeJsonParse<T>(json: string | null, fallback: T): T {
  if (!json) return fallback;
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}

/**
 * GET /api/feed
 *
 * Returns a JSON Feed 1.1 response with paginated listings in reverse-chronological order.
 *
 * Query params:
 * - limit: integer, default 50, max 100
 * - offset: integer, default 0
 *
 * Response headers:
 * - Content-Type: application/feed+json
 * - Cache-Control: public, s-maxage=300, stale-while-revalidate=600
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse query params with defaults and clamping
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');

    const limit = Math.min(parseInt(limitParam || '50', 10), 100);
    const offset = parseInt(offsetParam || '0', 10);

    // Fetch one extra to determine if there are more pages
    const results = await getAllListings(limit + 1, offset);
    const hasMore = results.length > limit;

    // Slice to the actual limit for the response
    const items = results.slice(0, limit);

    // Determine base URL from env or default to production URL
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aibazaar.dev';

    // Construct JSON Feed 1.1 response
    const feed = {
      version: 'https://jsonfeed.org/version/1.1',
      title: 'AI Bazaar - New Listings',
      home_page_url: baseUrl,
      feed_url: `${baseUrl}/api/feed`,
      description: 'Latest AI, Agent & Web3 tools submitted to AI Bazaar',
      items: items.map((listing) => ({
        id: listing.id,
        url: `${baseUrl}/tools/${listing.slug}`,
        title: listing.name,
        content_text: listing.description,
        summary: listing.tagline,
        date_published: listing.createdAt ? new Date(listing.createdAt).toISOString() : new Date().toISOString(),
        tags: safeJsonParse(listing.tags, []),
        _ai_bazaar: {
          category: listing.category,
          source_url: listing.sourceUrl,
          stars: listing.stars,
          downloads: listing.downloads,
          mcp_compatible: listing.mcpCompatible,
        },
      })),
    };

    // Add pagination link if there are more pages
    if (hasMore) {
      (feed as any).next_url = `${baseUrl}/api/feed?limit=${limit}&offset=${offset + limit}`;
    }

    // Return with proper Content-Type and cache headers
    return NextResponse.json(feed, {
      headers: {
        'Content-Type': 'application/feed+json',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (error) {
    console.error('JSON Feed error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
