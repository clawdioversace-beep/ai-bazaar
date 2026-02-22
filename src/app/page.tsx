import Link from 'next/link';
import { ListingCard } from '@/components/listing-card';
import { ReadCard } from '@/components/read-card';
import { CategoryNav } from '@/components/category-nav';
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
import { listGuides } from '@/lib/guides';
import { GuideCard } from '@/components/guide-card';
import { CATEGORY_LABELS } from '@/lib/categories';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'AI Bazaar - Where Builders Discover What\'s Worth Using',
};

export default async function HomePage() {
  const [newListings, categoryCounts, trendingListings, topReads, packs] = await Promise.all([
    getNewThisWeek(12),
    countByCategory(),
    getTrendingListings(6),
    getFeaturedReads(3),
    listPacksWithToolCount(),
  ]);

  const featuredGuides = listGuides().slice(0, 3);

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
      {/* Hero section — welcome-first with NL search */}
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <span className="rounded-full bg-amber-100 px-4 py-1.5 text-sm font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
          {totalTools.toLocaleString()}+ tools curated for builders
        </span>
        <h1 className="text-5xl font-extrabold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-6xl">
          Discover what&apos;s worth building with
        </h1>
        <p className="max-w-2xl text-lg leading-relaxed text-zinc-600 dark:text-zinc-400">
          Explore curated starter packs, trending tools, and expert picks —
          whether you&apos;re building agents, DeFi apps, or MCP servers.
        </p>
        <div className="w-full max-w-2xl pt-4">
          <AskSearch />
        </div>
      </section>

      {/* Starter Packs — editorial feature with tinted background */}
      {packs.length > 0 && (
        <section className="rounded-2xl bg-violet-50 p-8 dark:bg-violet-950/20">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Starter Packs
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  New to AI tools? Start with a curated collection.
                </p>
              </div>
              <Link
                href="/packs"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                View all &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {packs.map((pack) => (
                <Link
                  key={pack.id}
                  href={`/packs/${pack.slug}`}
                  className="group flex flex-col gap-4 rounded-xl bg-white p-6 shadow-sm ring-1 ring-zinc-200 transition-all duration-200 hover:shadow-lg hover:ring-indigo-300 dark:bg-zinc-900 dark:ring-zinc-800 dark:hover:ring-indigo-700"
                >
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      Starter Pack
                    </span>
                    <span className="text-xs text-zinc-500">{pack.tools.length} tools</span>
                  </div>
                  <h3 className="text-lg font-bold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-50 dark:group-hover:text-indigo-400 transition-colors">
                    {pack.name}
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-2">
                    {pack.description}
                  </p>
                  <span className="mt-auto text-sm font-medium text-indigo-600 dark:text-indigo-400">
                    Explore pack &rarr;
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Learn — elevated reads with tinted background */}
      {topReads.length > 0 && (
        <section className="rounded-2xl bg-amber-50/50 p-8 dark:bg-amber-950/10">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                Learn
              </h2>
              <Link
                href="/reads"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                Explore more &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {topReads.map((read) => (
                <ReadCard key={read.id} read={read} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Guides — educational content with tinted background */}
      {featuredGuides.length > 0 && (
        <section className="rounded-2xl bg-emerald-50/50 p-8 dark:bg-emerald-950/10">
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
                  Guides
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                  Practical guides for getting started with AI tools.
                </p>
              </div>
              <Link
                href="/guides"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
              >
                View all &rarr;
              </Link>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featuredGuides.map((guide) => (
                <GuideCard key={guide.slug} guide={guide} />
              ))}
            </div>
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
            <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
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
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
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

      {/* Category navigation — explore by category */}
      <section className="flex flex-col gap-6">
        <h2 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Explore by Category
        </h2>
        <CategoryNav categories={categoriesWithLabels} />
      </section>

      {/* Scroll-triggered subscribe banner */}
      <SubscribeBanner />
    </div>
  );
}
