import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getSkillBySlug, getRelatedSkills } from '@/services/skills';
import { SKILL_CATEGORY_LABELS, type SkillCategory } from '@/lib/categories';

export const dynamic = 'force-dynamic';

/**
 * Generate dynamic metadata for skill detail pages.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const skill = await getSkillBySlug(slug);

  if (!skill) {
    return { title: 'Skill Not Found | AI Bazaar' };
  }

  return {
    title: `${skill.name} | AI Bazaar Skills`,
    description: skill.tagline,
    openGraph: {
      title: `${skill.name} — OpenClaw Skill`,
      description: skill.tagline,
      url: `/skills/${slug}`,
      siteName: 'AI Bazaar',
      type: 'website',
    },
  };
}

/**
 * Skill detail page — shows all metadata for a single OpenClaw skill.
 *
 * Two-column layout (desktop) and single-column (mobile).
 * Main content: name, tagline, category, description, tags.
 * Sidebar: install command, publisher, links, metadata.
 */
export default async function SkillPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const skill = await getSkillBySlug(slug);

  if (!skill) {
    notFound();
  }

  const tags = skill.tags ? (JSON.parse(skill.tags) as string[]) : [];
  const relatedSkills = await getRelatedSkills(skill.id, skill.category, 4);

  const formatDate = (timestamp: Date | null): string => {
    if (!timestamp) return 'Unknown';
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(timestamp);
  };

  return (
    <div className="flex flex-col gap-8">
      {/* Back navigation */}
      <Link
        href="/skills"
        className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Back to Skills
      </Link>

      {/* Two-column layout: main content + sidebar */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Main content — spans 2 columns on desktop */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Name */}
          <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
            {skill.name}
          </h1>

          {/* Tagline */}
          <p className="text-lg text-zinc-600 dark:text-zinc-400">
            {skill.tagline}
          </p>

          {/* Category badge */}
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
              {SKILL_CATEGORY_LABELS[skill.category as SkillCategory] || skill.category}
            </span>
            {skill.skillType && (
              <span className="rounded-full bg-zinc-100 px-3 py-1.5 text-sm font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                {skill.skillType}
              </span>
            )}
          </div>

          {/* Description */}
          <div className="prose prose-zinc dark:prose-invert max-w-none">
            {skill.description.split('\n\n').map((paragraph, i) => (
              <p key={i} className="text-base text-zinc-700 dark:text-zinc-300">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded bg-zinc-50 px-2.5 py-1 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">
          {/* Install command — primary CTA */}
          {skill.installCmd && (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-800 dark:bg-indigo-900/20">
              <h3 className="mb-2 text-sm font-semibold text-indigo-900 dark:text-indigo-100">
                Install this skill
              </h3>
              <div className="rounded bg-white px-3 py-2.5 font-mono text-sm text-zinc-800 shadow-sm dark:bg-zinc-900 dark:text-zinc-200">
                {skill.installCmd}
              </div>
              <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">
                Run in your OpenClaw terminal
              </p>
            </div>
          )}

          {/* Links card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Links</h3>
            <div className="flex flex-col gap-2">
              <a
                href={skill.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-[44px] items-center gap-2 rounded bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on ClawHub →
              </a>
              {skill.docsUrl && (
                <a
                  href={skill.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-h-[44px] items-center gap-2 rounded bg-zinc-50 px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                >
                  <svg className="h-4 w-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Documentation
                </a>
              )}
            </div>
          </div>

          {/* Details card */}
          <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-zinc-50">Details</h3>
            <div className="flex flex-col gap-2.5 text-sm">
              {skill.publisher && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">Publisher</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{skill.publisher}</span>
                </div>
              )}
              {skill.skillType && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">Type</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{skill.skillType}</span>
                </div>
              )}
              {skill.licenseType && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">License</span>
                  <span className="font-medium text-zinc-900 dark:text-zinc-50">{skill.licenseType}</span>
                </div>
              )}
              {skill.stars != null && skill.stars > 0 && (
                <div className="flex items-start justify-between gap-2">
                  <span className="text-zinc-600 dark:text-zinc-400">Stars</span>
                  <span className="flex items-center gap-1 font-medium text-zinc-900 dark:text-zinc-50">
                    <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20" aria-hidden="true">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                    {skill.stars.toLocaleString()}
                  </span>
                </div>
              )}
              <div className="flex items-start justify-between gap-2">
                <span className="text-zinc-600 dark:text-zinc-400">Added</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">
                  {formatDate(skill.createdAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Related Skills */}
      {relatedSkills.length > 0 && (
        <div className="mt-4">
          <h2 className="mb-4 text-xl font-bold text-zinc-900 dark:text-zinc-50">Related Skills</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {relatedSkills.map((related) => {
              const relatedTags = related.tags ? (JSON.parse(related.tags) as string[]) : [];
              return (
                <div
                  key={related.id}
                  className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <Link
                    href={`/skills/${related.slug}`}
                    className="text-sm font-bold text-zinc-900 hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
                  >
                    {related.name}
                  </Link>
                  <p className="mt-1 text-xs text-zinc-500 line-clamp-2 dark:text-zinc-400">
                    {related.tagline}
                  </p>
                  {related.installCmd && (
                    <div className="mt-2 rounded bg-zinc-50 px-2 py-1 font-mono text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                      {related.installCmd}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
