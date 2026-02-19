# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Any agent or human can find the right AI/Web3 tool for their need in under 60 seconds — agents via MCP protocol query, humans via search or curated bundle.
**Current focus:** Phase 5 - Submission and Community (Phase 1-4 complete)

## Current Position

Phase: 5 of 6 (Submission and Community)
Plan: 3 of 3 in current phase — COMPLETE
Status: Phase 5 complete (submission form, upvote system, JSON Feed all complete)
Last activity: 2026-02-19 — Completed 05-01 (permissionless submission form)

Progress: [█████████████] 78%

## Performance Metrics

**Velocity:**
- Total plans completed: 13
- Average duration: 6 min
- Total execution time: 1.42 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-catalog-foundation | 3/3 | 16 min | 5 min |
| 02-scraping-pipeline | 3/3 | 21 min | 7 min |
| 03-web-frontend | 3/3 | 13 min | 4 min |
| 04-mcp-protocol-endpoint | 2/2 | 25 min | 13 min |
| 05-submission-and-community | 2/3 | 6 min | 3 min |

**Recent Trend:**
- Last 5 plans: 05-02 (4 min), 05-03 (2 min), 04-02 (7 min), 04-01 (18 min), 03-03 (4 min)
- Trend: Phase 5 progressing well; upvote system with optimistic UI complete

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- 05-02: React 19 useOptimistic hook used for instant upvote UI feedback before server responds
- 05-02: Session-based duplicate prevention via sessionStorage (no auth required, resets per browser tab)
- 05-02: Atomic SQL increment using drizzle-orm sql template literal to prevent race conditions
- 05-03: JSON Feed 1.1 spec chosen for maximum interoperability with existing feed readers and agent crawlers
- 05-03: Custom _ai_bazaar extension field provides category, source_url, stars, downloads, mcp_compatible without fetching individual pages
- 05-03: 5-minute CDN cache with 10-minute stale-while-revalidate for performance optimization
- 05-03: Pagination via limit (max 100) and offset query params with next_url in response
- 04-02: Tests use dynamic imports to ensure TURSO_DATABASE_URL is set before db client initializes
- 04-02: Test database (test-mcp.db) isolated from test.db and dev.db to prevent interference
- 04-02: Changed invalid default category from 'other' to 'framework' in submit_listing tool
- 04-01: Used type assertion `as any` for Zod schemas to avoid TypeScript type recursion errors with mcp-handler
- 04-01: Replaced Bun-specific code (Bun.sleep, import.meta.main) with cross-platform equivalents for Next.js build compatibility
- 04-01: Registered tools with registerTool() API instead of deprecated server.tool() based on actual mcp-handler signature
- 04-01: Used base64-encoded JSON cursors for pagination (opaque to client, contains { offset: number } internally)
- 03-03: Downloads shows '0' for zero values, 'N/A' only for null (zero downloads is valid data for new packages)
- 03-03: All tags displayed on detail page (not truncated like ListingCard) — detail page is "full view"
- 03-03: External links have min-height 44px for mobile touch targets (accessibility standard)
- 03-03: Relative time formatting for lastVerifiedAt for human-readable freshness indicator
- 03-02: All filter state lives in URL searchParams — no client-only filter state for shareability
- 03-02: Server Component for /tools page data fetching, Client Components only for FilterPanel and Pagination
- 03-02: Filter changes reset to page 1 automatically to prevent empty result pages
- 03-02: Fixed page size of 24 items (const PAGE_SIZE) for consistent UX
- 03-01: Server Components only for homepage — no 'use client' needed (all data fetched server-side)
- 03-01: Added getFeaturedListings and getNewThisWeek to SearchService — maintains service-only DB access pattern
- 02-03: bunqueue embedded mode chosen over server/TCP mode — 286K ops/sec vs 149K, no need for distributed workers
- 02-03: Fixed categorization bug — defi-tool must be checked before web3-tool (priority order fix)
- 02-03: Serial worker concurrency (1) for all scrapers to respect rate limits
- 02-02: GitHub scraper uses Octokit pagination with maxResults cap to prevent runaway scrapes
- 02-02: npm scraper respects 250-result API cap — multiple keyword queries needed for broader coverage
- 02-02: HuggingFace scraper uses SDK (listModels, listSpaces) with direct API fallback for resilience
- 02-02: All scrapers use upsertBySourceUrl for idempotent operation (re-running updates, doesn't duplicate)
- 02-01: Manual AbortController for timeout — AbortSignal.timeout has Bun bugs; use new AbortController() + setTimeout for reliability
- 02-01: npm normalizer prefers repository URL over npm page — GitHub links more stable/useful than npmjs.com pages
- 02-01: Source-specific category detection — each normalizer has own logic (GitHub topics, npm keywords, HF tags)
- 02-01: Test mock 'as any' type — standard test pattern; type safety not critical in test mocks
- 01-03: Dynamic imports in test beforeAll — db/client.ts reads TURSO_DATABASE_URL at module init; static imports would load before env var is set
- 01-03: searchCatalog uses db.run() with sql`` template — Drizzle relational API has no FTS5 MATCH support
- 01-03: checkDeadLink returns false (inconclusive) for all non-404/410 — prevents false positives from HEAD-blocking servers (per research Pitfall 5)
- 01-03: updateListing normalizes fields individually (not through full schema) — Partial<CatalogEntryInput> cannot be parsed through complete Zod schema
- 01-02: Array.from(new Set()) for tag dedup instead of spread (tsconfig lib config compatibility)
- 01-02: sourceUrl transform strips query params + hash, not just trailing slash (UTM dedup prevention)
- 01-01: drizzle-kit push BANNED — silently destroys FTS5 virtual tables not in schema.ts
- 01-01: FTS5 triggers applied via src/db/migrate.ts custom runner (drizzle-kit turso runner cannot execute BEGIN...END blocks)
- 01-01: Zod pinned to ^3.25.0 (not v4) — Zod 4 has breaking API changes incompatible with research patterns
- 01-01: Local dev uses file:./dev.db; production uses libsql:// Turso URL (same @libsql/client handles both)
- Roadmap: Scrape-first approach — pre-seed 200+ entries before any public URL is shared
- Roadmap: MCP-only for Phase 4 — ACP/A2A deferred (protocol in flux, merger unconfirmed)
- Roadmap: Telegram bot deferred to v2 — focus web + MCP for v1
- Roadmap: Phases 3, 4, 5 can execute in parallel after Phase 2 completes

### Pending Todos

- Phase 4: Debug MCP tool registration issue (tools/list returns roll_dice instead of custom tools)
- Phase 4: Test MCP server with a client once tool registration is fixed
- Ready for Phase 5 (Telegram Bot) or Phase 6 (Verification & Health Checks) — service layer independently verified

### Blockers/Concerns

- Phase 4: MCP tool registration not working — tools/list returns "roll_dice" example instead of custom tools (does NOT block Phase 5/6, service layer independently verified)
- Phase 2: GitHub PAT and HF_TOKEN required before scraping workers can run — Jet must provision
- General: Vercel Hobby plan is non-commercial — if any monetization is added, upgrade to Pro ($20/mo) required

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 05-02-PLAN.md (anonymous upvote system) — Phase 5 plan 2/3 complete
Resume file: None
