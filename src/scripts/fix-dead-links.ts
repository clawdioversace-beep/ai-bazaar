/**
 * One-time script to fix dead links in the reads table.
 *
 * Usage: TURSO_DATABASE_URL=file:./dev.db bun src/scripts/fix-dead-links.ts
 */
import { db } from '@/db/client';
import { reads } from '@/db/schema';
import { eq } from 'drizzle-orm';

const FIXES = [
  {
    slug: 'building-effective-agents',
    url: 'https://www.anthropic.com/research/building-effective-agents',
  },
  {
    slug: 'model-context-protocol-introduction',
    url: 'https://modelcontextprotocol.io/docs/introduction',
  },
  {
    slug: 'how-to-build-an-mcp-server-in-typescript',
    url: 'https://modelcontextprotocol.io/docs/quickstart/server',
  },
  {
    slug: 'langgraph-build-stateful-ai-agents',
    url: 'https://langchain-ai.github.io/langgraph/tutorials/',
  },
  {
    slug: 'rag-is-dead-long-live-rag',
    url: 'https://contextual.ai/blog/is-rag-dead-yet',
  },
  {
    slug: 'how-to-build-a-tool-using-ai-agent-from-scratch',
    url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use',
  },
  {
    slug: 'understanding-ai-agent-memory-systems',
    url: 'https://www.pinecone.io/learn/series/langchain/langchain-conversational-memory/',
  },
  {
    slug: 'multi-agent-systems-patterns-and-pitfalls',
    url: 'https://blog.crewai.com/agentic-systems-with-crewai/',
  },
  {
    slug: 'prompt-engineering-for-tool-use',
    url: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview',
  },
];

async function main() {
  console.log(`Fixing ${FIXES.length} dead links...`);

  for (const fix of FIXES) {
    const result = await db
      .update(reads)
      .set({ sourceUrl: fix.url })
      .where(eq(reads.slug, fix.slug));

    console.log(`  ✓ ${fix.slug} → ${fix.url}`);
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
