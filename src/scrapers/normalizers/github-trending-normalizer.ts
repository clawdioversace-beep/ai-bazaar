/**
 * GitHub Trending repository normalizer.
 *
 * Transforms raw GitHub Trending page data into CatalogEntryInput
 * for insertion into the AI Bazaar catalog.
 *
 * Unlike the github-normalizer (which uses Octokit and gets topic data),
 * this normalizer categorizes based on description keywords and language
 * since the trending page does not expose topics.
 *
 * @module github-trending-normalizer
 */

import { type CatalogEntryInput, createSlug } from '../../lib/catalog-schema';
import type { Category } from '../../lib/categories';

/**
 * Raw data extracted from a GitHub Trending page row.
 */
export interface TrendingRepo {
  repoFullName: string;
  description: string;
  language: string | null;
  stars: number;
  starsToday: number;
  url: string;
}

/**
 * Determine category from description keywords and programming language.
 *
 * Priority order:
 * 1. MCP/model context protocol -> mcp-server
 * 2. AI/agent/LLM -> ai-agent
 * 3. DeFi -> defi-tool (before web3 to prevent false positives)
 * 4. Web3/blockchain -> web3-tool
 * 5. Infrastructure (Docker, k8s) -> infra
 * 6. Default -> framework
 */
function categorizeRepo(description: string, language: string | null): Category {
  const desc = description.toLowerCase();
  const lang = (language || '').toLowerCase();

  // MCP/Model Context Protocol — highest priority
  if (desc.includes('mcp') || desc.includes('model context protocol')) {
    return 'mcp-server';
  }

  // AI/ML/Agent tools
  if (
    desc.includes('agent') ||
    desc.includes('llm') ||
    desc.includes('gpt') ||
    desc.includes('claude') ||
    desc.includes('openai') ||
    desc.includes('langchain') ||
    desc.includes('artificial intelligence') ||
    desc.includes(' ai ') ||
    desc.startsWith('ai ')
  ) {
    return 'ai-agent';
  }

  // DeFi MUST come before web3 to avoid false positives
  if (
    desc.includes('defi') ||
    desc.includes('swap') ||
    desc.includes('yield') ||
    desc.includes('liquidity') ||
    desc.includes('amm') ||
    desc.includes('dex ')
  ) {
    return 'defi-tool';
  }

  // Web3/blockchain
  if (
    desc.includes('web3') ||
    desc.includes('blockchain') ||
    desc.includes('ethereum') ||
    desc.includes('solana') ||
    desc.includes('smart contract') ||
    desc.includes('nft') ||
    desc.includes('crypto')
  ) {
    return 'web3-tool';
  }

  // Infrastructure
  if (
    lang === 'dockerfile' ||
    desc.includes('kubernetes') ||
    desc.includes(' k8s') ||
    desc.includes('docker') ||
    desc.includes('infrastructure') ||
    desc.includes('monitoring') ||
    desc.includes('observability')
  ) {
    return 'infra';
  }

  return 'framework';
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

  return 'other';
}

/**
 * Normalize a GitHub Trending repository to CatalogEntryInput.
 *
 * @param repo - Raw trending repo data
 * @returns CatalogEntryInput ready for upsertBySourceUrl
 */
export function normalizeTrendingRepo(repo: TrendingRepo): CatalogEntryInput {
  const slug = createSlug(repo.repoFullName);
  const category = categorizeRepo(repo.description, repo.language);

  return {
    slug,
    name: repo.repoFullName,
    tagline: (repo.description || `GitHub trending: ${repo.repoFullName}`).slice(0, 160),
    description: repo.description || `No description provided for ${repo.repoFullName}`,
    category,
    tags: [],
    sourceUrl: repo.url,
    runtime: languageToRuntime(repo.language),
    stars: repo.stars,
    submittedBy: 'github-trending-scraper',
  };
}
