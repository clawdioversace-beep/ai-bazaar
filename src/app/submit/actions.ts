'use server';

import { z } from 'zod';
import { redirect } from 'next/navigation';
import { createListing, getListingBySourceUrl } from '@/services/catalog';
import { createSlug } from '@/lib/catalog-schema';

/**
 * Form validation schema for tool submission.
 *
 * Progressive enhancement: works without JavaScript via Server Actions.
 */
const SubmitFormSchema = z.object({
  url: z.string().url({ message: 'Please enter a valid URL' }),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
});

type FormState = {
  errors?: {
    url?: string[];
    name?: string[];
    description?: string[];
  };
  existingSlug?: string;
};

/**
 * Extracts a readable name from a URL.
 *
 * - GitHub: "https://github.com/org/repo" → "Repo"
 * - npm: "https://www.npmjs.com/package/name" → "Name"
 * - Fallback: hostname without TLD → "example" from "example.com"
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
      const pkgName = parts[parts.length - 1]; // last segment is package name
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
 * Server Action for tool submission.
 *
 * Validates URL, checks for duplicates via normalized sourceUrl, creates a stub
 * listing, and redirects to the new listing page.
 *
 * @param prevState - Previous form state (not used, required by useActionState)
 * @param formData - Form data from the submission form
 */
export async function submitListing(
  prevState: unknown,
  formData: FormData
): Promise<FormState> {
  // Parse form data through Zod schema
  const validatedFields = SubmitFormSchema.safeParse({
    url: formData.get('url'),
    name: formData.get('name') || undefined,
    description: formData.get('description') || undefined,
  });

  // Return validation errors
  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    };
  }

  const { url, name, description } = validatedFields.data;

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

  // Derive name from URL if not provided
  const finalName = name || deriveNameFromUrl(url);

  // Create stub listing
  const listing = await createListing({
    sourceUrl: url,
    name: finalName,
    slug: createSlug(finalName),
    tagline: description || 'Submitted via AI Bazaar',
    description: description || 'This tool was submitted to AI Bazaar and is awaiting enrichment.',
    category: 'framework', // Safe default per Phase 4 decision
    tags: [], // Enrichment will populate
    submittedBy: 'web-form',
  });

  // Redirect to new listing page (throws by design — do NOT catch)
  redirect(`/tools/${listing.slug}`);
}
