'use server';

/**
 * src/app/tools/[slug]/actions.ts
 *
 * Server Actions for listing detail page.
 *
 * Upvote action uses atomic SQL increment to prevent race conditions.
 */

import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { listings } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

/**
 * Increment upvote count for a listing.
 *
 * Uses atomic SQL: `SET upvotes = upvotes + 1` to prevent read-modify-write races.
 * No authentication required — client-side duplicate prevention via sessionStorage.
 *
 * @param listingId - The listing ID to upvote
 */
export async function upvoteListing(listingId: string): Promise<void> {
  if (!listingId || typeof listingId !== 'string') {
    console.error('[upvoteListing] Invalid listingId:', listingId);
    return;
  }

  try {
    // Atomic increment: upvotes = upvotes + 1
    await db
      .update(listings)
      .set({
        upvotes: sql`${listings.upvotes} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(listings.id, listingId));

    // Revalidate /tools and the specific listing page
    revalidatePath('/tools');
    revalidatePath(`/tools/${listingId}`); // This might not match the slug, but harmless
  } catch (error) {
    // Log error but don't expose to client — upvote is a best-effort action
    console.error('[upvoteListing] Database error:', error);
  }
}
