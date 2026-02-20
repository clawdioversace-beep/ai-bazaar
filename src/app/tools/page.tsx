import { browseListings, getFilterOptions, countByCategory } from '@/services/search';
import { CATEGORY_LABELS } from '@/lib/categories';
import { CategoryNav } from '@/components/category-nav';
import { ListingCard } from '@/components/listing-card';
import { FilterPanel } from '@/components/filter-panel';
import { Pagination } from '@/components/pagination';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

export const metadata = {
  title: 'Browse Tools | AI Bazaar',
  description:
    'Browse the complete catalog of AI agents, MCP servers, Web3 tools, DeFi tools, infrastructure, and frameworks. Filter by category, chain, runtime, and protocol.',
};

interface BrowsePageProps {
  searchParams: Promise<{
    category?: string;
    chain?: string;
    runtime?: string;
    protocol?: string;
    sort?: string;
    q?: string;
    page?: string;
  }>;
}

/**
 * Browse page at /tools — Server Component with URL searchParams-driven filters.
 *
 * Supports:
 * - Category filter (from CategoryNav or URL param)
 * - Chain filter (dropdown)
 * - Runtime filter (dropdown)
 * - Protocol filter (mcp/acp)
 * - Sort (popular/recent)
 * - Text search (optional)
 * - Page-based pagination
 *
 * All filter state lives in URL searchParams for shareability.
 * FilterPanel and Pagination are Client Components that update the URL.
 */
export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const params = await searchParams;

  // Parse page number, default 1
  const page = parseInt(params.page || '1', 10);
  const offset = (page - 1) * PAGE_SIZE;

  // Parse protocol filter
  const protocol = params.protocol === 'mcp' || params.protocol === 'acp'
    ? params.protocol
    : undefined;

  // Fetch browse results
  const browseResult = await browseListings({
    category: params.category,
    chain: params.chain,
    runtime: params.runtime,
    protocol,
    sort: params.sort === 'recent' ? 'recent' : params.sort === 'trending' ? 'trending' : 'popular',
    query: params.q,
    limit: PAGE_SIZE,
    offset,
  });

  // Fetch filter options for dropdowns
  const filterOptions = await getFilterOptions();

  // Fetch category counts for CategoryNav
  const categoryCounts = await countByCategory();
  const categoryNavData = categoryCounts.map((item) => ({
    category: item.category,
    count: item.count,
    label: CATEGORY_LABELS[item.category as keyof typeof CATEGORY_LABELS] || item.category,
  }));

  // Calculate total pages
  const totalPages = Math.ceil(browseResult.total / PAGE_SIZE);

  // Active category for highlighting
  const activeCategory = params.category;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Browse Tools
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {browseResult.total.toLocaleString()} tools available
        </p>
      </div>

      {/* Category Navigation */}
      <div className="mb-6">
        <CategoryNav
          categories={categoryNavData}
          activeCategory={activeCategory}
        />
      </div>

      {/* Filter Panel */}
      <FilterPanel
        categories={categoryNavData}
        chains={filterOptions.chains}
        runtimes={filterOptions.runtimes}
      />

      {/* Results or Empty State */}
      {browseResult.listings.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            No tools match your filters
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Try adjusting your filters or
          </p>
          <Link
            href="/tools"
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Clear all filters
          </Link>
        </div>
      ) : (
        <>
          {/* Listing Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {browseResult.listings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination
                currentPage={page}
                totalPages={totalPages}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
