import Link from 'next/link';

export interface CategoryNavProps {
  categories: Array<{
    category: string;
    count: number;
    label: string;
  }>;
  activeCategory?: string;
  /** Base path for category links. Defaults to "/tools". */
  basePath?: string;
}

/**
 * CategoryNav component — displays category links with counts.
 *
 * Server Component (no client-side JS). Shows all categories with entry counts.
 * Each category links to {basePath}?category={slug}.
 *
 * Mobile: horizontal scroll. Desktop: wrapping grid.
 */
export function CategoryNav({ categories, activeCategory, basePath = '/tools' }: CategoryNavProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 md:flex-wrap md:overflow-x-visible">
      {categories.map(({ category, count, label }) => {
        const isActive = activeCategory === category;
        return (
          <Link
            key={category}
            href={`${basePath}?category=${category}`}
            className={`flex shrink-0 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              isActive
                ? 'border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700'
                : 'border-zinc-200 bg-white text-zinc-900 hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800'
            }`}
          >
            <span>{label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                isActive
                  ? 'bg-indigo-700 text-indigo-100'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}
            >
              {count.toLocaleString()}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
