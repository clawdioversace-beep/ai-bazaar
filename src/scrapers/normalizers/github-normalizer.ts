/**
 * GitHub repository normalizer.
 *
 * Transforms raw GitHub API search result objects into CatalogEntryInput
 * format for insertion into the AI Bazaar catalog.
 *
 * @module github-normalizer
 */

import { z } from 'zod';
import { type CatalogEntryInput, createSlug } from '../../lib/catalog-schema';
import type { Category } from '../../lib/categories';

/**
 * Zod schema for GitHub API repo search result.
 * Validates the subset of fields we need from GitHub's search API response.
 */
export const GitHubRepoSchema = z.object({
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.string().url(),
  homepage: z.string().nullable(),
  stargazers_count: z.number().int().min(0),
  topics: z.array(z.string()),
  license: z.object({ spdx_id: z.string() }).nullable(),
  language: z.string().nullable(),
});

export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

/**
 * Determine category from GitHub repository topics.
 *
 * Priority order:
 * 1. MCP-related → 'mcp-server'
 * 2. Web3/blockchain → 'web3-tool'
 * 3. DeFi-specific → 'defi-tool'
 * 4. Default → 'ai-agent'
 */
function categorizeFromTopics(topics: string[]): Category {
  const topicsLower = topics.map(t => t.toLowerCase());

  if (topicsLower.some(t => t.includes('mcp'))) {
    return 'mcp-server';
  }

  if (topicsLower.some(t => ['web3', 'blockchain', 'ethereum', 'solana', 'defi'].includes(t))) {
    return 'web3-tool';
  }

  if (topicsLower.some(t => ['defi', 'yield', 'swap', 'amm'].includes(t))) {
    return 'defi-tool';
  }

  return 'ai-agent';
}

/**
 * Map GitHub language to runtime category.
 */
function languageToRuntime(language: string | null): CatalogEntryInput['runtime'] {
  if (!language) return undefined;

  const lang = language.toLowerCase();

  if (lang === 'typescript' || lang === 'javascript') return 'node';
  if (lang === 'python') return 'python';
  if (lang === 'rust') return 'rust';
  if (lang === 'go') return 'go';
  if (lang === 'other') return 'other';

  return 'other';
}

/**
 * Normalize a GitHub repository object to CatalogEntryInput.
 *
 * @param repo - Raw GitHub API repo object (unknown type for safety)
 * @returns CatalogEntryInput ready for CatalogEntrySchema.parse()
 * @throws ZodError if repo doesn't match GitHubRepoSchema
 */
export function normalizeGitHubRepo(repo: unknown): CatalogEntryInput {
  const validated = GitHubRepoSchema.parse(repo);

  const slug = createSlug(validated.full_name);
  const category = categorizeFromTopics(validated.topics);
  const mcpCompatible = validated.topics.some(t => t.toLowerCase().includes('mcp'));

  // Parse homepage as URL if present and valid
  let docsUrl: string | undefined;
  if (validated.homepage && validated.homepage.trim() !== '') {
    try {
      new URL(validated.homepage);
      docsUrl = validated.homepage;
    } catch {
      // Invalid URL — skip
      docsUrl = undefined;
    }
  }

  return {
    slug,
    name: validated.full_name,
    tagline: validated.description?.slice(0, 160) || `GitHub repository: ${validated.full_name}`,
    description: validated.description || `No description provided for ${validated.full_name}`,
    category,
    tags: validated.topics,
    sourceUrl: validated.html_url,
    docsUrl,
    licenseType: validated.license?.spdx_id,
    runtime: languageToRuntime(validated.language),
    stars: validated.stargazers_count,
    mcpCompatible,
    submittedBy: 'github-scraper',
  };
}
