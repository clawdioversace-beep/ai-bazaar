# Architecture Research

**Domain:** Dual-audience discovery/directory platform (AI agents + humans)
**Researched:** 2026-02-18
**Confidence:** HIGH (MCP/ACP from official sources; directory patterns from verified implementations)

---

## Standard Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CONSUMER LAYER                                     │
│                                                                               │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │  AI Agents       │  │  Human Web Users │  │  Telegram Users  │           │
│  │  (MCP clients)   │  │  (browser)       │  │  (mobile/desktop)│           │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘           │
│           │ JSON-RPC/HTTP       │ HTTPS               │ Bot API              │
└───────────┼────────────────────┼─────────────────────┼─────────────────────┘
            │                    │                      │
┌───────────┼────────────────────┼─────────────────────┼─────────────────────┐
│           │       API / INTERFACE LAYER                │                     │
│           ▼                    ▼                      ▼                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐           │
│  │  MCP Server      │  │  Next.js App     │  │  Telegram Bot    │           │
│  │  /api/[transport]│  │  (web frontend)  │  │  (grammY)        │           │
│  │  (Streamable HTTP│  │  Server Actions  │  │  webhook handler │           │
│  │  + SSE)          │  │  + API routes    │  │                  │           │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘           │
│           │                    │                      │                      │
└───────────┼────────────────────┼─────────────────────┼─────────────────────┘
            │                    │                      │
            └────────────────────┼──────────────────────┘
                                 │ shared service calls
┌────────────────────────────────┼────────────────────────────────────────────┐
│                        SERVICE LAYER                                         │
│                                 ▼                                            │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                        Core Services                                  │   │
│  │  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐          │   │
│  │  │  CatalogService│  │  SearchService │  │SubmissionService│         │   │
│  │  │  (CRUD + enrich│  │  (filter/rank/ │  │(validate/queue)│          │   │
│  │  │  + validate)   │  │  full-text/vec)│  │                │          │   │
│  │  └───────┬────────┘  └───────┬────────┘  └───────┬────────┘          │   │
│  └──────────┼───────────────────┼───────────────────┼───────────────────┘   │
└─────────────┼───────────────────┼───────────────────┼────────────────────────┘
              │                   │                   │
┌─────────────┼───────────────────┼───────────────────┼────────────────────────┐
│                        DATA LAYER                                             │
│             ▼                   ▼                   ▼                         │
│  ┌─────────────────┐  ┌──────────────────┐  ┌──────────────────┐             │
│  │  SQLite/libSQL  │  │  Search Index    │  │  Job Queue       │             │
│  │  (Turso local   │  │  (SQLite FTS5 +  │  │  (BullMQ + Redis)│             │
│  │  or embedded)   │  │  vector columns) │  │                  │             │
│  └─────────────────┘  └──────────────────┘  └────────┬─────────┘             │
└──────────────────────────────────────────────────────┼─────────────────────── ┘
                                                        │
┌───────────────────────────────────────────────────────┼────────────────────────┐
│                    SCRAPING PIPELINE LAYER             │                        │
│                                                        ▼                        │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                         BullMQ Workers                                    │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │ GitHubScraper│  │  npmScraper  │  │  HFScraper   │  │SubmitScraper │  │  │
│  │  │ (REST API)   │  │  (registry   │  │  (HuggingFace│  │ (on-demand   │  │  │
│  │  │              │  │   API)       │  │   Hub API)   │  │  enrichment) │  │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │  │
│  │         └─────────────────┴─────────────────┴─────────────────┘          │  │
│  │                                 │ write catalog entries                   │  │
│  └─────────────────────────────────┼───────────────────────────────────────── ┘  │
└────────────────────────────────────┼──────────────────────────────────────────────┘
                                     ▼
                          SQLite catalog store
```

---

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| MCP Server | Expose catalog as MCP tools/resources over HTTP; serve AI agent clients | Next.js API route `/api/[transport]` via `@vercel/mcp-adapter` or `mcp-handler` |
| Next.js Web App | Human-facing UI: browse, search, filter, submit listings | Next.js 15 App Router, React Server Components, Server Actions |
| Telegram Bot | Conversational discovery interface; inline queries; submission flow | grammY, webhook mode, shares service layer with Next.js |
| CatalogService | CRUD on catalog entries; metadata normalization; tag taxonomy | TypeScript module, Drizzle ORM, SQLite/libSQL |
| SearchService | Full-text search, filter by category/tag/chain, ranking | SQLite FTS5 + optional vector column via libSQL vector extension |
| SubmissionService | Validate submitted listings; enqueue enrichment jobs; moderation queue | Queue producer, validates schema, deduplication check |
| Scraping Workers | Pull metadata from GitHub/npm/HuggingFace; normalize to catalog schema; periodic refresh | BullMQ workers in separate process; per-source scrapers |
| Job Queue | Durable async job management for scraping and enrichment; retry/backoff | BullMQ + Redis (single Redis instance locally) |
| SQLite/libSQL | Primary data store: catalog, tags, search index, job history, submissions | libSQL (Turso embedded or local file for single-server zero-budget) |

---

## Recommended Project Structure

```
ai-bazaar/
├── src/
│   ├── app/                         # Next.js App Router
│   │   ├── (web)/                   # Human web UI routes
│   │   │   ├── page.tsx             # Homepage / featured listings
│   │   │   ├── browse/              # Browse by category
│   │   │   ├── listing/[slug]/      # Individual listing page
│   │   │   ├── submit/              # Submission flow
│   │   │   └── packs/               # Starter pack / bundle pages
│   │   └── api/
│   │       ├── [transport]/         # MCP server endpoint (GET + POST)
│   │       │   └── route.ts
│   │       ├── catalog/             # REST API for catalog (used by bot + internal)
│   │       │   └── route.ts
│   │       └── submit/              # Submission webhook endpoint
│   │           └── route.ts
│   ├── mcp/
│   │   ├── server.ts                # MCP tool + resource definitions
│   │   ├── tools/
│   │   │   ├── search.ts            # search_catalog tool
│   │   │   ├── get-listing.ts       # get_listing tool
│   │   │   └── submit.ts            # submit_listing tool
│   │   └── resources/
│   │       └── catalog-schema.ts    # Catalog schema as MCP resource
│   ├── bot/
│   │   ├── index.ts                 # grammY bot entry, webhook setup
│   │   ├── commands/
│   │   │   ├── search.ts            # /search command handler
│   │   │   ├── browse.ts            # /browse <category>
│   │   │   └── submit.ts            # /submit inline flow
│   │   └── inline.ts                # Inline query handler for quick search
│   ├── services/
│   │   ├── catalog.ts               # CatalogService (CRUD, enrichment)
│   │   ├── search.ts                # SearchService (FTS5, filters, ranking)
│   │   └── submission.ts            # SubmissionService (validate, queue)
│   ├── db/
│   │   ├── client.ts                # libSQL/Drizzle client singleton
│   │   ├── schema.ts                # Drizzle table definitions
│   │   └── migrations/              # SQL migration files
│   ├── scraper/
│   │   ├── worker.ts                # BullMQ worker entry point
│   │   ├── queue.ts                 # Queue definitions + job types
│   │   ├── sources/
│   │   │   ├── github.ts            # GitHub REST API scraper
│   │   │   ├── npm.ts               # npm registry scraper
│   │   │   └── huggingface.ts       # HuggingFace Hub API scraper
│   │   └── normalizer.ts            # Source-specific → CatalogEntry transform
│   └── lib/
│       ├── catalog-schema.ts        # Shared CatalogEntry Zod schema
│       ├── tags.ts                  # Canonical tag taxonomy
│       └── slugify.ts               # URL-safe slug generation
├── public/
└── package.json
```

### Structure Rationale

- **`src/mcp/`**: Separates MCP tool definitions from Next.js routing. The route file at `app/api/[transport]/route.ts` calls into `src/mcp/server.ts` — this keeps MCP logic testable independently of the HTTP layer.
- **`src/bot/`**: grammY bot is a separate concern from the web UI but shares `src/services/`. Kept in its own directory because it has a different lifecycle (webhook vs. RSC rendering).
- **`src/services/`**: The shared core. Both MCP tools, Next.js Server Actions, and the Telegram bot call the same `CatalogService` and `SearchService`. This is the critical boundary — never bypass services from a route handler.
- **`src/scraper/`**: The scraping workers run as a separate process (`bun run src/scraper/worker.ts`). They share `src/db/` and `src/services/` but are not part of the Next.js bundle. This keeps scraping outside Next.js serverless function limits.

---

## Catalog Data Model

### Core Schema (Drizzle + SQLite)

```typescript
// src/db/schema.ts
export const listings = sqliteTable('listings', {
  id:           text('id').primaryKey(),          // uuid
  slug:         text('slug').notNull().unique(),   // url-safe name
  name:         text('name').notNull(),
  tagline:      text('tagline').notNull(),         // one-liner
  description:  text('description').notNull(),
  category:     text('category').notNull(),        // 'mcp-server' | 'ai-agent' | 'web3-tool' | ...
  tags:         text('tags').notNull(),            // JSON array, stored as text
  sourceUrl:    text('source_url').notNull(),      // GitHub / npm / HF URL
  docsUrl:      text('docs_url'),
  licenseType:  text('license_type'),              // 'MIT' | 'Apache-2.0' | 'commercial' | ...
  runtime:      text('runtime'),                   // 'node' | 'python' | 'rust' | ...
  chainSupport: text('chain_support'),             // JSON array: ['ethereum', 'solana', ...]
  mcpCompatible:integer('mcp_compatible', { mode: 'boolean' }).default(false),
  acpCompatible:integer('acp_compatible', { mode: 'boolean' }).default(false),
  stars:        integer('stars').default(0),
  downloads:    integer('downloads').default(0),
  lastSeen:     integer('last_seen', { mode: 'timestamp' }),
  submittedBy:  text('submitted_by'),              // null = scraped, else = submitter handle
  verified:     integer('verified', { mode: 'boolean' }).default(false),
  createdAt:    integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:    integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// FTS5 virtual table for full-text search (created via raw SQL in migration)
// CREATE VIRTUAL TABLE listings_fts USING fts5(
//   name, tagline, description, tags,
//   content='listings', content_rowid='rowid'
// );
```

The `tags` field is stored as JSON text (not a join table) — justified for SQLite at this scale. At 10k+ listings where tag filtering becomes a bottleneck, normalize to a `listing_tags` junction table.

---

## Architectural Patterns

### Pattern 1: Shared Service Layer (Single Source of Truth)

**What:** All three interfaces (MCP, web, Telegram) call the same TypeScript service functions. No interface layer contains business logic.

**When to use:** Always. This is non-negotiable for this architecture.

**Trade-offs:** Requires discipline — the pattern breaks the moment a developer adds search logic to an MCP tool handler instead of calling `SearchService.search()`.

**Example:**
```typescript
// src/services/search.ts — called by MCP tools, Next.js Server Actions, and grammY handlers
export async function searchCatalog(params: SearchParams): Promise<SearchResult[]> {
  const { query, category, tags, mcpCompatible, limit = 20, offset = 0 } = params;
  // FTS5 query + filters — single implementation
  return db.all(sql`
    SELECT l.* FROM listings_fts
    JOIN listings l ON listings_fts.rowid = l.rowid
    WHERE listings_fts MATCH ${query}
    ${category ? sql`AND l.category = ${category}` : sql``}
    LIMIT ${limit} OFFSET ${offset}
  `);
}
```

### Pattern 2: MCP Tools Wrap Services (Not Database)

**What:** MCP tool handlers call `SearchService` and `CatalogService` — they never touch the database directly. This makes tools testable and avoids schema leaking into the MCP interface.

**When to use:** All MCP tool definitions.

**Trade-offs:** One extra indirection, but it means the MCP tool interface stays stable even if the DB schema evolves.

**Example:**
```typescript
// src/mcp/tools/search.ts
server.tool(
  'search_catalog',
  'Search AI Bazaar catalog by keyword, category, or protocol compatibility',
  { query: z.string(), category: z.string().optional(), mcpOnly: z.boolean().optional() },
  async ({ query, category, mcpOnly }) => {
    const results = await searchCatalog({ query, category, mcpCompatible: mcpOnly });
    return { content: [{ type: 'text', text: JSON.stringify(results, null, 2) }] };
  }
);
```

### Pattern 3: Scraper → Normalizer → CatalogService (ETL Pipeline)

**What:** Each scraper source produces raw data; a normalizer transforms it to `CatalogEntry`; `CatalogService.upsert()` writes it. No scraper writes to the DB directly.

**When to use:** All scraping sources.

**Trade-offs:** Normalization is a seam — new sources only require a new normalizer, not changes to the DB layer.

**Example:**
```typescript
// src/scraper/sources/github.ts
export async function scrapeGitHubRepo(repoUrl: string): Promise<RawGitHubEntry> { ... }

// src/scraper/normalizer.ts
export function normalizeGitHub(raw: RawGitHubEntry): CatalogEntry { ... }

// src/scraper/worker.ts (BullMQ worker)
worker.process('scrape-github', async (job) => {
  const raw = await scrapeGitHubRepo(job.data.url);
  const entry = normalizeGitHub(raw);
  await catalogService.upsert(entry);
});
```

### Pattern 4: MCP over Streamable HTTP (Remote, Multi-Client)

**What:** The MCP server runs as a Next.js API route at `/api/[transport]`, supporting both Streamable HTTP (POST) and SSE (GET) transports. This makes it a remote MCP server that any MCP host can connect to without installing anything.

**When to use:** From day one. STDIO-only would lock out remote agent clients.

**Trade-offs:** Requires session management (Mcp-Session-Id header). Use `@vercel/mcp-adapter` or `mcp-handler` to avoid implementing this manually.

---

## Data Flow

### Flow 1: Agent Discovery (MCP)

```
AI Agent (Claude, GPT, etc.)
  │  MCP initialize handshake (capability negotiation)
  ▼
Next.js /api/[transport] (Streamable HTTP POST)
  │  @vercel/mcp-adapter routes to tool handler
  ▼
MCP Tool: search_catalog({ query: "solana trading agent" })
  │
  ▼
SearchService.search({ query, filters })
  │  SQLite FTS5 query
  ▼
SQLite listings table → SearchResult[]
  │  JSON serialized as MCP tool response content
  ▼
AI Agent receives structured catalog results
```

### Flow 2: Human Search (Web)

```
Browser → GET /browse?q=mcp+server&category=agent
  │  Next.js RSC renders SearchPage
  ▼
Server Action: searchCatalog(params)
  │  same SearchService.search()
  ▼
SQLite FTS5 → results
  │  streamed as RSC payload
  ▼
Client renders listing cards
```

### Flow 3: Scraping Pipeline (Background)

```
Cron / manual trigger
  ▼
BullMQ Queue: 'scrape-github' job enqueued
  ▼
Worker process (separate from Next.js)
  ▼
GitHub REST API → RawGitHubEntry
  ▼
normalizeGitHub() → CatalogEntry
  ▼
CatalogService.upsert() → SQLite write
  ▼
SearchService.reindex(slug) → FTS5 trigger update
```

### Flow 4: Permissionless Submission

```
Human submits via web form OR Telegram /submit command
  ▼
SubmissionService.validate(entry)
  │  Zod schema validation + dedup check against existing slugs
  ▼
BullMQ Queue: 'enrich-submission' job
  ▼
EnrichmentWorker: hits GitHub/npm/HF APIs to fill missing fields
  ▼
CatalogService.upsert(entry, { verified: false })
  ▼
Listing live immediately (unverified badge) OR held for review
  │  (product decision: optimistic vs. moderated — architecture supports both)
  ▼
Optional: notify submitter via Telegram
```

### Flow 5: Telegram Conversational Search

```
User sends: "show me mcp servers for web3"
  ▼
grammY bot receives message update (webhook)
  ▼
Bot command router → SearchHandler
  ▼
SearchService.search({ query: "mcp servers web3", mcpCompatible: true })
  ▼
Results formatted as Telegram InlineKeyboardMarkup (cards with links)
  ▼
Bot sends response message
```

---

## Component Boundaries (What Talks to What)

| Component | Talks To | Does NOT Talk To |
|-----------|----------|------------------|
| MCP Server route | `src/mcp/server.ts` only | DB directly, scrapers |
| MCP tool handlers | `src/services/*` only | DB directly, bot |
| Next.js Server Actions | `src/services/*` | DB directly, bot, MCP internals |
| Telegram bot handlers | `src/services/*` | DB directly, MCP internals |
| CatalogService | `src/db/client.ts` | scrapers, MCP, bot |
| SearchService | `src/db/client.ts` | scrapers, MCP, bot |
| SubmissionService | `src/db/client.ts`, BullMQ queue | scrapers |
| Scraping workers | `src/services/catalog.ts`, source APIs | MCP, Next.js, bot |
| BullMQ workers | `src/services/*`, external APIs | Next.js request context |

**Key rule:** The service layer is the only thing that touches the database. All other components are consumers of services.

---

## Build Order (Dependency Chain)

Build order is determined by what each layer depends on:

```
Phase 1: Foundation
  1a. DB schema + migrations (listings table, FTS5 index)
  1b. CatalogService (CRUD) — depends on 1a
  1c. SearchService (FTS5 queries) — depends on 1a, 1b
  1d. Zod CatalogEntry schema (shared contract) — depends on nothing

Phase 2: Scraping Pipeline
  2a. BullMQ queue setup + Redis config — depends on nothing
  2b. GitHub scraper + normalizer — depends on 1b, 1d
  2c. npm + HuggingFace scrapers — depends on 1b, 1d
  (Web frontend can exist without scrapers, but catalog needs seed data)

Phase 3: Web Frontend
  3a. Browse/search pages — depends on 1c
  3b. Listing detail page — depends on 1b
  3c. Submission form + SubmissionService — depends on 1b, 2a
  3d. Starter pack pages — depends on 1b

Phase 4: MCP Server
  4a. MCP tool definitions (search, get-listing) — depends on 1b, 1c
  4b. MCP resource: catalog schema — depends on 1d
  4c. /api/[transport] route wiring — depends on 4a, 4b

Phase 5: Telegram Bot
  5a. grammY bot setup + webhook — depends on nothing
  5b. /search, /browse commands — depends on 1c
  5c. /submit flow — depends on 3c (SubmissionService)
  5d. Inline query handler — depends on 1c
```

**Critical dependency:** Phases 3, 4, and 5 all depend on Phase 1 being complete. You cannot build meaningful interfaces without a working catalog data layer. Do not parallelize across this boundary.

**Parallelizable:** Phase 3 (Web), Phase 4 (MCP), and Phase 5 (Telegram) can be built in parallel once Phase 1 is complete. Phase 2 (Scrapers) can also run in parallel with Phase 3+.

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-1k listings | SQLite file, single process, no Redis needed (use in-memory queue or simple cron) |
| 1k-10k listings | SQLite/libSQL still fine; add Redis + BullMQ for scrape scheduling; FTS5 handles search |
| 10k-100k listings | Consider Turso cloud (embedded replica) for read performance; add vector search for semantic queries; externalize Redis |
| 100k+ listings | Migrate to PostgreSQL + pgvector; split Next.js + scraper into separate deploys; add CDN caching for listing pages |

### Scaling Priorities

1. **First bottleneck:** SQLite write contention from concurrent scraper workers. Fix: run workers in a single process with concurrency=1 per queue, or switch to Turso embedded replicas (MVCC-based concurrent writes).
2. **Second bottleneck:** FTS5 search latency at large corpus. Fix: tune FTS5 configuration (bm25 ranking, prefix indexing); consider Meilisearch as a sidecar before migrating off SQLite.

**Single-server zero-budget realities:** For the initial build, skip Redis entirely — use `bullmq-pro` alternatives or a simple SQLite-backed job queue (e.g., `better-queue` with SQLite adapter). Redis adds operational burden at zero budget. Add it when scraping volume requires it.

---

## Anti-Patterns

### Anti-Pattern 1: Per-Interface Database Access

**What people do:** Write search queries directly in MCP tool handlers or Telegram command handlers to avoid "extra layers."

**Why it's wrong:** When the DB schema changes, all three interfaces break. Testing requires a live database. Logic duplicates across interfaces.

**Do this instead:** All database access goes through `CatalogService` and `SearchService`. Always.

### Anti-Pattern 2: STDIO-Only MCP Server

**What people do:** Build the MCP server using STDIO transport only, which requires local installation to use.

**Why it's wrong:** Remote AI agents (Claude.ai, custom API clients) cannot connect. The value of AI Bazaar as a discovery platform drops to near zero if agents must install it locally to use it.

**Do this instead:** Use Streamable HTTP transport from day one via `@vercel/mcp-adapter`. The same Next.js API route supports both STDIO adapter wrappers and remote HTTP connections.

### Anti-Pattern 3: Scraper Workers Inside Next.js Request Handlers

**What people do:** Trigger scraping jobs synchronously inside API route handlers or Server Actions (e.g., `await scrapeGitHub(url)` inside a submit handler).

**Why it's wrong:** Scraping GitHub can take 5-30 seconds. Serverless function timeouts will kill it. It blocks the submission response.

**Do this instead:** Submit handlers enqueue a BullMQ job and return immediately. The worker process handles the scraping asynchronously.

### Anti-Pattern 4: Flat Tag System Without Taxonomy

**What people do:** Accept arbitrary user-supplied tags on submissions, resulting in `mcp`, `MCP`, `mcp-server`, `mcpserver` as separate tags.

**Why it's wrong:** Search and filter become unusable. Users browsing "mcp servers" miss half the listings.

**Do this instead:** Define a canonical tag taxonomy in `src/lib/tags.ts` at project start. Normalizer and SubmissionService map input tags to canonical taxonomy entries. Allow a small `custom_tags` overflow field for non-canonical tags.

### Anti-Pattern 5: ACP as a Primary Protocol Target

**What people do:** Build ACP support alongside MCP, treating them as equivalent.

**Why it's wrong:** ACP (IBM's Agent Communication Protocol) merged with Google's A2A protocol in late 2025 and is no longer actively developed under its own standard. The successor A2A protocol is the trajectory, but MCP has dramatically wider adoption as of early 2026 (OpenAI, Google, and dozens of tools have adopted it).

**Do this instead:** Build MCP as the primary protocol. Add A2A support in a later phase once the A2A spec stabilizes under Linux Foundation governance. Do not invest in standalone ACP integration.

---

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| GitHub REST API | HTTP GET in BullMQ worker; rate-limited with exponential backoff | 60 req/hr unauthenticated; 5000/hr with token. Use token from env var. |
| npm Registry API | HTTP GET `registry.npmjs.org/{package}` | No auth required; high rate limits |
| HuggingFace Hub API | HTTP GET `huggingface.co/api/models` | No auth for public models; token for higher limits |
| Telegram Bot API | grammY in webhook mode (POST `/api/telegram`) | Webhook requires HTTPS; use Next.js API route to receive |
| Redis (optional) | BullMQ queue backend; local instance | Not required for MVP; use SQLite job queue initially |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| MCP route ↔ MCP server | Direct function call (same process) | `createMcpHandler()` registers tools inline |
| Next.js ↔ services | Direct import (same process) | Server Actions call service functions synchronously |
| Telegram bot ↔ services | Direct import (same process or separate worker) | Bot can run as Next.js webhook handler or standalone Bun process |
| Next.js ↔ scraper workers | BullMQ job queue (async, out-of-process) | Producers in Next.js; consumers in separate `bun run worker.ts` process |
| Services ↔ DB | Drizzle ORM + libSQL client | Single client instance shared across services via module singleton |

---

## Sources

- [MCP Architecture Overview — official](https://modelcontextprotocol.io/docs/learn/architecture) — HIGH confidence
- [MCP Streamable HTTP Transport spec](https://modelcontextprotocol.io/specification/2025-03-26/basic/transports) — HIGH confidence
- [Vercel mcp-handler (Next.js MCP adapter)](https://github.com/vercel/mcp-handler) — HIGH confidence (verified implementation pattern)
- [BullMQ documentation](https://docs.bullmq.io) — HIGH confidence
- [ACP → A2A merger context](https://github.com/i-am-bee/acp/discussions/122) — MEDIUM confidence (confirmed via IBM Research blog)
- [IBM ACP overview](https://www.ibm.com/think/topics/agent-communication-protocol) — HIGH confidence (official IBM source)
- [Turso/libSQL for SQLite](https://docs.turso.tech/libsql) — HIGH confidence (official docs)
- [grammY Telegram framework](https://grammy.dev/) — HIGH confidence (official docs)
- [Search/discovery architecture patterns](https://www.tpximpact.com/knowledge-hub/blogs/tech/search-discovery-architecture) — MEDIUM confidence

---

*Architecture research for: AI Bazaar — dual-audience AI/Agent/Web3 discovery platform*
*Researched: 2026-02-18*
