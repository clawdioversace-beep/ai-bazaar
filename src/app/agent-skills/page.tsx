import { getTopSkills, getTrendingSkills, getLastUpdated } from '@/services/skills-sh';
import { SkillShCard } from '@/components/skill-sh-card';
import { SkillShDisclaimer } from '@/components/skill-sh-disclaimer';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Agent Skills Leaderboard | AI Bazaar',
  description:
    'Top agent skills from skills.sh — the open ecosystem for reusable AI agent capabilities. See the all-time leaders and what\'s trending today.',
};

export default async function AgentSkillsPage() {
  const [topSkills, trendingSkills, lastUpdated] = await Promise.all([
    getTopSkills(10),
    getTrendingSkills(10),
    getLastUpdated(),
  ]);

  const updatedAt = lastUpdated
    ? new Date(lastUpdated * 1000).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : null;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-medium text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>
            skills.sh
          </span>
          <Link
            href="https://skills.sh"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 transition-colors hover:text-indigo-600 dark:hover:text-indigo-400"
          >
            Visit skills.sh &nearr;
          </Link>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
          Agent Skills Leaderboard
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          The most-installed reusable capabilities for AI agents.
          One command to enhance your agent with new powers.
        </p>
      </div>

      {/* Safety disclaimer */}
      <div className="mb-8">
        <SkillShDisclaimer />
      </div>

      {/* Top 10 All Time */}
      {topSkills.length > 0 && (
        <section className="mb-12">
          <h2 className="mb-4 text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            Top 10 All Time
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {topSkills.map((skill) => (
              <SkillShCard key={skill.name} skill={skill} rankField="allTimeRank" />
            ))}
          </div>
        </section>
      )}

      {/* Trending Today */}
      {trendingSkills.length > 0 && (
        <section className="mb-12">
          <div className="mb-4 flex items-center gap-2">
            <svg className="h-5 w-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5 .5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
            </svg>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
              Trending Today
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {trendingSkills.map((skill) => (
              <SkillShCard key={skill.name} skill={skill} rankField="trendingRank" />
            ))}
          </div>
        </section>
      )}

      {/* Footer note */}
      <div className="border-t border-zinc-200 pt-6 text-center text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        Data from{' '}
        <a
          href="https://skills.sh"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300"
        >
          skills.sh
        </a>
        {updatedAt && <> &middot; Last updated {updatedAt}</>}
      </div>
    </div>
  );
}
