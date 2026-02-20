import { listPacks } from '@/services/packs';
import PackCard from '@/components/pack-card';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Starter Packs | AI Bazaar',
  description:
    'Curated collections of AI, agent, and Web3 tools for common use cases. Get started fast with expert-picked toolkits.',
  openGraph: {
    title: 'Starter Packs | AI Bazaar',
    description:
      'Curated collections of AI, agent, and Web3 tools for common use cases.',
  },
};

/**
 * Pack browse page - shows all starter packs as cards in a responsive grid.
 *
 * Server Component (no client-side JS). Fetches all packs server-side.
 *
 * Layout: header with title + subtitle, then responsive grid of pack cards.
 */
export default async function PacksPage() {
  const packs = await listPacks();

  return (
    <div className="flex flex-col gap-10">
      {/* Header section */}
      <div>
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50 sm:text-4xl">
          Starter Packs
        </h1>
        <p className="mt-4 text-lg text-zinc-600 dark:text-zinc-400">
          Curated collections of tools for common use cases. Each pack tells
          you what to use and why.
        </p>
      </div>

      {/* Pack cards grid */}
      {packs.length === 0 ? (
        <p className="text-zinc-600 dark:text-zinc-400">
          No starter packs available yet. Check back soon!
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {packs.map((pack) => (
            <PackCard key={pack.id} pack={pack} />
          ))}
        </div>
      )}
    </div>
  );
}
