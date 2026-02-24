/**
 * Safety disclaimer banner for the /agent-skills page.
 * Warns users that skills run inside AI agents and can access their environment.
 */
export function SkillShDisclaimer() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800/50 dark:bg-amber-950/30">
      <div className="flex gap-3">
        <span className="mt-0.5 text-lg" aria-hidden="true">&#9888;&#65039;</span>
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Install with caution.
          </p>
          <p className="mt-1 text-sm leading-relaxed text-amber-800 dark:text-amber-300/90">
            Skills run inside your AI agent and can read/write files, make API calls,
            and access your environment. Only install skills from repositories you&apos;ve
            reviewed and trust.
          </p>
        </div>
      </div>
    </div>
  );
}
