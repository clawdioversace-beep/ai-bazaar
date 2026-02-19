import type { Metadata } from 'next';
import { SubmitForm } from '@/components/submit-form';

export const metadata: Metadata = {
  title: 'Submit a Tool | AI Bazaar',
  description:
    'Submit your AI, agent, or Web3 tool to AI Bazaar. No account required.',
};

/**
 * Tool submission page.
 *
 * Server Component that exports metadata and renders the Client Component form.
 * Progressive enhancement via Server Actions — works without JavaScript.
 */
export default function SubmitPage() {
  return (
    <div className="mx-auto max-w-2xl">
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">
          Submit a Tool
        </h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Add your AI, agent, or Web3 tool to AI Bazaar. Submissions are reviewed
          and enriched automatically. No account required.
        </p>
      </div>

      {/* Form Card */}
      <div className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <SubmitForm />
      </div>

      {/* Help Text */}
      <div className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
        <p>
          <strong>Tip:</strong> Paste a GitHub repo, npm package, or project
          homepage URL. We&apos;ll auto-detect the tool name and metadata.
        </p>
      </div>
    </div>
  );
}
