/**
 * src/lib/upvote-tracker.ts
 *
 * Session-based upvote tracking using sessionStorage.
 *
 * Prevents double-voting within a browser session without requiring authentication.
 * SSR-safe: checks for window existence before accessing sessionStorage.
 */

/**
 * Check if the user has upvoted a listing in this session.
 * @param listingId - The listing ID to check
 * @returns true if the user has upvoted this listing, false otherwise
 */
export function hasUpvoted(listingId: string): boolean {
  if (typeof window === 'undefined') return false;
  return sessionStorage.getItem(`upvote_${listingId}`) === 'true';
}

/**
 * Mark a listing as upvoted in this session.
 * @param listingId - The listing ID to mark
 */
export function markUpvoted(listingId: string): void {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(`upvote_${listingId}`, 'true');
}
