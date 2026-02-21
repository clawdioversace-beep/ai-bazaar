/**
 * GET /go/[slug] — Affiliate click-through redirect.
 *
 * Looks up the listing by slug, logs the click, and redirects to:
 * - affiliate_url if set (monetized link)
 * - source_url as fallback (direct link)
 *
 * Click data is recorded asynchronously (fire-and-forget) so the
 * redirect is instant even if the DB write is slow.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getListingBySlug } from '@/services/catalog';
import { db } from '@/db/client';
import { clicks } from '@/db/schema';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;

  const listing = await getListingBySlug(slug);

  if (!listing) {
    return NextResponse.redirect(new URL('/tools', request.url));
  }

  const targetUrl = listing.affiliateUrl || listing.sourceUrl;

  // Fire-and-forget click tracking — don't block the redirect
  db.insert(clicks).values({
    id: crypto.randomUUID(),
    toolId: listing.id,
    clickedAt: new Date(),
    referrerPage: request.headers.get('referer') ?? null,
    userAgent: request.headers.get('user-agent') ?? null,
  }).catch(() => {
    // Click tracking failure should never block the redirect
  });

  return NextResponse.redirect(targetUrl);
}
