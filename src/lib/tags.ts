/**
 * Tag taxonomy for the AI Bazaar catalog.
 *
 * TAG_ALIASES maps variant/informal tag strings to their canonical forms.
 * normalizeTag() applies this mapping at parse time so all data entering
 * the catalog uses consistent canonical tags.
 */

/**
 * Maps variant tag strings to their canonical forms.
 * Keys are the variants (including case-sensitive forms like 'MCP').
 * Values are the canonical slugs used in the catalog.
 */
export const TAG_ALIASES: Record<string, string> = {
  // MCP variants
  'mcp': 'mcp-server',
  'MCP': 'mcp-server',
  'mcpserver': 'mcp-server',
  'mcp_server': 'mcp-server',
  'model-context-protocol': 'mcp-server',

  // ACP variants
  'acp': 'acp-agent',
  'ACP': 'acp-agent',

  // A2A variants
  'a2a': 'a2a-agent',
  'A2A': 'a2a-agent',

  // Web3 variants
  'web3': 'web3-tool',
  'blockchain': 'web3-tool',
  'onchain': 'web3-tool',
  'on-chain': 'web3-tool',

  // DeFi variants
  'defi': 'defi-tool',

  // Solana variants
  'sol': 'solana',
  'solana-network': 'solana',

  // AI/ML variants
  'ai': 'ai-tool',
  'artificial-intelligence': 'ai-tool',
  'machine-learning': 'ai-tool',
  'ml': 'ai-tool',

  // LLM variants
  'llm': 'llm-tool',
  'large-language-model': 'llm-tool',
};

/**
 * Normalizes a tag string to its canonical form.
 *
 * Steps:
 * 1. Preserve original input for case-sensitive alias lookup
 * 2. Lowercase and trim
 * 3. Replace whitespace sequences with hyphens
 * 4. Look up cleaned string in TAG_ALIASES
 * 5. Fall back to original input lookup (handles 'MCP', 'ACP', 'A2A' etc.)
 * 6. Return canonical form, or cleaned string if no alias found
 */
export function normalizeTag(tag: string): string {
  const original = tag;
  const cleaned = tag.toLowerCase().trim().replace(/\s+/g, '-');

  // Check cleaned form first (handles most aliases)
  if (cleaned in TAG_ALIASES) {
    return TAG_ALIASES[cleaned]!;
  }

  // Check original form (handles case-sensitive aliases like 'MCP', 'ACP')
  if (original in TAG_ALIASES) {
    return TAG_ALIASES[original]!;
  }

  return cleaned;
}
