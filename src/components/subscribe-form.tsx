'use client';

import { useActionState } from 'react';
import { subscribe } from '@/app/subscribe/actions';

interface SubscribeFormProps {
  source: string;
  compact?: boolean;
}

export function SubscribeForm({ source, compact }: SubscribeFormProps) {
  const [state, formAction, pending] = useActionState(
    async (_prev: any, formData: FormData) => {
      formData.set('source', source);
      return subscribe(formData);
    },
    null,
  );

  if (state?.success) {
    return (
      <p className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
        You&apos;re in! We&apos;ll send you the best AI tools weekly.
      </p>
    );
  }

  return (
    <form action={formAction} className={compact ? 'flex gap-2' : 'flex gap-2 sm:max-w-md'}>
      <input
        type="email"
        name="email"
        required
        placeholder="you@example.com"
        className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-50 dark:placeholder:text-zinc-500"
      />
      <button
        type="submit"
        disabled={pending}
        className="whitespace-nowrap rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? 'Subscribing...' : 'Subscribe'}
      </button>
      {state?.error && (
        <p className="absolute mt-12 text-xs text-red-500">{state.error}</p>
      )}
    </form>
  );
}
