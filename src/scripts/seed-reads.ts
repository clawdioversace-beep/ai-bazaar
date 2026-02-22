/**
 * Seed script for curated AI reads.
 *
 * Usage: TURSO_DATABASE_URL=file:./dev.db bun src/scripts/seed-reads.ts
 */
import { createRead } from '@/services/reads';
import { createSlug } from '@/lib/catalog-schema';

const READS = [
  {
    title: 'Building Effective Agents',
    summary: 'Anthropic\'s guide to building effective AI agents — covers workflows, orchestration patterns, and when to use agents vs simpler solutions.',
    sourceUrl: 'https://www.anthropic.com/research/building-effective-agents',
    sourceName: 'Blog',
    author: 'Anthropic',
    tags: ['agents', 'claude', 'architecture'],
    category: 'guide',
    featured: true,
  },
  {
    title: 'Model Context Protocol: Introduction',
    summary: 'The official introduction to MCP — a standard protocol for connecting AI assistants to external data sources and tools.',
    sourceUrl: 'https://modelcontextprotocol.io/docs/introduction',
    sourceName: 'Blog',
    author: 'Anthropic',
    tags: ['mcp', 'protocol', 'tools'],
    category: 'guide',
    featured: true,
  },
  {
    title: 'How to Build an MCP Server in TypeScript',
    summary: 'Step-by-step tutorial for building a Model Context Protocol server from scratch using the official TypeScript SDK.',
    sourceUrl: 'https://modelcontextprotocol.io/docs/quickstart/server',
    sourceName: 'Blog',
    author: 'MCP Team',
    tags: ['mcp', 'typescript', 'tutorial'],
    category: 'tutorial',
    featured: true,
  },
  {
    title: 'The AI Agent Stack is Converging',
    summary: 'Analysis of how the agent framework landscape is consolidating around common patterns: tool use, memory, planning, and multi-agent orchestration.',
    sourceUrl: 'https://www.latent.space/p/2025-agent-stack',
    sourceName: 'Blog',
    author: 'Latent Space',
    tags: ['agents', 'frameworks', 'analysis'],
    category: 'article',
  },
  {
    title: 'LangGraph: Build Stateful AI Agents',
    summary: 'Tutorial on building production-ready AI agents with LangGraph — covers state machines, tool integration, and human-in-the-loop patterns.',
    sourceUrl: 'https://langchain-ai.github.io/langgraph/tutorials/',
    sourceName: 'Blog',
    author: 'LangChain',
    tags: ['langgraph', 'agents', 'python'],
    category: 'tutorial',
  },
  {
    title: 'RAG is Dead, Long Live RAG',
    summary: 'Deep dive into why naive RAG fails and what advanced retrieval patterns (hybrid search, reranking, query decomposition) actually work in production.',
    sourceUrl: 'https://contextual.ai/blog/is-rag-dead-yet',
    sourceName: 'Blog',
    author: 'Philipp Schmid',
    tags: ['rag', 'retrieval', 'production'],
    category: 'article',
  },
  {
    title: 'Claude Code: Best Practices for Agentic Coding',
    summary: 'Practical tips for getting the most out of Claude Code — project setup, CLAUDE.md conventions, and effective prompting patterns.',
    sourceUrl: 'https://www.anthropic.com/engineering/claude-code-best-practices',
    sourceName: 'Blog',
    author: 'Anthropic',
    tags: ['claude-code', 'productivity', 'coding'],
    category: 'guide',
  },
  {
    title: 'How to Build a Tool-Using AI Agent from Scratch',
    summary: 'From-scratch implementation of an AI agent that can use tools, with code examples covering the ReAct loop, tool execution, and error recovery.',
    sourceUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/implement-tool-use',
    sourceName: 'Blog',
    author: 'Anthropic',
    tags: ['agents', 'tool-use', 'tutorial'],
    category: 'tutorial',
  },
  {
    title: 'Understanding AI Agent Memory Systems',
    summary: 'Comprehensive overview of memory architectures for AI agents — short-term context, long-term vector storage, episodic memory, and hybrid approaches.',
    sourceUrl: 'https://www.pinecone.io/learn/series/langchain/langchain-conversational-memory/',
    sourceName: 'Blog',
    author: 'Pinecone',
    tags: ['agents', 'memory', 'vector-db'],
    category: 'article',
  },
  {
    title: 'Multi-Agent Systems: Patterns and Pitfalls',
    summary: 'Lessons learned from building multi-agent systems in production. Covers coordination patterns, failure modes, and when single agents are enough.',
    sourceUrl: 'https://blog.crewai.com/agentic-systems-with-crewai/',
    sourceName: 'Blog',
    author: 'CrewAI',
    tags: ['multi-agent', 'architecture', 'production'],
    category: 'article',
  },
  {
    title: 'Prompt Engineering for Tool Use',
    summary: 'How to write effective tool descriptions and system prompts that help LLMs reliably select and use the right tools with correct parameters.',
    sourceUrl: 'https://docs.anthropic.com/en/docs/agents-and-tools/tool-use/overview',
    sourceName: 'Blog',
    author: 'Anthropic',
    tags: ['prompt-engineering', 'tool-use', 'claude'],
    category: 'guide',
  },
  {
    title: 'Building AI Pipelines with Vercel AI SDK',
    summary: 'Practical guide to building streaming AI applications with the Vercel AI SDK — covers structured outputs, tool calling, and multi-step agents.',
    sourceUrl: 'https://sdk.vercel.ai/docs/getting-started',
    sourceName: 'Blog',
    author: 'Vercel',
    tags: ['vercel', 'ai-sdk', 'streaming'],
    category: 'tutorial',
  },
];

async function main() {
  console.log(`Seeding ${READS.length} curated reads...`);

  for (const read of READS) {
    const slug = createSlug(read.title);
    const id = crypto.randomUUID();
    const now = new Date();

    try {
      await createRead({
        id,
        slug,
        title: read.title,
        summary: read.summary,
        sourceUrl: read.sourceUrl,
        sourceName: read.sourceName,
        author: read.author ?? null,
        tags: JSON.stringify(read.tags),
        category: read.category,
        publishedAt: now,
        createdAt: now,
        featured: read.featured ?? false,
      });
      console.log(`  + ${read.title}`);
    } catch (err: any) {
      if (err.message?.includes('UNIQUE constraint')) {
        console.log(`  ~ ${read.title} (already exists)`);
      } else {
        console.error(`  ! ${read.title}: ${err.message}`);
      }
    }
  }

  console.log('Done.');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
