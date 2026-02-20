import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { getPackWithTools } from '@/services/packs';

export const dynamic = 'force-dynamic';

/**
 * Generate dynamic metadata for pack detail pages.
 * Creates SEO-friendly title, description, and OpenGraph tags.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = await getPackWithTools(slug);

  if (!pack) {
    return { title: 'Pack Not Found | AI Bazaar' };
  }

  return {
    title: `${pack.name} | AI Bazaar Starter Packs`,
    description: pack.tagline,
    openGraph: {
      title: pack.name,
      description: pack.tagline,
    },
  };
}

/**
 * Pack detail page - shows pack metadata and ordered tool list with narrative.
 *
 * Server Component with scrollytelling layout: each tool has a step number,
 * name (linked to full listing), tagline, and narrative explaining its role
 * in the pack.
 *
 * Calls notFound() if slug doesn't exist → renders custom 404 page.
 */
export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const pack = await getPackWithTools(slug);

  if (!pack) {
    notFound();
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          {pack.name}
        </h1>
        <p className="mt-3 text-xl text-zinc-600 dark:text-zinc-400">
          {pack.tagline}
        </p>
      </div>

      {/* Pack description (narrative intro) */}
      <div className="prose prose-zinc dark:prose-invert mt-8 mb-12 max-w-none">
        <p>{pack.description}</p>
      </div>

      {/* Tool count badge */}
      <p className="mb-8 text-sm text-zinc-500 dark:text-zinc-400">
        {pack.tools.length} {pack.tools.length === 1 ? 'tool' : 'tools'} in
        this pack
      </p>

      {/* Tools list with narrative sections */}
      {pack.tools.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          Tools in this pack are being updated. Check back soon!
        </p>
      ) : (
        <div className="space-y-12">
          {pack.tools.map((pt, idx) => (
            <section
              key={pt.toolId}
              className="flex items-start gap-4 sm:gap-6"
            >
              {/* Step number */}
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-lg font-bold text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                {idx + 1}
              </div>

              {/* Tool content */}
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-zinc-900 dark:text-zinc-50">
                  <Link
                    href={`/tools/${pt.tool.slug}`}
                    className="hover:underline"
                  >
                    {pt.tool.name}
                  </Link>
                </h2>
                <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                  {pt.tool.tagline}
                </p>
                {/* Narrative: WHY this tool matters in this pack */}
                <p className="mt-3 leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {pt.narrative}
                </p>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Back link */}
      <Link
        href="/packs"
        className="mt-12 inline-block text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        ← Back to all packs
      </Link>
    </div>
  );
}
