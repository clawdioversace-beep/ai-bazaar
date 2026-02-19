import Link from 'next/link';

export interface CategoryNavProps {
  categories: Array<{
    category: string;
    count: number;
    label: string;
  }>;
}

/**
 * CategoryNav component — displays category links with counts.
 *
 * Server Component (no client-side JS). Shows all 6 categories with listing counts.
 * Each category links to /tools?category={slug}.
 *
 * Mobile: horizontal scroll. Desktop: wrapping grid.
 */
export function CategoryNav({ categories }: CategoryNavProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-x-visible">
      {categories.map(({ category, count, label }) => (
        <Link
          key={category}
          href={`/tools?category=${category}`}
          className="flex shrink-0 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800"
        >
          <span>{label}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-semibold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {count.toLocaleString()}
          </span>
        </Link>
      ))}
    </div>
  );
}
