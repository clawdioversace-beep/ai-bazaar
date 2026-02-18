# Project Research Summary

**Project:** AI Bazaar
**Domain:** Dual-audience AI/Agent/Web3 discovery and directory platform
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH

## Executive Summary

AI Bazaar is a permissionless discovery catalog for MCP servers, AI agents, and Web3 tools — serving both human developers (web browser, Telegram) and AI agents themselves (MCP protocol endpoint). The platform's defining characteristic is dual-audience: the same catalog data is rendered as human-readable HTML for browsers and as MCP-compliant machine-readable JSON for AI agent clients. No existing directory targets this combination. The recommended build approach is scrape-first (pre-seed the catalog from GitHub topics, npm, and HuggingFace APIs before launch) paired with an MCP protocol endpoint from day one, a Telegram discovery bot for the crypto/dev audience, and a simple composite quality score to replace manual curation.

The technical stack is well-determined: Next.js 16 + TypeScript + Bun + Drizzle ORM + Turso (libSQL) for the core, with MCP SDK 1.26.0 via Streamable HTTP transport, grammY for Telegram, and Crawlee for scraping. The architecture is a service-layer pattern where all three interfaces (web, MCP, Telegram) share the same `CatalogService` and `SearchService` — no interface layer touches the database directly. Scraping workers run as a separate Bun process outside Next.js request limits.

The top risks are: (1) launching with an empty catalog and losing early visitors before the scrape pipeline populates it (pre-seeding 200+ entries is non-negotiable before first public URL), (2) using web-page scraping instead of official APIs and getting rate-banned (API-only from day one), and (3) building a generic "yet another AI tools directory" with no reason to exist — the Telegram bot and MCP protocol focus are the primary differentiators and must be built alongside the catalog, not after. ACP/A2A protocol is not a primary target — MCP has dramatically wider adoption; ACP merged with Google A2A in Sept 2025 and is in flux.

---

## Key Findings

### Recommended Stack

The stack is well-suited to zero-budget autonomous deployment. Next.js 16 handles SSG for SEO-critical catalog pages and API routes for MCP endpoints in a single Vercel deploy. Turso (libSQL) provides 5GB free-tier SQLite with native vector search for future semantic features. Drizzle ORM gives full TypeScript type safety with zero runtime overhead — critical when the MCP protocol adapter requires contract precision. The MCP TypeScript SDK 1.26.0 uses Streamable HTTP transport (SSE is officially deprecated as of 2025-11-25 and must not be used). The Telegram bot uses grammY 1.40.0 which runs on Bun without issues.

One critical deployment note: Vercel Hobby plan is explicitly non-commercial — if AI Bazaar monetizes, upgrade to Pro ($20/mo) before any commercial launch. For stateful MCP streaming sessions, run a separate Bun server on Fly.io free tier alongside Next.js, since Vercel serverless functions are stateless.

**Core technologies:**
- **Next.js 16.1.6**: Web frontend + API routes + SSG — single deploy target, Jet's existing stack
- **TypeScript 5.x + Bun 1.x**: Type safety across all protocol adapters; faster cold starts, native env loading
- **Drizzle ORM 0.45.1 + Turso (libSQL)**: Zero-runtime-overhead DB layer; 5GB free tier; vector search built-in
- **@modelcontextprotocol/sdk 1.26.0**: Official MCP server; Streamable HTTP transport (not SSE)
- **grammY 1.40.0**: Telegram bot, Bun-compatible, rich plugin ecosystem
- **Crawlee 3.16.0**: TypeScript-first scraping with rate limiting and retry built-in
- **Meilisearch (self-hosted)**: Full-text search; unlimited self-hosted on build server Docker

### Expected Features

The catalog must be pre-seeded from GitHub/npm/HuggingFace via official APIs before launch. The MCP endpoint is a P1 differentiator — no existing AI directory offers this. Telegram bot is P1 because it reaches the crypto-native audience where they already live. User auth is explicitly deferred to v1.x (auth is an activation killer at v1).

**Must have (table stakes):**
- Searchable catalog with full-text across name, description, tags — users arrive with a query
- Category/tag browsing with multi-select filters and URL-serialized state
- Listing detail pages with source metadata (GitHub stars, last commit, downloads)
- Permissionless submission form — gatekeeping kills conversion
- Basic upvote (no auth required) — minimal community signal
- Pagination / infinite scroll — required past ~50 entries
- "New this week" automated feed — drives return visits
- Shareable clean URLs (`/tools/[slug]`) — SEO and sharing
- Mobile-responsive UI

**Should have (competitive differentiators):**
- MCP/ACP-compatible REST API with cursor pagination — agents query catalog at runtime
- Scrape-first auto-population pipeline (GitHub topics, npm, HuggingFace) — critical mass without waiting for submissions
- Telegram bot for conversational discovery — primary differentiator for crypto/Telegram audience
- Composite Bazaar quality score (GitHub stars + downloads + upvotes) — surfaces quality without manual curation
- 3-5 curated starter packs (e.g., "DeFi dev starter", "AI agent toolbox") — onboards non-technical users
- Dual-audience rendering (same data as HTML and MCP JSON) — no competitor does this for AI/Web3 cross-section

**Defer (v2+):**
- User accounts and authenticated submissions — add when upvote gaming becomes a problem
- User-curated lists — needs auth; defer to v1.x
- Semantic/embedding search — validate keyword search first; add when logs show poor results
- On-chain metadata verification — add after Web3 community requests it
- A2A agent discovery layer — protocol specs still maturing
- Full review/comment system — moderation burden; link to GitHub issues instead

### Architecture Approach

Three consumer interfaces (web, MCP, Telegram) all share a single service layer. No interface layer touches the database directly — `CatalogService` and `SearchService` are the only DB consumers. Scraping workers run as a separate Bun process (`bun run src/scraper/worker.ts`) outside Next.js request lifecycle to avoid serverless timeouts. The build order is strictly sequential at the foundation: DB schema → CatalogService → SearchService must complete before any interface (web, MCP, bot) can be built. Once Phase 1 (foundation) is complete, Phases 3/4/5 (web, MCP, bot) can be built in parallel.

**Major components:**
1. **Next.js App (web)** — SSG catalog pages, Server Actions calling shared services, submission form
2. **MCP Server** (`/api/[transport]`) — Streamable HTTP endpoint exposing `search_catalog`, `get_listing`, `submit_listing` tools to AI agent clients
3. **Telegram Bot** (grammY, webhook) — conversational search/browse/submit sharing the same service layer
4. **CatalogService + SearchService** — the shared core; all interfaces consume these exclusively
5. **Scraping Workers** (BullMQ, separate process) — GitHub/npm/HuggingFace ETL with source normalizers
6. **Turso/libSQL** — SQLite with FTS5 full-text index; primary data store for all catalog data

### Critical Pitfalls

1. **Chicken-and-egg empty catalog at launch** — Pre-seed 200+ entries across 5+ categories via scraping pipeline BEFORE the first public URL is shared. Launching empty is a death sentence for discovery platforms. The Telegram bot mitigates this since interactive responses feel useful even with a smaller catalog.

2. **Web-page scraping vs. official APIs** — GitHub's web UI allows only 60 unauthenticated requests/hour; HuggingFace blocks aggressive web crawling. Use official APIs exclusively from day one: GitHub REST API (authenticated), HuggingFace Hub API with `HF_TOKEN`, `registry.npmjs.org` directly. Never retrofit this.

3. **Data freshness decay** — Build `last_verified_at` and `health_status` fields into the schema from day one. Implement tiered re-indexing (popular entries daily, long-tail weekly). Run weekly HEAD requests for dead-link detection. Catalog with 30%+ dead links destroys trust and is HIGH recovery cost.

4. **SEO thin content deindexing** — Auto-generated catalog pages that mirror GitHub READMEs provide no unique value. Google will deindex 80-95% within 3 months. Each page must add unique cross-platform data (protocol compatibility, quality score, Telegram discovery integration). Do not create category pages until they have 10+ substantive entries.

5. **Zero differentiation / directory graveyard** — Dozens of AI tool directories already exist (Futurepedia, There's An AI For That, etc.). The Telegram bot and MCP-native protocol focus are the primary differentiators. If the team cannot answer "why this over GitHub search?" in one sentence, stop and reposition before writing catalog code.

---

## Implications for Roadmap

Based on combined research, the dependency chain is clear and non-negotiable: data layer must come before interfaces; catalog must be pre-seeded before any public launch.

### Phase 1: Catalog Foundation
**Rationale:** Everything else depends on this. DB schema, CatalogService, SearchService, and the Zod catalog entry schema form the contract that all three interfaces consume. Cannot build UI, MCP endpoint, or bot without this foundation. Protocol fields must be designed loosely here (loose schema, `protocol_version` string, `capabilities[]` array) to survive MCP/ACP spec drift.
**Delivers:** Working DB schema with FTS5 index, CatalogService CRUD, SearchService with filters, Zod CatalogEntry schema
**Addresses:** Listing schema, category taxonomy, data model (table stakes)
**Avoids:** Protocol standards drift pitfall (loose schema); data freshness decay (build `last_verified_at` from day one); canonical tag taxonomy in `src/lib/tags.ts` to prevent tag fragmentation

### Phase 2: Scraping Pipeline + Catalog Pre-seeding
**Rationale:** Catalog must have 200+ entries before any interface is shown to a user. This is the hardest dependency to defer — building the web UI first without data leads to launching with an empty catalog. Run scrapers against GitHub topics (`mcp-server`, `model-context-protocol`, `ai-agent`, `web3`), npm search, and HuggingFace Hub API. Must use authenticated APIs only (GitHub PAT, `HF_TOKEN`).
**Delivers:** BullMQ workers for GitHub/npm/HuggingFace scraping; normalizers; 200+ pre-seeded catalog entries; composite Bazaar quality score calculation; tiered re-index scheduler; dead-link health checks
**Uses:** Crawlee 3.16.0, BullMQ, Drizzle ORM, official APIs
**Avoids:** Scraping ToS violations (API-only); chicken-and-egg empty catalog; freshness decay (scheduler built here, not added later)

### Phase 3: Web Frontend
**Rationale:** Once catalog has data, build the human-facing product. SSG all catalog pages for SEO. Add unique value per page beyond what GitHub shows (protocol compatibility flags, composite score, cross-platform tags) to avoid thin content deindexing. Build submission form with async enrichment (form submits → BullMQ job → enrichment worker, not synchronous scrape).
**Delivers:** Browse/search pages, listing detail pages, submission form, starter pack pages, "new this week" feed, basic upvote
**Addresses:** All table stakes features; SEO canonical URLs; permissionless submission
**Avoids:** Thin content deindexing (unique value on each page); wallet-gating (zero wallet requirement for browsing); anti-pattern of scraping inside request handlers (enqueue jobs)

### Phase 4: MCP Protocol Endpoint
**Rationale:** The primary differentiator and the reason this is not just another directory. Can be built in parallel with Phase 3 once Phase 1 is complete. Use `@vercel/mcp-adapter` (or `mcp-handler`) to avoid manual Streamable HTTP session management. MCP tools wrap services, never touch DB directly. Expose `search_catalog`, `get_listing`, `submit_listing` tools.
**Delivers:** `/api/[transport]` route, MCP tool definitions, catalog schema as MCP resource, `.well-known` metadata, cursor pagination
**Uses:** @modelcontextprotocol/sdk 1.26.0, Streamable HTTP (not SSE), Zod 3.25+
**Avoids:** STDIO-only MCP (must be remote HTTP for agent clients); ACP as co-equal protocol (ACP is in flux; MCP-only for now)

### Phase 5: Telegram Bot
**Rationale:** Meets the target audience (crypto Twitter / Telegram-native users) where they already live. Can be built in parallel with Phase 3 and 4. Key design principle from research: stateless, 3-5 results max, natural language first (not slash-command menus), respond in <3 seconds. Run as LaunchAgent on build server (same pattern as existing `telegram-bridge/`).
**Delivers:** `/search`, `/browse`, `/submit` commands, inline query handler, webhook setup
**Uses:** grammY 1.40.0, shared service layer
**Avoids:** Web-browse UX patterns in chat (pagination, walls of text); stateful session management; wallet-gating in bot

### Phase 6: Quality and Freshness Hardening
**Rationale:** Before any wider distribution, verify the "looks done but isn't" checklist from pitfalls research. Confirm re-index schedule is running in production, dead-link detection is live, API tokens are set in production env, canonical tags are correct, and submission flow is end-to-end tested.
**Delivers:** Production verification of all background jobs; monitoring; launch readiness

### Phase Ordering Rationale

- Phase 1 before everything else: the service layer contract (`CatalogEntry` Zod schema) must be stable before any interface is written against it
- Phase 2 before Phase 3: the web interface is useless without catalog data; pre-seeding is a launch prerequisite, not a post-launch task
- Phases 3, 4, 5 can run in parallel after Phase 1+2 are complete: they all consume the same service layer
- Phase 6 is a gate before wider distribution: pitfalls research shows several "looks done but isn't" failure modes that are HIGH recovery cost if caught post-launch

### Research Flags

Phases likely needing deeper research during planning:
- **Phase 2 (Scraping Pipeline):** GitHub API pagination and GraphQL for complex queries; HuggingFace Hub API endpoint schema; npm registry API stability — recommend `/gsd:research-phase` before planning Phase 2
- **Phase 4 (MCP Endpoint):** `@vercel/mcp-adapter` vs `mcp-handler` — both are valid but API surfaces differ; verify which is more stable for Next.js 16 App Router before implementation
- **Phase 6 (Hardening):** No research needed — checklist from PITFALLS.md is comprehensive and actionable

Phases with standard patterns (skip research-phase):
- **Phase 1 (Foundation):** Drizzle + Turso integration is well-documented; schema design is standard SQLite + FTS5
- **Phase 3 (Web Frontend):** Next.js App Router + RSC + Server Actions are well-documented; Tailwind UI components are standard
- **Phase 5 (Telegram Bot):** grammY webhook setup is well-documented; pattern matches existing `telegram-bridge/` in repo

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All package versions verified against npm registry on 2026-02-18; MCP SDK from official Anthropic source; Turso/Drizzle integration from official docs |
| Features | MEDIUM | Table stakes verified against multiple comparable platforms; MCP spec details HIGH (official docs); anti-feature recommendations are pattern-matching from analogous platforms, not AI Bazaar-specific data |
| Architecture | HIGH | Service-layer pattern from official MCP docs + verified Vercel mcp-handler implementation; BullMQ from official docs; Turso/libSQL from official docs; ACP→A2A merger confirmed via IBM Research + Linux Foundation sources |
| Pitfalls | MEDIUM-HIGH | Chicken-and-egg and data freshness are HIGH (well-documented marketplace failure patterns); scraping ToS from official API docs; SEO thin content from multiple real-world case studies; ACP/A2A drift LOW (merger announcement sourced from community, needs official verification) |

**Overall confidence:** MEDIUM-HIGH

### Gaps to Address

- **ACP/A2A merger confirmation:** The research cites ACP merging with Google A2A in September 2025, but the source confidence is LOW. Verify against official Linux Foundation announcement before building any protocol integration. Practical implication: build MCP only for Phase 4; do not plan ACP work until this is confirmed.
- **Vercel function timeout for MCP stateful sessions:** Research flags that Vercel Hobby 10s timeout may affect stateful MCP sessions. Decision needed: deploy MCP server as separate Bun process on Fly.io from day one, or start on Vercel and migrate when hit? Recommendation is to start on Vercel (stateless catalog queries rarely need >10s) and plan Fly.io migration as a Phase 4 exit criterion.
- **Search at scale:** SQLite FTS5 is adequate to ~5,000 catalog entries. Meilisearch is planned as a sidecar. Decision on when to introduce Meilisearch (vs. continue with FTS5) should be validated by measuring FTS5 latency at 1,000 entries rather than pre-optimizing.
- **Commercial Vercel ToS:** AI Bazaar has a monetization angle (starter pack sponsorships, API access tiers). This triggers Vercel Pro requirement ($20/mo). Flag for Jet before any commercial feature is launched.

---

## Sources

### Primary (HIGH confidence)
- MCP TypeScript SDK v1.26.0 — official Anthropic GitHub: server setup, Streamable HTTP transport
- MCP Specification 2025-11-25 — modelcontextprotocol.io: SSE deprecated, Streamable HTTP canonical
- Turso pricing and Drizzle integration — turso.tech/pricing + orm.drizzle.team/docs/tutorials/drizzle-with-turso
- GitHub REST API rate limits — docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api
- HuggingFace Hub rate limits — huggingface.co/docs/hub/en/rate-limits (September 2025 data)
- Vercel Hobby plan limits — vercel.com/docs/plans/hobby (non-commercial, 10s timeout)
- grammY v1.40.0 — grammy.dev (official docs)
- Telegram Bot API rate limits — core.telegram.org/bots
- npm registry live version checks — 2026-02-18: next@16.1.6, @modelcontextprotocol/sdk@1.26.0, drizzle-orm@0.45.1

### Secondary (MEDIUM confidence)
- MCP Registry launch (September 2025) — InfoQ: feature analysis, no central registry as of early 2026
- AI Agents Directory landscape — aiagentsdirectory.com: competitor feature comparison
- Programmatic SEO thin content — getpassionfruit.com + seomatic.ai: thin content deindexing patterns
- NFX marketplace tactics — nfx.com: chicken-and-egg bootstrapping strategies
- IBM ACP overview — ibm.com/think/topics/agent-communication-protocol
- BullMQ documentation — docs.bullmq.io: queue patterns for scraping workers
- Vercel mcp-handler — github.com/vercel/mcp-handler: Next.js MCP adapter implementation

### Tertiary (LOW confidence)
- ACP + Google A2A merger (September 2025) — agentcommunicationprotocol.dev: cited in multiple sources but official Linux Foundation announcement not directly verified; treat ACP/A2A integration planning as uncertain
- AI Graveyard / zero differentiation outcomes — dang.ai/ai-graveyard: observed phenomenon, useful as motivation not as data

---
*Research completed: 2026-02-18*
*Ready for roadmap: yes*
