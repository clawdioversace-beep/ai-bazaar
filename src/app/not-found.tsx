import Link from 'next/link';

/**
 * Custom 404 page for the entire app.
 *
 * Server Component (no client-side JS). Rendered when:
 * - A page calls notFound() (e.g., /tools/[slug] with invalid slug)
 * - A URL doesn't match any route
 *
 * Provides navigation back to /tools (browse) and / (home).
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      {/* 404 heading */}
      <div className="flex flex-col gap-2">
        <h1 className="text-6xl font-bold text-zinc-900 dark:text-zinc-50">
          404
        </h1>
        <h2 className="text-2xl font-semibold text-zinc-700 dark:text-zinc-300">
          Page Not Found
        </h2>
      </div>

      {/* Friendly message */}
      <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
        The tool you&apos;re looking for doesn&apos;t exist or may have been
        removed.
      </p>

      {/* Navigation links */}
      <div className="flex flex-col gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/tools"
          className="rounded-lg bg-zinc-900 px-6 py-3 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
        >
          Browse All Tools
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-zinc-300 px-6 py-3 font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Go Home
        </Link>
      </div>
    </div>
  );
}
