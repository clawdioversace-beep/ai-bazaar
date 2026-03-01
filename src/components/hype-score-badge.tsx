export interface HypeScoreBadgeProps {
  score: number;
  /** 'sm' for listing cards, 'lg' for detail page sidebar */
  size?: 'sm' | 'lg';
}

const TOOLTIP = 'Hype Score — based on GitHub stars, downloads, recency, and community upvotes';

function getTier(score: number) {
  if (score >= 70) return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', bar: 'bg-red-500' };
  if (score >= 40) return { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-700 dark:text-orange-300', bar: 'bg-orange-500' };
  return { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-300', bar: 'bg-yellow-500' };
}

export function HypeScoreBadge({ score, size = 'sm' }: HypeScoreBadgeProps) {
  const tier = getTier(score);

  if (size === 'lg') {
    return (
      <div className={`flex items-center gap-2 ${tier.text}`} title={TOOLTIP}>
        <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5.5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
        </svg>
        <span className="text-3xl font-bold">{score}</span>
        <span className="text-sm font-medium opacity-60">/100</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${tier.bg} ${tier.text}`}
      title={`Hype Score: ${score}/100 — ${TOOLTIP}`}
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5.5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
      </svg>
      {score}
    </div>
  );
}
