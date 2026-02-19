'use client';

/**
 * src/components/upvote-button.tsx
 *
 * Client Component for anonymous upvote functionality.
 *
 * Features:
 * - React 19 useOptimistic for instant UI feedback
 * - sessionStorage-based duplicate prevention (one vote per session)
 * - Visual state: default, voted, pending
 * - No authentication required
 */

import { useOptimistic, useTransition, useState, useEffect } from 'react';
import { upvoteListing } from '@/app/tools/[slug]/actions';
import { hasUpvoted, markUpvoted } from '@/lib/upvote-tracker';

interface UpvoteButtonProps {
  listingId: string;
  initialUpvotes: number;
}

export function UpvoteButton({ listingId, initialUpvotes }: UpvoteButtonProps) {
  const [isPending, startTransition] = useTransition();

  // Optimistic upvote count for instant UI feedback
  const [optimisticUpvotes, addOptimisticUpvote] = useOptimistic(
    initialUpvotes,
    (state: number) => state + 1
  );

  // Track if user has voted (checked after mount to avoid SSR issues)
  const [voted, setVoted] = useState(false);

  // Check sessionStorage on client mount (SSR-safe)
  useEffect(() => {
    setVoted(hasUpvoted(listingId));
  }, [listingId]);

  const handleUpvote = () => {
    if (voted) return; // Already voted in this session

    // Mark as voted immediately (optimistic local state)
    markUpvoted(listingId);
    setVoted(true);

    // Update UI optimistically and call Server Action
    startTransition(async () => {
      addOptimisticUpvote(null);
      await upvoteListing(listingId);
    });
  };

  return (
    <button
      onClick={handleUpvote}
      disabled={voted || isPending}
      className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        voted
          ? 'border-green-200 bg-green-50 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-300'
          : 'border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700'
      } ${isPending ? 'opacity-50' : ''} disabled:cursor-not-allowed`}
    >
      {/* Arrow-up icon */}
      <svg
        className="h-4 w-4 fill-current"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z"
          clipRule="evenodd"
        />
      </svg>
      <span>{optimisticUpvotes}</span>
    </button>
  );
}
