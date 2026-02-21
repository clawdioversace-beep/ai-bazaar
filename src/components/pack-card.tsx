import Link from 'next/link';

export interface PackCardProps {
  pack: {
    slug: string;
    name: string;
    tagline: string;
    coverImage?: string | null;
  };
}

/**
 * PackCard component - displays a starter pack as a card.
 *
 * Server Component (no client-side JS). Used on pack browse page.
 *
 * Shows: name (as link to detail page), tagline.
 * Future: coverImage support when added.
 *
 * Mobile: full width. Desktop: adapts to grid context.
 */
export default function PackCard({ pack }: PackCardProps) {
  return (
    <Link href={`/packs/${pack.slug}`}>
      <article className="group rounded-xl border border-zinc-200 bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
        <h2 className="mb-2 text-xl font-bold text-zinc-900 group-hover:text-indigo-600 dark:text-zinc-50 dark:group-hover:text-indigo-400 transition-colors">
          {pack.name}
        </h2>
        <p className="text-zinc-600 dark:text-zinc-400">{pack.tagline}</p>
      </article>
    </Link>
  );
}
