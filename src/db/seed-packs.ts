/**
 * src/db/seed-packs.ts
 *
 * Seed script for starter packs.
 *
 * Populates the starter_packs and pack_tools tables with 3 curated packs
 * that link to existing catalog tools. Each pack bundles 5-10 related tools
 * with narrative copy explaining why each tool is included.
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/db/seed-packs.ts
 */

import { db } from './client';
import { starterPacks, packTools, listings } from './schema';
import { eq } from 'drizzle-orm';

/**
 * Pack seed data structure.
 *
 * Each pack contains metadata (name, slug, tagline, description) and
 * a tools array with ordered entries linking to catalog tools by slug.
 */
interface PackSeedData {
  name: string;
  slug: string;
  tagline: string;
  description: string;
  coverImage?: string;
  tools: Array<{
    toolSlug: string;
    order: number;
    narrative: string;
  }>;
}

/**
 * Seed data for 3 starter packs.
 *
 * Tool slugs reference actual entries in the listings table (populated
 * by scrapers in Phase 2). If a slug doesn't exist, the tool is skipped
 * with a warning.
 */
const PACKS: PackSeedData[] = [
  {
    name: 'DeFi Dev Starter',
    slug: 'defi-dev-starter',
    tagline: 'Everything you need to build DeFi apps',
    description:
      'A curated collection of essential tools for DeFi development. From smart contract frameworks to Web3 libraries, this pack covers the full stack for building decentralized finance applications on Ethereum and EVM chains.',
    tools: [
      {
        toolSlug: 'ethers-io-ethers-js',
        order: 1,
        narrative: 'Battle-tested Ethereum library for every DeFi frontend.',
      },
      {
        toolSlug: 'wevm-viem',
        order: 2,
        narrative: 'Modern TypeScript alternative to ethers.js with better performance and DX.',
      },
      {
        toolSlug: 'wevm-wagmi',
        order: 3,
        narrative: 'React hooks for Ethereum - makes wallet connection and contract calls trivial.',
      },
      {
        toolSlug: 'web3-web3-js',
        order: 4,
        narrative: 'Original Web3 library - still widely used and has the largest ecosystem.',
      },
      {
        toolSlug: 'amazingang-wtf-solidity',
        order: 5,
        narrative: 'Learn Solidity fundamentals fast - covers all core DeFi patterns.',
      },
      {
        toolSlug: 'smartcontractkit-full-blockchain-solidity-course-py',
        order: 6,
        narrative: 'Comprehensive Solidity course from Chainlink - free and production-ready.',
      },
      {
        toolSlug: 'sunweb3sec-defihacklabs',
        order: 7,
        narrative: 'Security patterns and exploit analysis - essential for building secure DeFi.',
      },
      {
        toolSlug: 'ethereum-boilerplate-ethereum-boilerplate',
        order: 8,
        narrative: 'Full-stack DeFi boilerplate - ships with wallet auth, contract hooks, UI kit.',
      },
    ],
  },
  {
    name: 'AI Agent Toolbox',
    slug: 'ai-agent-toolbox',
    tagline: 'Build autonomous AI agents that can read, write, and act',
    description:
      'The essential toolkit for building AI agents with the Model Context Protocol. This pack includes MCP servers, agent frameworks, and workflow orchestration tools that let AI agents interact with real systems from GitHub to databases to Slack.',
    tools: [
      {
        toolSlug: 'github-github-mcp-server',
        order: 1,
        narrative: 'Official GitHub MCP server - let AI agents read repos, create PRs, manage issues.',
      },
      {
        toolSlug: 'microsoft-mcp-for-beginners',
        order: 2,
        narrative: 'Microsoft MCP intro course - start here if you are new to the protocol.',
      },
      {
        toolSlug: 'n8n-io-n8n',
        order: 3,
        narrative: 'Workflow automation with 400+ integrations - AI agents can trigger any API.',
      },
      {
        toolSlug: 'activepieces-activepieces',
        order: 4,
        narrative: 'Open-source automation platform - alternative to n8n with TypeScript SDK.',
      },
      {
        toolSlug: 'assafelovic-gpt-researcher',
        order: 5,
        narrative: 'Autonomous research agent - gathers sources, writes reports, cites everything.',
      },
      {
        toolSlug: 'ruvnet-claude-flow',
        order: 6,
        narrative: 'Claude-specific agent framework with memory, tools, and multi-agent coordination.',
      },
      {
        toolSlug: 'triggerdotdev-trigger-dev',
        order: 7,
        narrative: 'Background job orchestration - schedule long-running agent tasks with retries.',
      },
      {
        toolSlug: 'upstash-context7',
        order: 8,
        narrative: 'Vector memory for AI agents - fast semantic search over past conversations.',
      },
      {
        toolSlug: 'mcp-use-mcp-use',
        order: 9,
        narrative: 'MCP client SDK - build custom MCP integrations in minutes.',
      },
    ],
  },
  {
    name: 'Solana Builder Kit',
    slug: 'solana-builder-kit',
    tagline: 'Ship Solana dApps from zero to deployment',
    description:
      'A complete starter kit for Solana development. This pack combines Web3 libraries, AI agent SDKs for Solana, trading bots, and learning resources to get you from zero to mainnet deployment fast.',
    tools: [
      {
        toolSlug: 'd0sc4u-solana-evm-sui-ai-agent',
        order: 1,
        narrative: 'Multi-chain AI agent template - supports Solana, EVM, and Sui from one codebase.',
      },
      {
        toolSlug: 'roswelly-solana-ai-agent-mvp',
        order: 2,
        narrative: 'Solana AI agent MVP boilerplate - wallet management, RPC queries, token swaps.',
      },
      {
        toolSlug: 'truemagic-coder-solana-agent-app',
        order: 3,
        narrative: 'Agent app framework for Solana - handles wallet auth and transaction signing.',
      },
      {
        toolSlug: 'dmitrysolana-molt-pi-maker',
        order: 4,
        narrative: 'Molt Pi trading bot - automated market making and arbitrage on Solana DEXs.',
      },
      {
        toolSlug: 'jackhuang166-pumpfun-ai-trading-bot',
        order: 5,
        narrative: 'AI-powered trading bot for pump.fun - monitors launches and executes trades.',
      },
      {
        toolSlug: 'covalenthq-ai-agent-sdk',
        order: 6,
        narrative: 'Covalent AI SDK - on-chain data queries across 200+ chains including Solana.',
      },
    ],
  },
];

/**
 * Main seed function.
 *
 * For each pack:
 * 1. Insert pack record with generated UUID
 * 2. For each tool, look up listing by slug
 * 3. If found, insert pack_tools row linking pack and tool
 * 4. If not found, log warning and skip
 */
async function seedPacks() {
  console.log('Seeding starter packs...');

  let totalToolLinks = 0;

  for (const packData of PACKS) {
    const packId = crypto.randomUUID();
    const now = new Date();

    // Insert pack record
    await db.insert(starterPacks).values({
      id: packId,
      slug: packData.slug,
      name: packData.name,
      tagline: packData.tagline,
      description: packData.description,
      coverImage: packData.coverImage ?? null,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`✓ Created pack: ${packData.name}`);

    // Insert pack-tool links
    let linkedCount = 0;
    for (const toolData of packData.tools) {
      const listing = await db.query.listings.findFirst({
        where: eq(listings.slug, toolData.toolSlug),
      });

      if (listing) {
        await db.insert(packTools).values({
          packId,
          toolId: listing.id,
          order: toolData.order,
          narrative: toolData.narrative,
        });
        linkedCount++;
        totalToolLinks++;
      } else {
        console.warn(`  ⚠ Tool not found: ${toolData.toolSlug} - skipping`);
      }
    }

    console.log(`  Linked ${linkedCount}/${packData.tools.length} tools`);
  }

  console.log(`\n✓ Seeded ${PACKS.length} packs with ${totalToolLinks} tool links`);
}

// Run seed function
seedPacks().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
