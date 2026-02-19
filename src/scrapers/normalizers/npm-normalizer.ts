/**
 * npm package normalizer.
 *
 * Transforms raw npm registry search result objects into CatalogEntryInput
 * format for insertion into the AI Bazaar catalog.
 *
 * @module npm-normalizer
 */

import { z } from 'zod';
import { type CatalogEntryInput, createSlug } from '../../lib/catalog-schema';
import type { Category } from '../../lib/categories';

/**
 * Zod schema for npm package search result.
 * Matches the shape of objects in the npm search API response (.objects[].package).
 */
export const NpmPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  links: z.object({
    npm: z.string(),
    homepage: z.string().optional(),
    repository: z.string().optional(),
  }),
  publisher: z.object({
    username: z.string(),
  }),
});

export type NpmPackage = z.infer<typeof NpmPackageSchema>;

/**
 * Determine category from npm package keywords.
 *
 * Priority order:
 * 1. MCP-related → 'mcp-server'
 * 2. Web3/blockchain → 'web3-tool'
 * 3. DeFi-specific → 'defi-tool'
 * 4. Default → 'ai-agent'
 */
function categorizeFromKeywords(keywords: string[] | undefined): Category {
  if (!keywords || keywords.length === 0) {
    return 'ai-agent';
  }

  const keywordsLower = keywords.map(k => k.toLowerCase());

  if (keywordsLower.some(k => k.includes('mcp'))) {
    return 'mcp-server';
  }

  if (keywordsLower.some(k => ['web3', 'blockchain', 'ethereum', 'solana'].includes(k))) {
    return 'web3-tool';
  }

  if (keywordsLower.some(k => ['defi', 'yield', 'swap', 'amm'].includes(k))) {
    return 'defi-tool';
  }

  return 'ai-agent';
}

/**
 * Normalize an npm package object to CatalogEntryInput.
 *
 * Prefers repository URL over npm page URL for sourceUrl (GitHub links are
 * more stable and useful than npmjs.com package pages).
 *
 * @param pkg - Raw npm package object (unknown type for safety)
 * @returns CatalogEntryInput ready for CatalogEntrySchema.parse()
 * @throws ZodError if pkg doesn't match NpmPackageSchema
 */
export function normalizeNpmPackage(pkg: unknown): CatalogEntryInput {
  const validated = NpmPackageSchema.parse(pkg);

  const slug = createSlug(validated.name);
  const category = categorizeFromKeywords(validated.keywords);

  // Prefer repository URL over npm page URL
  const sourceUrl = validated.links.repository || validated.links.npm;

  return {
    slug,
    name: validated.name,
    tagline: validated.description?.slice(0, 160) || `npm package: ${validated.name}`,
    description: validated.description || `npm package ${validated.name}`,
    category,
    tags: validated.keywords ?? [],
    sourceUrl,
    docsUrl: validated.links.homepage,
    runtime: 'node', // npm packages are always Node.js ecosystem
    submittedBy: 'npm-scraper',
  };
}
