import Link from 'next/link';
import type { Listing } from '@/db/schema';
import { CATEGORY_LABELS } from '@/lib/categories';

export interface ListingCardProps {
  listing: Listing;
}

/**
 * ListingCard component — displays a catalog entry as a card.
 *
 * Server Component (no client-side JS). Used on homepage, browse page, and search results.
 *
 * Shows: name (as link to detail page), tagline (truncated), category badge,
 * stars count, runtime badge, and first 3 tags as pills.
 *
 * Mobile: full width. Desktop: adapts to grid context (no width set on card itself).
 */
export function ListingCard({ listing }: ListingCardProps) {
  // Parse JSON fields
  const tags = listing.tags ? (JSON.parse(listing.tags) as string[]) : [];
  const chainSupport = listing.chainSupport
    ? (JSON.parse(listing.chainSupport) as string[])
    : [];

  // Truncate tagline to 2 lines max (approx 120 chars)
  const truncatedTagline =
    listing.tagline.length > 120
      ? listing.tagline.slice(0, 120) + '...'
      : listing.tagline;

  return (
    <div className="group relative flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      {/* Hype score badge — shown when score > 70 */}
      {listing.hypeScore !== null && listing.hypeScore > 70 && (
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5 .5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
          </svg>
          {listing.hypeScore}
        </div>
      )}

      {/* Name as link to detail page */}
      <Link
        href={`/tools/${listing.slug}`}
        className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300"
      >
        {listing.name}
      </Link>

      {/* Tagline */}
      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
        {truncatedTagline}
      </p>

      {/* Category and stars */}
      <div className="flex items-center gap-2 text-xs">
        <span className="rounded-full bg-zinc-100 px-2 py-1 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          {CATEGORY_LABELS[listing.category as keyof typeof CATEGORY_LABELS] ||
            listing.category}
        </span>
        {listing.stars !== null && listing.stars > 0 && (
          <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
            <svg
              className="h-3 w-3 fill-current"
              viewBox="0 0 20 20"
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            <span>{listing.stars.toLocaleString()}</span>
          </span>
        )}
        {listing.downloads !== null && listing.downloads > 0 && (
          <span className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
            <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
            <span>{listing.downloads.toLocaleString()}</span>
          </span>
        )}
        <a
          href={listing.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
          title="Visit tool"
        >
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      {/* Runtime badge */}
      {listing.runtime && (
        <div className="flex items-center gap-2">
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
            {listing.runtime}
          </span>
        </div>
      )}

      {/* Chain support badges */}
      {chainSupport.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {chainSupport.slice(0, 3).map((chain) => (
            <span
              key={chain}
              className="rounded bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {chain}
            </span>
          ))}
        </div>
      )}

      {/* Tags (first 3) */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="rounded bg-zinc-50 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
