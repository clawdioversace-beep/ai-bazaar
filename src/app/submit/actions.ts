'use server';

import { z } from 'zod';
import { Octokit } from 'octokit';
import { createListing, getListingBySourceUrl } from '@/services/catalog';
import { createSlug } from '@/lib/catalog-schema';
import { CATEGORIES } from '@/lib/categories';
import type { CatalogEntryInput } from '@/lib/catalog-schema';

/**
 * GitHub repository metadata returned by fetchGitHubMeta.
 */
export type GitHubMeta = {
  name: string;
  description: string;
  stars: number;
  language: string | null;
  topics: string[];
  license: string | null;
};

export type GitHubMetaResult = GitHubMeta | { error: string };

/**
 * Website metadata returned by fetchWebsiteMeta.
 */
export type WebsiteMeta = {
  title?: string;
  description?: string;
  ogImage?: string;
  favicon?: string;
};

export type WebsiteMetaResult = WebsiteMeta | { error: string };

/**
 * Form state returned by submitListing.
 */
export type FormState = {
  errors?: {
    url?: string[];
    name?: string[];
    description?: string[];
    category?: string[];
    mode?: string[];
    [key: string]: string[] | undefined;
  };
  existingSlug?: string;
  success?: boolean;
  message?: string;
};

/**
 * Form validation schema for tool submission.
 *
 * Dual-mode: accepts both GitHub repos and website/SaaS URLs.
 */
const SubmitFormSchema = z.object({
  mode: z.enum(['github', 'website']),
  url: z.string().url({ message: 'Please enter a valid URL' }),
  name: z.string().min(1, 'Tool name is required').max(100),
  description: z
    .string()
    .min(20, 'Description must be at least 20 characters')
    .max(500),
  category: z.enum(CATEGORIES, {
    errorMap: () => ({ message: 'Please select a category' }),
  }),
  tags: z.string().max(200).optional(),
  pricing: z.enum(['free', 'freemium', 'paid', 'open-source']).optional(),
  stars: z.coerce.number().int().min(0).optional(),
  language: z.string().optional(),
});

/**
 * Extracts a readable name from a URL (fallback only — form enforces name field).
 */
function deriveNameFromUrl(url: string): string {
  try {
    const parsed = new URL(url);

    // GitHub: extract repo name
    if (parsed.hostname === 'github.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        const repoName = parts[1].replace(/\.git$/, '');
        return repoName
          .split('-')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
      }
    }

    // npm: extract package name
    if (parsed.hostname === 'www.npmjs.com' || parsed.hostname === 'npmjs.com') {
      const parts = parsed.pathname.split('/').filter(Boolean);
      const pkgName = parts[parts.length - 1];
      return pkgName
        .split('-')
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }

    // Fallback: hostname without TLD
    const hostname = parsed.hostname.replace(/^www\./, '');
    const baseName = hostname.split('.')[0];
    return baseName.charAt(0).toUpperCase() + baseName.slice(1);
  } catch {
    return 'Tool';
  }
}

/**
 * Map GitHub language to runtime enum value.
 */
function languageToRuntime(language: string | null): CatalogEntryInput['runtime'] {
  if (!language) return undefined;
  const lang = language.toLowerCase();
  if (lang === 'typescript' || lang === 'javascript') return 'node';
  if (lang === 'python') return 'python';
  if (lang === 'rust') return 'rust';
  if (lang === 'go') return 'go';
  return 'other';
}

/**
 * Server Action: Fetch GitHub repository metadata from the GitHub API.
 *
 * Validates URL is a GitHub repo (owner/repo format), calls the Octokit
 * REST API, and returns structured metadata for pre-populating the form.
 *
 * @param url - GitHub repository URL (e.g. https://github.com/org/repo)
 * @returns Repo metadata or { error: string } on failure
 */
export async function fetchGitHubMeta(url: string): Promise<GitHubMetaResult> {
  // Validate URL matches github.com/{owner}/{repo} format
  let owner: string;
  let repo: string;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== 'github.com') {
      return { error: 'Not a GitHub URL' };
    }
    const parts = parsed.pathname.split('/').filter(Boolean);
    if (parts.length < 2) {
      return { error: 'URL must point to a repository (github.com/owner/repo)' };
    }
    owner = parts[0];
    repo = parts[1].replace(/\.git$/, '');
  } catch {
    return { error: 'Invalid URL format' };
  }

  try {
    const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
    const { data } = await octokit.rest.repos.get({ owner, repo });

    return {
      name: data.full_name,
      description: data.description || '',
      stars: data.stargazers_count,
      language: data.language ?? null,
      topics: data.topics ?? [],
      license: data.license?.spdx_id ?? null,
    };
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'status' in err) {
      const status = (err as { status: number }).status;
      if (status === 404) return { error: 'Repository not found or is private' };
      if (status === 403) return { error: 'GitHub API rate limit exceeded — try again later' };
    }
    return { error: 'Failed to fetch repository info from GitHub' };
  }
}

/**
 * Server Action: Fetch basic metadata from a website URL.
 *
 * Does a best-effort fetch of the page HTML and extracts title, meta
 * description, og:image, and favicon via regex. Failures are non-fatal —
 * the form can be filled manually if this returns an error.
 *
 * @param url - Website URL to fetch metadata from
 * @returns Page metadata or { error: string } on failure
 */
export async function fetchWebsiteMeta(url: string): Promise<WebsiteMetaResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AI-Bazaar-Bot/1.0' },
    });

    if (!res.ok) {
      return { error: `Failed to fetch page (HTTP ${res.status})` };
    }

    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return { error: 'URL does not point to an HTML page' };
    }

    const html = (await res.text()).slice(0, 50000);

    // Extract title
    const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
    const title = titleMatch ? titleMatch[1].trim() : undefined;

    // Extract meta description — handle both attribute orderings
    const descMatch =
      html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+name=["']description["']/i);
    const description = descMatch ? descMatch[1].trim() : undefined;

    // Extract og:image
    const ogImageMatch =
      html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i) ||
      html.match(/<meta\s+content=["']([^"']+)["']\s+property=["']og:image["']/i);
    const ogImage = ogImageMatch ? ogImageMatch[1].trim() : undefined;

    // Extract favicon
    const faviconMatch = html.match(/<link\s+rel=["']icon["'][^>]+href=["']([^"']+)["']/i);
    const favicon = faviconMatch ? faviconMatch[1].trim() : undefined;

    return { title, description, ogImage, favicon };
  } catch {
    return { error: 'Failed to fetch page — check the URL and try again' };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Server Action: Submit a new tool listing for review.
 *
 * Accepts dual-mode submissions (GitHub repos or SaaS/website URLs).
 * Validates form data, checks for duplicates, creates a stub listing
 * with verified=false, and returns a success message. No redirect.
 *
 * @param prevState - Previous form state (required by useActionState)
 * @param formData - Form data from the submission form
 */
export async function submitListing(
  prevState: unknown,
  formData: FormData
): Promise<FormState> {
  // Parse form data through Zod schema
  const validatedFields = SubmitFormSchema.safeParse({
    mode: formData.get('mode'),
    url: formData.get('url'),
    name: formData.get('name'),
    description: formData.get('description'),
    category: formData.get('category'),
    tags: formData.get('tags') || undefined,
    pricing: formData.get('pricing') || undefined,
    stars: formData.get('stars') || undefined,
    language: formData.get('language') || undefined,
  });

  // Return validation errors
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { mode, url, name, description, category, tags, stars, language } =
    validatedFields.data;

  // Check for duplicate by normalized sourceUrl
  const existing = await getListingBySourceUrl(url);
  if (existing) {
    return {
      errors: {
        url: ['This tool is already listed'],
      },
      existingSlug: existing.slug,
    };
  }

  // Parse tags string into array
  const tagsArray = tags
    ? tags.split(',').map((t) => t.trim()).filter(Boolean)
    : [];

  // Determine runtime from language (GitHub mode)
  const runtime = mode === 'github' ? languageToRuntime(language ?? null) : undefined;

  // Derive fallback name from URL if somehow empty (form enforces name field)
  const finalName = name || deriveNameFromUrl(url);
  const finalSlug = createSlug(finalName);

  // Create stub listing with verified=false (pending review)
  await createListing({
    sourceUrl: url,
    name: finalName,
    slug: finalSlug,
    tagline: description.slice(0, 160),
    description,
    category,
    tags: tagsArray,
    stars: stars ?? 0,
    runtime,
    submittedBy: 'web-form',
    verified: false,
  });

  return {
    success: true,
    message: 'Tool submitted! It will appear after review.',
  };
}
