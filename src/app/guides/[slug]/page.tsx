import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { getGuide, listGuides } from '@/lib/guides';

export const dynamic = 'force-dynamic';

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

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    return { title: 'Guide Not Found | AI Bazaar' };
  }

  return {
    title: `${guide.frontmatter.title} | AI Bazaar Guides`,
    description: guide.frontmatter.tagline,
    openGraph: {
      title: guide.frontmatter.title,
      description: guide.frontmatter.tagline,
    },
  };
}

export default async function GuideDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const guide = getGuide(slug);

  if (!guide) {
    notFound();
  }

  const { frontmatter, content } = guide;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Back link */}
      <Link
        href="/guides"
        className="mb-6 inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        &larr; All guides
      </Link>

      {/* Header */}
      <div className="mb-8">
        {/* Badges */}
        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2.5 py-0.5 font-semibold ${DIFFICULTY_STYLES[frontmatter.difficulty]}`}
          >
            {frontmatter.difficulty === 'beginner'
              ? 'Beginner'
              : 'Intermediate'}
          </span>
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 font-semibold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            {CATEGORY_LABELS[frontmatter.category] || frontmatter.category}
          </span>
          <span className="text-zinc-500 dark:text-zinc-500">
            {frontmatter.readingTime}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          {frontmatter.title}
        </h1>
        <p className="mt-3 text-lg text-zinc-600 dark:text-zinc-400">
          {frontmatter.tagline}
        </p>
      </div>

      {/* MDX Content */}
      <article className="prose prose-zinc dark:prose-invert max-w-none prose-headings:scroll-mt-20 prose-h2:text-2xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-xl prose-h3:font-semibold prose-h3:mt-8 prose-h3:mb-3 prose-p:leading-relaxed prose-a:text-indigo-600 prose-a:no-underline hover:prose-a:underline dark:prose-a:text-indigo-400 prose-code:rounded prose-code:bg-zinc-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-zinc-800 prose-pre:rounded-xl prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-zinc-800 prose-blockquote:border-indigo-300 dark:prose-blockquote:border-indigo-700 prose-img:rounded-xl">
        <MDXRemote source={content} />
      </article>

      {/* Related packs */}
      {frontmatter.relatedPacks && frontmatter.relatedPacks.length > 0 && (
        <div className="mt-12 rounded-xl border border-zinc-200 bg-zinc-50 p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Related Starter Packs
          </h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {frontmatter.relatedPacks.map((packSlug) => (
              <Link
                key={packSlug}
                href={`/packs/${packSlug}`}
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-sm font-medium text-zinc-900 transition-colors hover:border-indigo-300 hover:text-indigo-600 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:hover:border-indigo-600 dark:hover:text-indigo-400"
              >
                {packSlug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())} &rarr;
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Prev / Next navigation */}
      <div className="mt-10 flex items-center justify-between border-t border-zinc-200 pt-6 dark:border-zinc-800">
        {frontmatter.prevGuide ? (
          <Link
            href={`/guides/${frontmatter.prevGuide}`}
            className="text-sm font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            &larr; Previous guide
          </Link>
        ) : (
          <span />
        )}
        {frontmatter.nextGuide ? (
          <Link
            href={`/guides/${frontmatter.nextGuide}`}
            className="text-sm font-medium text-zinc-600 hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
          >
            Next guide &rarr;
          </Link>
        ) : (
          <span />
        )}
      </div>
    </div>
  );
}
