import Link from 'next/link';
import { ListingCard } from '@/components/listing-card';
import { CategoryNav } from '@/components/category-nav';
import {
  getFeaturedListings,
  getNewThisWeek,
  countByCategory,
} from '@/services/search';
import { CATEGORY_LABELS } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI Bazaar - Discover AI, Agent & Web3 Tools',
};

export default async function HomePage() {
  // Fetch data server-side
  const [featuredListings, newListings, categoryCounts] = await Promise.all([
    getFeaturedListings(6),
    getNewThisWeek(12),
    countByCategory(),
  ]);

  // Map category counts to include labels
  const categoriesWithLabels = categoryCounts.map((cat) => ({
    ...cat,
    label:
      CATEGORY_LABELS[cat.category as keyof typeof CATEGORY_LABELS] ||
      cat.category,
  }));

  return (
    <div className="flex flex-col gap-12">
      {/* Hero section */}
      <section className="flex flex-col items-center gap-6 py-8 text-center">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Discover AI, Agent & Web3 Tools
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Permissionless discovery platform for AI, agent, and Web3 tools. Find
          MCP servers, AI agents, DeFi tools, and more.
        </p>
        <Link
          href="/tools"
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Browse All Tools
        </Link>
      </section>

      {/* Featured listings */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Top Tools
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {featuredListings.map((listing) => (
            <ListingCard key={listing.id} listing={listing} />
          ))}
        </div>
      </section>

      {/* New this week */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          New This Week
        </h2>
        {newListings.length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {newListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        ) : (
          <p className="text-zinc-600 dark:text-zinc-400">
            Check back soon for new tools!
          </p>
        )}
      </section>

      {/* Category navigation */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Browse by Category
        </h2>
        <CategoryNav categories={categoriesWithLabels} />
      </section>
    </div>
  );
}
