/**
 * HuggingFace model/space normalizer.
 *
 * Transforms raw HuggingFace API objects (models or spaces) into
 * CatalogEntryInput format for insertion into the AI Bazaar catalog.
 *
 * @module huggingface-normalizer
 */

import { z } from 'zod';
import { type CatalogEntryInput, createSlug } from '../../lib/catalog-schema';
import type { Category } from '../../lib/categories';

/**
 * Zod schema for HuggingFace model/space.
 * HF API returns various shapes — this schema is intentionally loose to handle
 * both models and spaces while allowing missing fields.
 */
export const HuggingFaceEntrySchema = z.object({
  id: z.string(), // e.g. "username/model-name"
  tags: z.array(z.string()).optional(),
  downloads: z.number().int().min(0).optional(),
  likes: z.number().int().min(0).optional(),
  private: z.boolean().optional(),
});

export type HuggingFaceEntry = z.infer<typeof HuggingFaceEntrySchema>;

/**
 * Determine category from HuggingFace tags.
 *
 * Priority order:
 * 1. MCP-related → 'mcp-server'
 * 2. DeFi-specific → 'defi-tool'
 * 3. Infrastructure → 'infra'
 * 4. Web3/blockchain → 'web3-tool'
 * 5. Agent-related → 'ai-agent'
 * 6. Default → 'framework' (HF models/spaces are often ML frameworks/tools)
 */
function categorizeFromTags(tags: string[] | undefined): Category {
  if (!tags || tags.length === 0) {
    return 'framework';
  }

  const tagsLower = tags.map(t => t.toLowerCase());

  if (tagsLower.some(t => t.includes('mcp'))) {
    return 'mcp-server';
  }

  // DeFi MUST be checked before web3-tool
  if (tagsLower.some(t => ['defi', 'yield', 'swap', 'amm', 'dex', 'lending', 'staking'].includes(t))) {
    return 'defi-tool';
  }

  // Infrastructure tools
  if (tagsLower.some(t => ['infrastructure', 'infra', 'docker', 'kubernetes', 'k8s', 'monitoring', 'database', 'devops'].includes(t))) {
    return 'infra';
  }

  // General web3/blockchain
  if (tagsLower.some(t => ['web3', 'blockchain', 'ethereum', 'solana', 'crypto', 'wallet', 'nft'].includes(t))) {
    return 'web3-tool';
  }

  if (tagsLower.some(t => t === 'agent' || t.includes('agent'))) {
    return 'ai-agent';
  }

  return 'framework';
}

/**
 * Normalize a HuggingFace entry (model or space) to CatalogEntryInput.
 *
 * @param entry - Raw HuggingFace object (unknown type for safety)
 * @returns CatalogEntryInput ready for CatalogEntrySchema.parse()
 * @throws ZodError if entry doesn't match HuggingFaceEntrySchema
 */
export function normalizeHuggingFaceEntry(entry: unknown): CatalogEntryInput {
  const validated = HuggingFaceEntrySchema.parse(entry);

  const slug = createSlug(validated.id);
  const category = categorizeFromTags(validated.tags);

  // Generate tagline from first tag or use generic fallback
  const tagline = validated.tags?.[0]
    ? `HuggingFace model: ${validated.id} (${validated.tags[0]})`
    : `HuggingFace model: ${validated.id}`;

  // Description includes tag summary if available
  const description = validated.tags && validated.tags.length > 0
    ? `HuggingFace model ${validated.id} with tags: ${validated.tags.join(', ')}`
    : `HuggingFace model ${validated.id}`;

  return {
    slug,
    name: validated.id,
    tagline: tagline.slice(0, 160),
    description,
    category,
    tags: validated.tags ?? [],
    sourceUrl: `https://huggingface.co/${validated.id}`,
    stars: validated.likes ?? 0,
    downloads: validated.downloads ?? 0,
    submittedBy: 'huggingface-scraper',
  };
}
