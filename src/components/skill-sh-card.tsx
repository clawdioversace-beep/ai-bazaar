/**
 * Card component for skills.sh leaderboard entries.
 * Shows rank, name, source repo, description, install count, and install command.
 */

import type { SkillSh } from '@/db/schema';

interface SkillShCardProps {
  skill: SkillSh;
  rankField: 'allTimeRank' | 'trendingRank';
}

function formatInstalls(count: number): string {
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1)}M`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1)}K`;
  return count.toLocaleString();
}

export function SkillShCard({ skill, rankField }: SkillShCardProps) {
  const rank = skill[rankField];
  const repoUrl = `https://github.com/${skill.sourceRepo}`;
  const skillUrl = `https://skills.sh/${skill.sourceRepo}/${skill.name}`;

  return (
    <div className="group relative flex flex-col gap-3 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-all duration-200 hover:shadow-md hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700">
      {/* Rank + install count header */}
      <div className="flex items-center justify-between">
        {rank != null && (
          <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-bold text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
            #{rank}
          </span>
        )}
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {formatInstalls(skill.installCount ?? 0)} installs
        </span>
      </div>

      {/* Skill name */}
      <a
        href={skillUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-base font-bold text-zinc-900 transition-colors hover:text-indigo-600 dark:text-zinc-50 dark:hover:text-indigo-400"
      >
        {skill.name}
      </a>

      {/* Source repo */}
      <a
        href={repoUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-indigo-600 dark:text-zinc-400 dark:hover:text-indigo-400"
      >
        <svg className="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {skill.sourceRepo}
      </a>

      {/* Description */}
      {skill.description && (
        <p className="flex-1 text-sm leading-relaxed text-zinc-600 line-clamp-2 dark:text-zinc-400">
          {skill.description}
        </p>
      )}

      {/* Install command */}
      {skill.installCmd && (
        <div className="mt-auto rounded bg-zinc-50 px-3 py-2 font-mono text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
          $ {skill.installCmd}
        </div>
      )}
    </div>
  );
}
