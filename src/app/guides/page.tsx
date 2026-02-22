import { listGuides, getGuideCategories } from '@/lib/guides';
import { GuideCard } from '@/components/guide-card';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Guides | AI Bazaar',
  description:
    'Beginner-friendly guides for AI coding tools, OpenClaw, terminal basics, security, and more.',
  openGraph: {
    title: 'Guides | AI Bazaar',
    description:
      'Beginner-friendly guides for AI coding tools, OpenClaw, terminal basics, security, and more.',
  },
};

interface GuidesPageProps {
  searchParams: Promise<{
    category?: string;
  }>;
}

export default async function GuidesPage({ searchParams }: GuidesPageProps) {
  const params = await searchParams;
  const activeCategory = params.category || '';
  const categories = getGuideCategories();
  const guides = listGuides(activeCategory || undefined);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Guides
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Practical guides for getting started with AI coding tools, from model
          selection to building your first project.
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/guides"
          className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
            !activeCategory
              ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
              : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
          }`}
        >
          All
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.value}
            href={`/guides?category=${cat.value}`}
            className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              activeCategory === cat.value
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
            }`}
          >
            {cat.label}
          </Link>
        ))}
      </div>

      {/* Results or empty state */}
      {guides.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            No guides found
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Guides are coming soon. Check back shortly!
          </p>
          {activeCategory && (
            <Link
              href="/guides"
              className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Clear filter
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {guides.map((guide) => (
            <GuideCard key={guide.slug} guide={guide} />
          ))}
        </div>
      )}
    </div>
  );
}
