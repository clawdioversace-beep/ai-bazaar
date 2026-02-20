import type { Read } from '@/db/schema';

const CATEGORY_LABELS: Record<string, string> = {
  thread: 'Thread',
  article: 'Article',
  tutorial: 'Tutorial',
  video: 'Video',
  guide: 'Guide',
};

const SOURCE_COLORS: Record<string, string> = {
  Twitter: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  YouTube: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  Blog: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  GitHub: 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300',
};

export interface ReadCardProps {
  read: Read;
}

export function ReadCard({ read }: ReadCardProps) {
  const tags = read.tags ? (JSON.parse(read.tags) as string[]) : [];
  const sourceColor = SOURCE_COLORS[read.sourceName] || 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';

  return (
    <a
      href={read.sourceUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col gap-3 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
    >
      {/* Source badge + category */}
      <div className="flex items-center gap-2 text-xs">
        <span className={`rounded-full px-2 py-0.5 font-medium ${sourceColor}`}>
          {read.sourceName}
        </span>
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {CATEGORY_LABELS[read.category] || read.category}
        </span>
        {read.author && (
          <span className="ml-auto text-zinc-500 dark:text-zinc-500">
            {read.author}
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-base font-semibold text-zinc-900 group-hover:text-zinc-700 dark:text-zinc-50 dark:group-hover:text-zinc-300 line-clamp-2">
        {read.title}
      </h3>

      {/* Summary */}
      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
        {read.summary}
      </p>

      {/* Tags */}
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

      {/* Read link */}
      <span className="mt-auto text-sm font-medium text-zinc-900 group-hover:text-zinc-600 dark:text-zinc-50 dark:group-hover:text-zinc-300">
        Read &rarr;
      </span>
    </a>
  );
}
