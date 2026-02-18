/**
 * Canonical category taxonomy for the AI Bazaar catalog.
 *
 * CATEGORIES is the single source of truth for valid category values.
 * Any service, scraper, or form that assigns a category MUST use one
 * of these six values. Category validation is enforced at parse time
 * via the Zod CatalogEntry schema (see catalog-schema.ts).
 */

/**
 * The six canonical categories for catalog entries.
 * Used by CatalogEntrySchema as z.enum(CATEGORIES).
 */
export const CATEGORIES = [
  'mcp-server',
  'ai-agent',
  'web3-tool',
  'defi-tool',
  'infra',
  'framework',
] as const;

/**
 * TypeScript type derived from the CATEGORIES array.
 * Ensures all category references are type-safe at compile time.
 */
export type Category = typeof CATEGORIES[number];

/**
 * Human-readable labels for each canonical category.
 * Used for display in UI components and Telegram bot responses.
 */
export const CATEGORY_LABELS: Record<Category, string> = {
  'mcp-server': 'MCP Server',
  'ai-agent': 'AI Agent',
  'web3-tool': 'Web3 Tool',
  'defi-tool': 'DeFi Tool',
  'infra': 'Infrastructure',
  'framework': 'Framework',
};
