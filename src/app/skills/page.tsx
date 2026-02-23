import { browseSkills, countBySkillCategory } from '@/services/skills';
import { SKILL_CATEGORY_LABELS } from '@/lib/categories';
import { CategoryNav } from '@/components/category-nav';
import { Pagination } from '@/components/pagination';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 24;

export const metadata = {
  title: 'OpenClaw Skills | AI Bazaar',
  description:
    'Discover and install OpenClaw skills — installable capabilities for the OpenClaw agent platform. Browse automation, research, coding, media, and Web3 skills.',
};

interface SkillsPageProps {
  searchParams: Promise<{
    category?: string;
    sort?: string;
    q?: string;
    page?: string;
  }>;
}

/**
 * Browse page at /skills — Server Component with URL searchParams-driven filters.
 *
 * Supports category filter, sort (popular/recent), text search, and pagination.
 * All filter state lives in URL searchParams for shareability.
 */
export default async function SkillsPage({ searchParams }: SkillsPageProps) {
  const params = await searchParams;

  const page = parseInt(params.page || '1', 10);
  const offset = (page - 1) * PAGE_SIZE;

  const browseResult = await browseSkills({
    category: params.category,
    sort: params.sort === 'recent' ? 'recent' : 'popular',
    query: params.q,
    limit: PAGE_SIZE,
    offset,
  });

  const categoryCounts = await countBySkillCategory();
  const categoryNavData = categoryCounts.map((item) => ({
    category: item.category,
    count: item.count,
    label: SKILL_CATEGORY_LABELS[item.category as keyof typeof SKILL_CATEGORY_LABELS] || item.category,
  }));

  const totalPages = Math.ceil(browseResult.total / PAGE_SIZE);
  const activeCategory = params.category;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
          OpenClaw Skills
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Browse Skills
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          {browseResult.total.toLocaleString()}+ installable capabilities for the OpenClaw agent platform
        </p>
      </div>

      {/* Category Navigation */}
      <div className="mb-6">
        <CategoryNav
          categories={categoryNavData}
          activeCategory={activeCategory}
          basePath="/skills"
        />
      </div>

      {/* Sort + Search bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-2">
          <Link
            href={`/skills${activeCategory ? `?category=${activeCategory}` : ''}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              params.sort !== 'recent'
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            Popular
          </Link>
          <Link
            href={`/skills?sort=recent${activeCategory ? `&category=${activeCategory}` : ''}`}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              params.sort === 'recent'
                ? 'bg-zinc-900 text-white dark:bg-zinc-50 dark:text-zinc-900'
                : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400'
            }`}
          >
            Recent
          </Link>
        </div>
      </div>

      {/* Results or Empty State */}
      {browseResult.skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <p className="text-lg font-medium text-zinc-900 dark:text-zinc-50">
            No skills match your filters
          </p>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            Try a different category
          </p>
          <Link
            href="/skills"
            className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            Clear filters
          </Link>
        </div>
      ) : (
        <>
          {/* Skills Grid */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {browseResult.skills.map((skill) => {
              const tags = skill.tags ? (JSON.parse(skill.tags) as string[]) : [];
              return (
                <div
                  key={skill.id}
                  className="group relative flex flex-col rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-indigo-800"
                >
                  {/* Category badge */}
                  <div className="mb-3 flex items-center justify-between">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                      {SKILL_CATEGORY_LABELS[skill.category as keyof typeof SKILL_CATEGORY_LABELS] || skill.category}
                    </span>
                    {skill.stars != null && skill.stars > 0 && (
                      <span className="flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                        <svg className="h-3 w-3 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {skill.stars.toLocaleString()}
                      </span>
                    )}
                  </div>

                  {/* Name + link */}
                  <Link
                    href={`/skills/${skill.slug}`}
                    className="mb-2 text-base font-bold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
                  >
                    {skill.name}
                  </Link>

                  {/* Tagline */}
                  <p className="mb-3 flex-1 text-sm text-zinc-600 line-clamp-2 dark:text-zinc-400">
                    {skill.tagline}
                  </p>

                  {/* Install command */}
                  {skill.installCmd && (
                    <div className="mb-3 rounded bg-zinc-50 px-2.5 py-1.5 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                      {skill.installCmd}
                    </div>
                  )}

                  {/* Tags */}
                  {tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {tags.slice(0, 3).map((tag) => (
                        <span
                          key={tag}
                          className="rounded bg-zinc-50 px-2 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
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
