import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getListingBySlug } from '@/services/catalog';
import { getRelatedListings } from '@/services/search';
import { CATEGORY_LABELS, type Category } from '@/lib/categories';
import { ListingCard } from '@/components/listing-card';
import { UpvoteButton } from '@/components/upvote-button';

export const dynamic = 'force-dynamic';

/**
 * Generate dynamic metadata for listing detail pages.
 * Creates SEO-friendly title, description, and OpenGraph tags for social sharing.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    return { title: 'Tool Not Found | AI Bazaar' };
  }

  return {
    title: `${listing.name} | AI Bazaar`,
    description: listing.tagline,
    openGraph: {
      title: `${listing.name} - ${CATEGORY_LABELS[listing.category as Category]}`,
      description: listing.tagline,
      url: `/tools/${slug}`,
      siteName: 'AI Bazaar',
      type: 'website',
    },
  };
}

/**
 * Listing detail page — shows all structured metadata for a single tool.
 *
 * Server Component with two-column layout (desktop) and single-column (mobile).
 * Main content: name, tagline, category, description, tags.
 * Sidebar: metrics, links, details, metadata.
 *
 * Calls notFound() if slug doesn't exist → renders custom 404 page.
 */
export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const listing = await getListingBySlug(slug);

  if (!listing) {
    notFound();
  }

  // Parse JSON fields
  const tags = listing.tags ? (JSON.parse(listing.tags) as string[]) : [];
  const chainSupport = listing.chainSupport
    ? (JSON.parse(listing.chainSupport) as string[])
    : [];

  // Fetch related tools in same category
  const relatedListings = await getRelatedListings(listing.id, listing.category, 4);

  // Format numbers with commas for readability
  const formatNumber = (num: number | null): string => {
    if (num === null || num === 0) return '0';
    return num.toLocaleString();
  };

  // Format relative time for lastVerifiedAt
  const formatRelativeTime = (timestamp: Date | null): string => {
    if (!timestamp) return 'Never';
    const now = new Date();
    const diff = now.getTime() - timestamp.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) return 'Today';
    if (days === 1) return '1 day ago';
    if (days < 7) return `${days} days ago`;
    if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
    if (days < 365) return `${Math.floor(days / 30)} months ago`;
    return `${Math.floor(days / 365)} years ago`;
  };

  // Format date as readable string
  const formatDate = (timestamp: Date | null): string => {
    if (!timestamp) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(timestamp);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Back navigation */}
      <Link
        href="/tools"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Back to Browse
      </Link>

      {/* Two-column layout: main content + sidebar */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main content (left/top) - spans 2 columns on desktop */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Name */}
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            {listing.name}
          </h1>

          {/* Tagline */}
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {listing.tagline}
          </p>

          {/* Upvote button */}
          <UpvoteButton listingId={listing.id} initialUpvotes={listing.upvotes ?? 0} />

          {/* Category badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {CATEGORY_LABELS[listing.category as Category] ||
                listing.category}
            </span>
          </div>

          {/* Description */}
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            {listing.description.split('\n\n').map((paragraph, i) => (
              <p
                key={i}
                className="text-base text-zinc-700 dark:text-zinc-300"
              >
                {paragraph}
              </p>
            ))}
          </div>

          {/* Tags (all tags, not just first 3) */}
          {tags.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">
                Tags
              </h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-zinc-50 px-2.5 py-1 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar (right/bottom on mobile) */}
        <div className="flex flex-col gap-4">
          {/* Metrics card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Metrics
            </h3>
            <div className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Stars
                </span>
                <span className="flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-50">
                  <svg
                    className="h-4 w-4 fill-current"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                  {formatNumber(listing.stars)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Downloads
                </span>
                <span className="flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-50">
                  <svg
                    className="h-4 w-4 fill-current"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {listing.downloads === null ? 'N/A' : formatNumber(listing.downloads)}
                </span>
              </div>
            </div>
          </div>

          {/* Links card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Links
            </h3>
            <div className="flex flex-col gap-2">
              <a
                href={listing.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center gap-2 rounded bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg
                  className="h-4 w-4 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                  />
                </svg>
                Visit Tool →
              </a>
              {listing.docsUrl && (
                <a
                  href={listing.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center gap-2 rounded bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <svg
                    className="h-4 w-4 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  Documentation
                </a>
              )}
            </div>
          </div>

          {/* Details card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Details
            </h3>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  License
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {listing.licenseType || 'Not specified'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Runtime
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {listing.runtime || 'Not specified'}
                </span>
              </div>
              {chainSupport.length > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Chains
                  </span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">
                    {chainSupport.join(', ')}
                  </span>
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  MCP Compatible
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    listing.mcpCompatible
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {listing.mcpCompatible ? 'Yes' : 'No'}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  ACP Compatible
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    listing.acpCompatible
                      ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                      : 'bg-zinc-50 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}
                >
                  {listing.acpCompatible ? 'Yes' : 'No'}
                </span>
              </div>
            </div>
          </div>

          {/* Metadata card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
              Metadata
            </h3>
            <div className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Last Verified
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatRelativeTime(listing.lastVerifiedAt)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Added
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatDate(listing.createdAt)}
                </span>
              </div>
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">
                  Updated
                </span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatDate(listing.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Tools */}
      {relatedListings.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">
            Related Tools
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedListings.map((related) => (
              <ListingCard key={related.id} listing={related} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
