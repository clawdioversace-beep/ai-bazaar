# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Any agent or human can find the right AI/Web3 tool for their need in under 60 seconds — agents via MCP protocol query, humans via search or curated bundle.
**Current focus:** Phase 3 - Web Frontend (Phase 1-2 complete)

## Current Position

Phase: 3 of 6 (Web Frontend)
Plan: 2 of 3 in current phase — IN PROGRESS
Status: Phase 3 Plan 02 complete (Browse & Filter)
Last activity: 2026-02-19 — Completed 03-02 (Browse page with multi-filter, sort, pagination)

Progress: [██████░░░░] 44%

## Performance Metrics

**Velocity:**
- Total plans completed: 8
- Average duration: 5 min
- Total execution time: 0.83 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-catalog-foundation | 3/3 | 16 min | 5 min |
| 02-scraping-pipeline | 3/3 | 21 min | 7 min |
| 03-web-frontend | 2/3 | 9 min | 4.5 min |

**Recent Trend:**
- Last 5 plans: 03-02 (5 min), 03-01 (4 min), 02-03 (13 min), 02-02 (3 min), 02-01 (5 min)
- Trend: Phase 3 maintaining efficient execution (4-5 min per plan)

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

- Phase 3 Plan 03: Detail page (/tools/[slug]) with full listing information

### Blockers/Concerns

- Phase 2: GitHub PAT and HF_TOKEN required before scraping workers can run — Jet must provision
- Phase 4: Decision needed on MCP deployment target (Vercel stateless vs. Fly.io Bun process) before Phase 4 planning
- General: Vercel Hobby plan is non-commercial — if any monetization is added, upgrade to Pro ($20/mo) required

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 03-02-PLAN.md (Browse & Filter) — Phase 3 in progress
Resume file: None
