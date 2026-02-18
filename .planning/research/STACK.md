# Stack Research

**Domain:** AI/Agent/Web3 discovery & directory platform
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH (core stack HIGH; MCP/ACP protocol maturity MEDIUM; scraping infrastructure MEDIUM)

---

## Recommended Stack

### Core Technologies

| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Next.js | 16.1.6 | Web frontend + API routes + SSR/SSG | The only React meta-framework with SSG for SEO-critical catalog pages AND API routes for MCP/ACP endpoints in one deploy. React 19 stable in 15.1+, mature App Router. Jet's preferred stack. |
| TypeScript | 5.x (bundled) | Language | Type safety across the entire platform. Non-negotiable when building protocol adapters (MCP/ACP) where contract violations are silent bugs. |
| Bun | 1.x (latest) | Runtime + package manager + test runner | Faster cold starts, native `.env` loading, built-in test runner. Existing project infra runs on Bun. Drop-in Node.js compat for Crawlee and grammy. |
| Drizzle ORM | 0.45.1 | Type-safe database access layer | Best-in-class TypeScript type inference from schema. Generates migrations, works natively with libSQL/Turso, zero runtime overhead vs Prisma. SQL-first mental model is more transparent than Prisma's magic. |
| Turso (libSQL) | 0.17.0 (client) | Primary database | SQLite-compatible, free tier: 500M rows read / 10M rows written / 5GB storage per month — more than enough for MVP catalog with thousands of entries. Native vector search for AI similarity features. No cold starts. One-command Vercel integration. |

### Supporting Libraries

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | 1.26.0 | MCP server implementation | From day 1. Expose catalog tools/resources to AI agents via `McpServer` + `NodeStreamableHTTPServerTransport`. Official Anthropic SDK, high reputation. SSE deprecated — use Streamable HTTP. |
| @modelcontextprotocol/express | (bundled with SDK) | MCP Express middleware | When wiring MCP server into Next.js custom server or standalone Express. Use `createMcpExpressApp()`. |
| acp (BeeAI ACP SDK) | latest | ACP agent communication | Phase 2+. ACP is HTTP-native REST protocol under Linux Foundation. Python SDK primary, TypeScript SDK available. BeeAI platform serves as open registry. Implement after MCP. |
| grammy | 1.40.0 | Telegram bot framework | Telegram discovery bot. Best TypeScript-native Telegram framework, excellent docs, Deno/Bun compatible via Node compat layer. GramIO is Bun-native alternative but smaller ecosystem. |
| crawlee | 3.16.0 | Web scraping for catalog seeding | Crawlee is TypeScript-first, built by Apify, handles concurrency, retries, rate-limit backoff, proxy rotation. Works with Cheerio (fast HTML), Playwright (JS-rendered pages), and raw HTTP. Already in repo (`crawlee-scraper/`). |
| cheerio | (crawlee dep) | HTML parsing in scrapers | Included via Crawlee. Use for GitHub/npm/HuggingFace HTML pages when API rate limits are hit. |
| zod | 3.25+ | Schema validation | Required peer dep of MCP SDK (imports from zod/v4 with v3 compat). Use across entire stack for env vars, API request validation, catalog entry schemas. |
| @libsql/client | 0.17.0 | Turso/libSQL client | Direct database connection driver. Drizzle wraps this — install both. |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| drizzle-kit | 0.31.9 | Database migrations + schema introspection | `bunx drizzle-kit generate` + `bunx drizzle-kit push`. Use `turso` dialect in config. |
| Meilisearch (self-hosted) | latest | Full-text search for catalog | Self-host on build server or use Meilisearch Cloud (free trial then $30/mo). Open source, unlimited docs/searches self-hosted. Typesense is strong alternative but Meilisearch has better docs. Deploy as Docker container. |
| meilisearch (JS client) | 0.55.0 | Meilisearch JS SDK | Verified npm version. Use for indexing catalog entries and serving search API to web + Telegram bot. |
| eslint + @typescript-eslint | latest | Lint | Standard Next.js config. Already configured in `p1/` — mirror that config. |

---

## Installation

```bash
# Core framework + runtime (Bun)
bun create next-app ai-bazaar --typescript --tailwind --app

# Database layer
bun add drizzle-orm @libsql/client
bun add -D drizzle-kit

# MCP protocol
bun add @modelcontextprotocol/sdk

# Telegram bot
bun add grammy

# Scraping
bun add crawlee

# Validation
bun add zod

# Search client (connects to self-hosted Meilisearch)
bun add meilisearch

# Dev tools
bun add -D typescript @types/node eslint @typescript-eslint/eslint-plugin
```

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Turso (libSQL) | PostgreSQL (Neon free tier) | If catalog grows to 1M+ records with complex joins, or vector search needs pg_vector. Neon free tier: 0.5GB. Turso free tier is more generous at 5GB for SQLite. Stick with Turso for MVP. |
| Drizzle ORM | Prisma | If team size grows and onboarding non-TypeScript devs. Prisma has better codegen docs but worse type inference and heavier runtime. Never use with Bun in edge functions — Prisma's binary client doesn't work there. |
| grammy | GramIO | If Bun-native is a hard requirement. GramIO is built for Bun/Deno from ground up. grammY runs fine on Bun via compat layer — prefer grammY for its ecosystem (sessions, menus, conversations plugins). |
| Meilisearch (self-hosted) | Algolia free tier | Only if self-hosting is impossible. Algolia free tier: 10K records, 10K searches/month — will be exceeded quickly. Meilisearch self-hosted: unlimited. Algolia is a migration risk when you hit limits. |
| Meilisearch (self-hosted) | Typesense Cloud | Typesense has a free tier (3 nodes, 100K docs) and is faster. Good alternative if self-hosting Meilisearch adds ops burden. Similar API surface. |
| Next.js API routes for MCP | Standalone Express MCP server | If MCP endpoint needs stateful sessions (streaming, long-running). Next.js serverless functions have 10s timeout on Vercel Hobby (300s on Pro). For stateful MCP with session IDs, run a separate Node/Bun server alongside Next.js. |
| Crawlee | Playwright/Puppeteer directly | Only for very specialized browser automation not covered by Crawlee. Crawlee wraps Playwright with retry, rate limiting, and concurrency — never use raw Playwright for scraping. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| Prisma with Bun on edge | Prisma requires native binary client, breaks in Bun edge/serverless environments. Zero-runtime Drizzle has none of these issues. | Drizzle ORM |
| SSE transport for MCP | Officially deprecated in MCP spec as of 2025-11-25. Clients will drop support. | Streamable HTTP (`NodeStreamableHTTPServerTransport`) |
| Vercel Hobby plan for commercial use | Vercel Hobby is explicitly non-commercial only. If AI Bazaar monetizes (even permissionless submissions), it violates ToS. Upgrade to Pro ($20/mo) before any commercial launch. | Vercel Pro, or Cloudflare Pages (free, no commercial restriction) |
| `axios` for API scraping | Heavy, adds unnecessary bundle weight when `fetch` is native in Bun/Node 18+. Crawlee uses `got-scraping` internally. | Native `fetch` or Crawlee's built-in HTTP crawler |
| MongoDB/Mongoose | Schema-less document store is wrong fit for a structured catalog with typed product entries, tags, categories. Adds complexity without benefit. | Drizzle + Turso |
| Python for scraping (if keeping TS stack) | Context switching between Python scrapers and TS app increases ops complexity. `crawlee-scraper/` already exists in repo as TS. | Crawlee (TypeScript) |
| Redis for caching on free tier | Redis Cloud free tier is 30MB — too small. Upstash free tier (10K commands/day) is viable for basic rate limiting only. | Turso cache tables or Vercel Edge Cache headers |

---

## Stack Patterns by Variant

**If MCP endpoint needs stateful streaming sessions:**
- Run Next.js for web UI on Vercel
- Run a separate Bun server (`bun src/mcp-server.ts`) on build server / Fly.io free tier for stateful MCP sessions
- Because Vercel serverless functions are stateless — sessions require persistent server-side state

**If catalog exceeds 100K entries:**
- Add Meilisearch vector indexing for semantic search (not just keyword)
- Shard Turso databases by category (Turso supports multiple DBs per org)
- Because SQLite full-text search (FTS5) degrades at scale, and Meilisearch handles 1M+ docs efficiently

**If ACP implementation is required before MCP matures:**
- Implement ACP via REST endpoints in Next.js API routes (it's HTTP-native REST)
- Use BeeAI's TypeScript SDK once published; fall back to raw `fetch` against ACP spec
- Because ACP merged with Google A2A in September 2025 — spec may shift; keep implementation thin and behind an adapter

**If Vercel 10s function timeout is hit by scrapers:**
- Move scraping jobs to Bun-based cron on build server
- Trigger via Vercel Cron Jobs (just an HTTP ping to build server) or GitHub Actions scheduled workflow
- Because Next.js serverless is for serving, not long-running scrapes

---

## Version Compatibility

| Package | Compatible With | Notes |
|---------|-----------------|-------|
| @modelcontextprotocol/sdk@1.26.0 | zod@3.25+ | SDK imports from zod/v4 but maintains compat with zod v3.25+. Do NOT use zod < 3.25. |
| drizzle-orm@0.45.1 | @libsql/client@0.17.0 | Verified working combo per official Turso docs. Use `drizzle-orm/libsql` import path. |
| next@16.1.6 | react@19.x | React 19 stable since Next.js 15.1. Use `react@19` + `react-dom@19`. |
| crawlee@3.16.0 | Node 18+ / Bun 1.x | Crawlee requires Node 16+. Bun compat works via Node API layer. |
| grammy@1.40.0 | Bun 1.x | Runs on Bun via Node compat. No native Bun-specific issues known. |
| meilisearch@0.55.0 | Meilisearch server 1.x | Client and server versions must be in sync major version. |

---

## Deployment Architecture (Zero Budget)

| Component | Deploy Target | Free Tier | Notes |
|-----------|--------------|-----------|-------|
| Next.js web app | Vercel Hobby | Free (non-commercial) | Auto-deploy from GitHub. Upgrade to Pro ($20/mo) for commercial. |
| Turso database | Turso Cloud | Free: 5GB / 500M reads | Connect via `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` env vars. |
| Meilisearch | Self-hosted (build server Mac) | Free | Run as Docker: `docker run -p 7700:7700 getmeili/meilisearch`. Expose via ngrok for dev. In prod: Fly.io free tier (256MB RAM is enough for small catalog). |
| Telegram bot | Build server (always-on LaunchAgent) | Free | Same pattern as existing `telegram-bridge/` LaunchAgent. |
| Scraping cron | Build server cron | Free | Bun-based cron job. Avoid Vercel Cron for long-running scrapes. |
| MCP server (stateful) | Fly.io free tier | 3 shared-cpu-1x VMs | If stateful MCP sessions needed. `fly launch` + `fly deploy`. |

---

## Sources

- [MCP TypeScript SDK — Context7 `/modelcontextprotocol/typescript-sdk`](https://github.com/modelcontextprotocol/typescript-sdk) — HIGH confidence. Server setup, Streamable HTTP transport, current v1.26.0.
- [MCP Specification 2025-11-25](https://modelcontextprotocol.io/specification/2025-11-25) — HIGH confidence. SSE deprecated, Streamable HTTP canonical.
- [ACP Agent Communication Protocol — IBM/BeeAI](https://agentcommunicationprotocol.dev/introduction/welcome) — MEDIUM confidence. Protocol is maturing; merged with Google A2A Sept 2025. Keep implementation thin.
- [Turso Pricing / Free Tier](https://turso.tech/pricing) — HIGH confidence. 5GB / 500M reads / 10M writes per month free as of March 2025.
- [Drizzle + Turso official guide](https://orm.drizzle.team/docs/tutorials/drizzle-with-turso) — HIGH confidence. Canonical integration pattern.
- [Vercel Hobby Plan limits](https://vercel.com/docs/plans/hobby) — HIGH confidence. Non-commercial only, 10s function timeout, 100GB bandwidth.
- [Meilisearch vs Algolia](https://www.meilisearch.com/blog/meilisearch-vs-algolia) — MEDIUM confidence (Meilisearch's own comparison, biased). Cross-referenced with Typesense comparison matrix.
- [grammY Telegram framework](https://grammy.dev/) — HIGH confidence. v1.40.0 on npm, active 2025/2026 development.
- [Crawlee npm](https://www.npmjs.com/package/crawlee) — HIGH confidence. v3.16.0, TypeScript-first, handles rate limiting natively.
- npm registry live version checks (2026-02-18): next@16.1.6, @modelcontextprotocol/sdk@1.26.0, drizzle-orm@0.45.1, drizzle-kit@0.31.9, @libsql/client@0.17.0, grammy@1.40.0, crawlee@3.16.0, meilisearch@0.55.0

---

*Stack research for: AI Bazaar — AI/Agent/Web3 discovery platform*
*Researched: 2026-02-18*
