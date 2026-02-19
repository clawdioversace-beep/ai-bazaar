# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Any agent or human can find the right AI/Web3 tool for their need in under 60 seconds — agents via MCP protocol query, humans via search or curated bundle.
**Current focus:** Phase 2 - Scraping Workers (Phase 1 complete)

## Current Position

Phase: 2 of 6 (Scraping Pipeline)
Plan: 1 of 3 in current phase — COMPLETE
Status: Phase 2 Plan 1 complete, continuing Phase 2
Last activity: 2026-02-19 — Completed 02-01 (HTTP retry utility + 3 source normalizers)

Progress: [█████░░░░░] 22%

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 5 min
- Total execution time: 0.35 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-catalog-foundation | 3/3 | 16 min | 5 min |
| 02-scraping-pipeline | 1/3 | 5 min | 5 min |

**Recent Trend:**
- Last 5 plans: 02-01 (5 min), 01-03 (6 min), 01-02 (3 min), 01-01 (7 min)
- Trend: consistent 5 min average

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

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

None — Phase 2 Plan 1 complete. Plan 2 (Scraper Workers) is next.

### Blockers/Concerns

- Phase 2: GitHub PAT and HF_TOKEN required before scraping workers can run — Jet must provision
- Phase 4: Decision needed on MCP deployment target (Vercel stateless vs. Fly.io Bun process) before Phase 4 planning
- General: Vercel Hobby plan is non-commercial — if any monetization is added, upgrade to Pro ($20/mo) required

## Session Continuity

Last session: 2026-02-19
Stopped at: Completed 02-01-PLAN.md (HTTP retry + normalizers foundation)
Resume file: None
