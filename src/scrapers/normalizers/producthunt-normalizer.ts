/**
 * Product Hunt post normalizer.
 *
 * Transforms raw Product Hunt post data into CatalogEntryInput
 * for insertion into the AI Bazaar catalog.
 *
 * @module producthunt-normalizer
 */

import { type CatalogEntryInput, createSlug } from '../../lib/catalog-schema';
import type { Category } from '../../lib/categories';

/**
 * Raw Product Hunt post data extracted from HTML/JSON.
 */
export interface ProductHuntPost {
  name: string;
  tagline: string;
  url: string;
  votesCount: number;
  topics: string[];
}

/**
 * Determine category from Product Hunt post topics.
 *
 * Priority order mirrors github-normalizer logic:
 * 1. MCP/Model Context Protocol -> mcp-server
 * 2. AI/ML topics -> ai-agent
 * 3. Web3/Blockchain -> web3-tool
 * 4. DeFi -> defi-tool
 * 5. Default -> saas-tool
 */
function categorizeFromTopics(topics: string[]): Category {
  const topicsLower = topics.map(t => t.toLowerCase());

  // MCP takes highest priority
  if (topicsLower.some(t => t.includes('mcp') || t.includes('model-context'))) {
    return 'mcp-server';
  }

  // DeFi MUST be checked before web3-tool
  if (topicsLower.some(t => ['defi', 'yield', 'swap', 'amm', 'dex', 'lending'].includes(t))) {
    return 'defi-tool';
  }

  // Web3/blockchain
  if (topicsLower.some(t => ['web3', 'blockchain', 'ethereum', 'solana', 'crypto', 'nft', 'wallet'].includes(t))) {
    return 'web3-tool';
  }

  // Developer tools
  if (topicsLower.some(t => ['developer-tools', 'developer', 'api', 'sdk', 'open-source', 'github'].includes(t))) {
    return 'developer-tool';
  }

  // AI/ML topics
  if (topicsLower.some(t => [
    'artificial-intelligence', 'ai', 'machine-learning', 'ml',
    'chatbot', 'gpt', 'llm', 'generative-ai', 'natural-language-processing',
    'agent', 'automation',
  ].includes(t))) {
    return 'ai-agent';
  }

  return 'saas-tool';
}

/**
 * Normalize a Product Hunt post object to CatalogEntryInput.
 *
 * @param post - Raw Product Hunt post data
 * @returns CatalogEntryInput ready for upsertBySourceUrl
 */
export function normalizeProductHuntPost(post: ProductHuntPost): CatalogEntryInput {
  const slug = createSlug(post.name);
  const category = categorizeFromTopics(post.topics);

  return {
    slug,
    name: post.name,
    tagline: (post.tagline || `Product Hunt: ${post.name}`).slice(0, 160),
    description: post.tagline || `Discovered on Product Hunt: ${post.name}`,
    category,
    tags: post.topics.length > 0 ? post.topics : ['product-hunt'],
    sourceUrl: post.url,
    // Product Hunt votes stored in stars field for social proof
    stars: post.votesCount || 0,
    submittedBy: 'producthunt-scraper',
  };
}
