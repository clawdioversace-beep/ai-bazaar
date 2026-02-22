import Link from 'next/link';
import type { GuideSummary } from '@/lib/guides';

const DIFFICULTY_STYLES = {
  beginner:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  intermediate:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
};

const CATEGORY_LABELS: Record<string, string> = {
  'getting-started': 'Getting Started',
  openclaw: 'OpenClaw',
  ecosystem: 'Ecosystem & Tools',
  meta: 'Resources',
};

export function GuideCard({ guide }: { guide: GuideSummary }) {
  return (
    <Link href={`/guides/${guide.slug}`}>
      <article className="group flex h-full flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
        {/* Badges row */}
        <div className="flex items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-0.5 font-semibold ${DIFFICULTY_STYLES[guide.difficulty]}`}
          >
            {guide.difficulty === 'beginner' ? 'Beginner' : 'Intermediate'}
          </span>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            {CATEGORY_LABELS[guide.category] || guide.category}
          </span>
          <span className="ml-auto text-zinc-500 dark:text-zinc-500">
            {guide.readingTime}
          </span>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-50 dark:group-hover:text-indigo-400 transition-colors line-clamp-2">
          {guide.title}
        </h3>

        {/* Tagline */}
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400 line-clamp-2">
          {guide.tagline}
        </p>

        {/* Tags */}
        {guide.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {guide.tags.slice(0, 3).map((tag) => (
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
        <span className="mt-auto text-sm font-medium text-indigo-600 dark:text-indigo-400">
          Read guide &rarr;
        </span>
      </article>
    </Link>
  );
}
