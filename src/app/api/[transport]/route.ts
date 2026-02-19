import { createMcpHandler } from 'mcp-handler';
import { z } from 'zod';
import { searchCatalog } from '@/services/search';
import { getListingBySlug, getListingById, upsertBySourceUrl } from '@/services/catalog';
import { createSlug } from '@/lib/catalog-schema';

// Define schemas outside handler to avoid type recursion issues
const searchCatalogSchema = z.object({
  query: z.string().min(1),
  category: z.string().optional(),
  mcpCompatible: z.boolean().optional(),
  cursor: z.string().optional(),
}) as any;

const getListingSchema = z.object({
  identifier: z.string().min(1),
}) as any;

const submitListingSchema = z.object({
  sourceUrl: z.string().url(),
  name: z.string().optional(),
  category: z.string().optional(),
}) as any;

const handler = createMcpHandler(
  async (server) => {
    // Tool 1: search_catalog
    server.registerTool(
      'search_catalog',
      {
        title: 'Search Catalog',
        description: 'Search the AI Bazaar catalog for tools, agents, and protocols. Supports keyword search with optional category and MCP-compatibility filters. Returns paginated results.',
        inputSchema: searchCatalogSchema,
      },
      async ({ query, category, mcpCompatible, cursor }: any) => {
        try {
          const decoded = cursor ? JSON.parse(atob(cursor)) : { offset: 0 };
          const limit = 20;

          const results = await searchCatalog({
            query,
            category,
            mcpCompatible,
            limit,
            offset: decoded.offset,
          });

          const nextCursor = results.length === limit
            ? btoa(JSON.stringify({ offset: decoded.offset + limit }))
            : undefined;

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                results,
                pagination: {
                  nextCursor,
                  hasMore: results.length === limit,
                  count: results.length,
                },
              }, null, 2),
            }],
          };
        } catch (error) {
          console.error('search_catalog error:', error);
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: 'Failed to search catalog. Please check your query syntax.',
            }],
          };
        }
      }
    );

    // Tool 2: get_listing
    server.registerTool(
      'get_listing',
      {
        title: 'Get Listing',
        description: 'Get full details for a specific catalog listing by its slug or UUID. Returns all metadata including description, tags, links, and metrics.',
        inputSchema: getListingSchema,
      },
      async ({ identifier }: any) => {
        try {
          // Try slug first (more common), fall back to UUID
          let listing = await getListingBySlug(identifier);
          if (!listing) {
            // Check if it looks like a UUID
            const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            if (uuidRegex.test(identifier)) {
              listing = await getListingById(identifier);
            }
          }

          if (!listing) {
            return {
              isError: true,
              content: [{
                type: 'text' as const,
                text: `Listing not found: ${identifier}`,
              }],
            };
          }

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify(listing, null, 2),
            }],
          };
        } catch (error) {
          console.error('get_listing error:', error);
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: 'Failed to fetch listing details.',
            }],
          };
        }
      }
    );

    // Tool 3: submit_listing
    server.registerTool(
      'submit_listing',
      {
        title: 'Submit Listing',
        description: 'Submit a new tool or project to the AI Bazaar catalog. Provide a source URL (GitHub, npm, etc.) with optional name and category. Duplicate URLs are handled via upsert.',
        inputSchema: submitListingSchema,
      },
      async ({ sourceUrl, name, category }: any) => {
        try {
          const slug = name ? createSlug(name) : createSlug(new URL(sourceUrl).pathname.split('/').filter(Boolean).slice(-1)[0] || 'pending');

          const entry = await upsertBySourceUrl({
            slug,
            name: name ?? slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
            tagline: 'Submitted via MCP — enrichment pending',
            description: 'This listing was submitted programmatically via the MCP protocol. Full details will be enriched by the scraping pipeline.',
            category: category ?? 'framework',
            tags: [],
            sourceUrl,
          });

          return {
            content: [{
              type: 'text' as const,
              text: JSON.stringify({
                status: 'created',
                slug: entry.slug,
                id: entry.id,
                message: `Listing "${entry.name}" created/updated successfully.`,
              }, null, 2),
            }],
          };
        } catch (error) {
          console.error('submit_listing error:', error);
          return {
            isError: true,
            content: [{
              type: 'text' as const,
              text: 'Failed to submit listing. Please verify the URL is valid.',
            }],
          };
        }
      }
    );

    // Resource: catalog-schema
    server.registerResource(
      'catalog-schema',
      'schema://ai-bazaar/catalog-entry',
      {
        title: 'Catalog Entry Schema',
        description: 'Machine-readable Zod schema for AI Bazaar catalog entries. Use this to understand the data structure for submissions and search results.',
      },
      async (uri) => ({
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({
            description: 'AI Bazaar Catalog Entry Schema',
            fields: {
              slug: 'URL-safe identifier (lowercase alphanumeric + hyphens)',
              name: 'Display name (1-100 chars)',
              tagline: 'Short description (1-160 chars)',
              description: 'Full description with markdown (1-2000 chars)',
              category: 'One of: mcp-server, ai-agent, web3-tool, defi-tool, infrastructure, other',
              tags: 'Array of normalized tag strings',
              sourceUrl: 'Primary URL (GitHub, npm, etc.)',
              docsUrl: 'Optional documentation URL',
              licenseType: 'SPDX identifier (MIT, Apache-2.0, etc.)',
              runtime: 'One of: node, python, rust, go, other',
              chainSupport: 'Array of blockchain names (ethereum, solana, etc.)',
              mcpCompatible: 'Boolean — implements Model Context Protocol',
              acpCompatible: 'Boolean — implements Agent Communication Protocol',
              stars: 'GitHub stars or equivalent metric',
              downloads: 'Registry download count',
            },
            example: {
              slug: 'example-mcp-tool',
              name: 'Example MCP Tool',
              tagline: 'A reference implementation for MCP servers',
              description: 'Full description here...',
              category: 'mcp-server',
              tags: ['mcp-server', 'reference'],
              sourceUrl: 'https://github.com/org/repo',
              mcpCompatible: true,
            },
          }, null, 2),
        }],
      })
    );
  },
  {
    serverInfo: {
      name: 'ai-bazaar-mcp',
      version: '0.1.0',
    },
    capabilities: {
      tools: {},
      resources: {},
    },
  },
  {
    basePath: '/api',
    maxDuration: 60,
    verboseLogs: process.env.NODE_ENV === 'development',
  }
);

export { handler as GET, handler as POST, handler as DELETE };
