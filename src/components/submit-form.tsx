'use client';

import { useActionState } from 'react';
import { submitListing } from '@/app/submit/actions';
import Link from 'next/link';

type FormState = {
  errors?: {
    url?: string[];
    name?: string[];
    description?: string[];
  };
  existingSlug?: string;
};

/**
 * Client Component for tool submission form.
 *
 * Uses useActionState for progressive enhancement — works without JavaScript
 * via Server Actions. Displays inline validation errors and handles duplicate
 * submission detection.
 */
export function SubmitForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitListing,
    {}
  );

  return (
    <form action={action} className="space-y-6">
      {/* URL Field (Required) */}
      <div>
        <label
          htmlFor="url"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Tool URL <span className="text-red-600">*</span>
        </label>
        <input
          type="url"
          name="url"
          id="url"
          required
          placeholder="https://github.com/org/repo"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          aria-describedby={state?.errors?.url ? 'url-error' : undefined}
        />
        {state?.errors?.url && (
          <p id="url-error" className="mt-1 text-sm text-red-600">
            {state.errors.url[0]}
          </p>
        )}
        {state?.existingSlug && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This tool is already listed.{' '}
            <Link
              href={`/tools/${state.existingSlug}`}
              className="font-medium text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-300"
            >
              View it here →
            </Link>
          </p>
        )}
      </div>

      {/* Name Field (Optional) */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Tool Name <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          type="text"
          name="name"
          id="name"
          placeholder="Tool name (auto-detected if blank)"
          maxLength={100}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          aria-describedby={state?.errors?.name ? 'name-error' : undefined}
        />
        {state?.errors?.name && (
          <p id="name-error" className="mt-1 text-sm text-red-600">
            {state.errors.name[0]}
          </p>
        )}
      </div>

      {/* Description Field (Optional) */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Description <span className="text-zinc-400">(optional)</span>
        </label>
        <textarea
          name="description"
          id="description"
          rows={3}
          placeholder="Brief description (optional)"
          maxLength={500}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          aria-describedby={state?.errors?.description ? 'description-error' : undefined}
        />
        {state?.errors?.description && (
          <p id="description-error" className="mt-1 text-sm text-red-600">
            {state.errors.description[0]}
          </p>
        )}
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
      >
        {pending ? 'Submitting...' : 'Submit Tool'}
      </button>
    </form>
  );
}
