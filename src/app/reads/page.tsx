import { browseReads } from '@/services/reads';
import { ReadCard } from '@/components/read-card';
import { Pagination } from '@/components/pagination';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 20;

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'thread', label: 'Threads' },
  { value: 'article', label: 'Articles' },
  { value: 'tutorial', label: 'Tutorials' },
  { value: 'video', label: 'Videos' },
  { value: 'guide', label: 'Guides' },
];

export const metadata = {
  title: 'AI Reads | AI Bazaar',
  description: 'Curated AI threads, articles, tutorials, and guides from around the web.',
};

interface ReadsPageProps {
  searchParams: Promise<{
    category?: string;
    tag?: string;
    page?: string;
  }>;
}

export default async function ReadsPage({ searchParams }: ReadsPageProps) {
  const params = await searchParams;
  const page = parseInt(params.page || '1', 10);
  const offset = (page - 1) * PAGE_SIZE;
  const activeCategory = params.category || '';

  const { reads, total } = await browseReads({
    category: params.category,
    tag: params.tag,
    limit: PAGE_SIZE,
    offset,
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          AI Reads
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          The best AI threads, articles, tutorials, and guides from around the web.
        </p>
      </div>

      {/* Category filter tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {CATEGORIES.map((cat) => {
          const isActive = activeCategory === cat.value;
          const href = cat.value
            ? `/reads?category=${cat.value}`
            : '/reads';
          return (
            <Link
              key={cat.value}
              href={href}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                  : 'bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
              }`}
            >
              {cat.label}
            </Link>
          );
        })}
      </div>

      {/* Results or empty state */}
      {reads.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            No reads found
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Check back soon for curated AI content.
          </p>
          {activeCategory && (
            <Link
              href="/reads"
              className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
            >
              Clear filter
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Read cards grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reads.map((read) => (
              <ReadCard key={read.id} read={read} />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8">
              <Pagination currentPage={page} totalPages={totalPages} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
