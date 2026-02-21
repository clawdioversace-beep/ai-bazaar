import Link from 'next/link';
import { ListingCard } from '@/components/listing-card';
import { ReadCard } from '@/components/read-card';
import { CategoryNav } from '@/components/category-nav';
import { SubscribeForm } from '@/components/subscribe-form';
import { SubscribeBanner } from '@/components/subscribe-banner';
import { AskSearch } from '@/components/ask-search';
import {
  getNewThisWeek,
  getRecentlyAdded,
  countByCategory,
  getTrendingListings,
} from '@/services/search';
import { getFeaturedReads } from '@/services/reads';
import { listPacksWithToolCount } from '@/services/packs';
import { CATEGORY_LABELS } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI Bazaar - Discover AI, Agent & Web3 Tools',
};

export default async function HomePage() {
  const [newListings, categoryCounts, trendingListings, topReads, packs] = await Promise.all([
    getNewThisWeek(12),
    countByCategory(),
    getTrendingListings(6),
    getFeaturedReads(3),
    listPacksWithToolCount(),
  ]);

  // If fewer than 6 quality items from this week, fall back to recently added
  const showRecent = newListings.length < 6;
  const recentListings = showRecent ? await getRecentlyAdded(12) : [];

  const categoriesWithLabels = categoryCounts.map((cat) => ({
    ...cat,
    label:
      CATEGORY_LABELS[cat.category as keyof typeof CATEGORY_LABELS] ||
      cat.category,
  }));

  // Total tools count for hero
  const totalTools = categoryCounts.reduce((sum, cat) => sum + cat.count, 0);

  return (
    <div className="flex flex-col gap-12">
      {/* Hero section — action-oriented with NL search */}
      <section className="flex flex-col items-center gap-6 py-8 text-center">
        <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          What are you building?
        </h1>
        <p className="max-w-2xl text-lg text-zinc-600 dark:text-zinc-400">
          Discover the right AI, agent, and Web3 tools from {totalTools.toLocaleString()}+ listings.
          Ask a question or browse the catalog.
        </p>

        {/* NL Search bar — the hero CTA */}
        <div className="w-full max-w-2xl">
          <AskSearch />
        </div>

        <div className="flex flex-col items-center gap-2 pt-2">
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            Get the top 5 new AI tools delivered weekly
          </p>
          <SubscribeForm source="hero" />
        </div>
      </section>

      {/* Starter Packs — curated collections front and center */}
      {packs.length > 0 && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                Starter Packs
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                New to AI tools? Start with a curated collection.
              </p>
            </div>
            <Link
              href="/packs"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              View all &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {packs.map((pack) => (
              <Link
                key={pack.id}
                href={`/packs/${pack.slug}`}
                className="group flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <h3 className="text-lg font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300">
                  {pack.name}
                </h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                  {pack.description}
                </p>
                <span className="text-xs font-medium text-zinc-500 dark:text-zinc-500">
                  {pack.tools.length} tools
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Hot Right Now — trending section */}
      {trendingListings.length > 0 && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center gap-2">
            <svg className="h-6 w-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5 .5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
            </svg>
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Hot Right Now
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {trendingListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        </section>
      )}

      {/* New this week / Recently added fallback */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          {showRecent ? 'Recently Added' : 'New This Week'}
        </h2>
        {showRecent ? (
          recentListings.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {recentListings.map((listing) => (
                <ListingCard key={listing.id} listing={listing} />
              ))}
            </div>
          ) : (
            <p className="text-zinc-600 dark:text-zinc-400">
              Check back soon for new tools!
            </p>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {newListings.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </section>

      {/* Top Reads */}
      {topReads.length > 0 && (
        <section className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
              Top Reads
            </h2>
            <Link
              href="/reads"
              className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              View all reads &rarr;
            </Link>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {topReads.map((read) => (
              <ReadCard key={read.id} read={read} />
            ))}
          </div>
        </section>
      )}

      {/* Category navigation — for power users */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
          Browse by Category
        </h2>
        <CategoryNav categories={categoriesWithLabels} />
      </section>

      {/* Scroll-triggered subscribe banner */}
      <SubscribeBanner />
    </div>
  );
}
