'use client';

import { useActionState, useState, useCallback } from 'react';
import { submitListing, fetchGitHubMeta, fetchWebsiteMeta } from '@/app/submit/actions';
import type { FormState } from '@/app/submit/actions';
import { CATEGORIES, CATEGORY_LABELS } from '@/lib/categories';
import type { Category } from '@/lib/categories';
import Link from 'next/link';

/**
 * Detect whether a URL is a GitHub repository URL.
 *
 * Returns true if URL hostname is github.com and pathname has at least
 * two segments (owner/repo). Any other URL is treated as website mode.
 */
function detectGitHubMode(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') return false;
    const parts = parsed.pathname.split('/').filter(Boolean);
    return parts.length >= 2;
  } catch {
    return false;
  }
}

/**
 * Dual-mode submit form for tool submissions.
 *
 * Auto-detects URL type on input:
 * - github.com/owner/repo → GitHub mode: fetches name, description, stars, language
 * - Any other URL → Website mode: best-effort title/description fetch, pricing field shown
 *
 * Uses useActionState for progressive enhancement. Shows success banner on
 * successful submission (no redirect — listing is pending review).
 */
export function SubmitForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    submitListing,
    {}
  );

  // Form field state
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'github' | 'website'>('website');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<Category>('framework');
  const [tags, setTags] = useState('');
  const [pricing, setPricing] = useState('');
  const [stars, setStars] = useState<number | ''>('');
  const [language, setLanguage] = useState('');

  // Fetch state
  const [isFetching, setIsFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [githubInfo, setGithubInfo] = useState<{ stars: number; language: string | null } | null>(null);

  /**
   * Handle URL change — detect mode instantly on each keystroke.
   */
  const handleUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newUrl = e.target.value;
    setUrl(newUrl);
    const isGitHub = detectGitHubMode(newUrl);
    setMode(isGitHub ? 'github' : 'website');
    // Clear fetch info when URL changes
    setFetchError('');
    setGithubInfo(null);
  }, []);

  /**
   * Handle URL blur — trigger metadata fetch when user leaves the URL field.
   */
  const handleUrlBlur = useCallback(async () => {
    if (!url || !url.startsWith('http')) return;

    setIsFetching(true);
    setFetchError('');
    setGithubInfo(null);

    if (mode === 'github') {
      const result = await fetchGitHubMeta(url);
      setIsFetching(false);

      if ('error' in result) {
        setFetchError(result.error);
      } else {
        setName(result.name);
        setDescription(result.description || '');
        setStars(result.stars);
        setLanguage(result.language ?? '');
        setGithubInfo({ stars: result.stars, language: result.language });
        // Pre-set to framework as sensible default for GitHub repos
        setCategory('framework');
      }
    } else {
      const result = await fetchWebsiteMeta(url);
      setIsFetching(false);

      // Website fetch is best-effort — silently ignore errors
      if (!('error' in result)) {
        if (result.title && !name) setName(result.title);
        if (result.description && !description) setDescription(result.description);
      }
    }
  }, [url, mode, name, description]);

  // Show success banner if submission succeeded
  if (state?.success) {
    return (
      <div className="rounded-lg bg-green-100 p-6 text-center dark:bg-green-900/30">
        <p className="text-lg font-medium text-green-800 dark:text-green-300">
          {state.message}
        </p>
        <p className="mt-2 text-sm text-green-700 dark:text-green-400">
          Our team will review your submission and publish it shortly.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-6">
      {/* Hidden fields for mode, stars, language */}
      <input type="hidden" name="mode" value={mode} />
      <input type="hidden" name="stars" value={stars === '' ? '' : String(stars)} />
      <input type="hidden" name="language" value={language} />

      {/* URL Field */}
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
          value={url}
          onChange={handleUrlChange}
          onBlur={handleUrlBlur}
          placeholder="https://github.com/org/repo or https://yourtool.com"
          className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          aria-describedby={state?.errors?.url ? 'url-error' : undefined}
        />

        {/* Mode indicator badge */}
        {url && (
          <div className="mt-2">
            {mode === 'github' ? (
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/40 dark:text-green-300">
                GitHub Repository detected
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                Website / SaaS
              </span>
            )}
          </div>
        )}

        {/* Fetch loading state */}
        {isFetching && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {mode === 'github' ? 'Fetching repository info...' : 'Fetching page info...'}
          </p>
        )}

        {/* Fetch error (only shown for GitHub mode — website errors are silent) */}
        {fetchError && mode === 'github' && (
          <p className="mt-1 text-sm text-amber-600 dark:text-amber-400">
            {fetchError} — fill fields manually below.
          </p>
        )}

        {/* URL validation error */}
        {state?.errors?.url && (
          <p id="url-error" className="mt-1 text-sm text-red-600">
            {state.errors.url[0]}
          </p>
        )}

        {/* Duplicate listing link */}
        {state?.existingSlug && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            This tool is already listed.{' '}
            <Link
              href={`/tools/${state.existingSlug}`}
              className="font-medium text-zinc-900 underline hover:text-zinc-700 dark:text-zinc-50 dark:hover:text-zinc-300"
            >
              View it here &rarr;
            </Link>
          </p>
        )}
      </div>

      {/* GitHub info bar (stars + language) */}
      {githubInfo && (
        <div className="flex items-center gap-4 rounded-lg bg-zinc-50 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-800/50 dark:text-zinc-400">
          <span>
            <span className="font-medium text-zinc-900 dark:text-zinc-100">{githubInfo.stars.toLocaleString()}</span>{' '}
            stars
          </span>
          {githubInfo.language && (
            <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
              {githubInfo.language}
            </span>
          )}
        </div>
      )}

      {/* Tool Name */}
      <div>
        <label
          htmlFor="name"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Tool Name <span className="text-red-600">*</span>
        </label>
        <input
          type="text"
          name="name"
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Tool name"
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

      {/* Description */}
      <div>
        <label
          htmlFor="description"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Description <span className="text-red-600">*</span>
        </label>
        <textarea
          name="description"
          id="description"
          rows={3}
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description (at least 20 characters)"
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

      {/* Category */}
      <div>
        <label
          htmlFor="category"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Category <span className="text-red-600">*</span>
        </label>
        <select
          name="category"
          id="category"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value as Category)}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          aria-describedby={state?.errors?.category ? 'category-error' : undefined}
        >
          {CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {CATEGORY_LABELS[cat]}
            </option>
          ))}
        </select>
        {state?.errors?.category && (
          <p id="category-error" className="mt-1 text-sm text-red-600">
            {state.errors.category[0]}
          </p>
        )}
      </div>

      {/* Tags */}
      <div>
        <label
          htmlFor="tags"
          className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          Tags <span className="text-zinc-400">(optional)</span>
        </label>
        <input
          type="text"
          name="tags"
          id="tags"
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="ai, automation, devtools — comma separated"
          maxLength={200}
          className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
        />
      </div>

      {/* Pricing (website mode only) */}
      {mode === 'website' && (
        <div>
          <label
            htmlFor="pricing"
            className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
          >
            Pricing <span className="text-zinc-400">(optional)</span>
          </label>
          <select
            name="pricing"
            id="pricing"
            value={pricing}
            onChange={(e) => setPricing(e.target.value)}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2 text-sm focus:border-zinc-500 focus:outline-none focus:ring-1 focus:ring-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Select pricing model</option>
            <option value="free">Free</option>
            <option value="freemium">Freemium</option>
            <option value="paid">Paid</option>
            <option value="open-source">Open Source</option>
          </select>
        </div>
      )}

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
