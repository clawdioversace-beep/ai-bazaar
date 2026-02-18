# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-18)

**Core value:** Any agent or human can find the right AI/Web3 tool for their need in under 60 seconds — agents via MCP protocol query, humans via search or curated bundle.
**Current focus:** Phase 1 - Catalog Foundation

## Current Position

Phase: 1 of 6 (Catalog Foundation)
Plan: 3 of 3 in current phase
Status: In progress
Last activity: 2026-02-18 — Completed 01-01 (Drizzle schema + FTS5 migration)

Progress: [███░░░░░░░] 12%

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 5 min
- Total execution time: 0.17 hours

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 01-catalog-foundation | 2/3 | 10 min | 5 min |

**Recent Trend:**
- Last 5 plans: 01-02 (3 min), 01-01 (7 min)
- Trend: -

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: Scrape-first approach — pre-seed 200+ entries before any public URL is shared
- Roadmap: MCP-only for Phase 4 — ACP/A2A deferred (protocol in flux, merger unconfirmed)
- Roadmap: Telegram bot deferred to v2 — focus web + MCP for v1
- Roadmap: Phases 3, 4, 5 can execute in parallel after Phase 2 completes
- 01-02: Array.from(new Set()) for tag dedup instead of spread (tsconfig lib config compatibility)
- 01-02: sourceUrl transform strips query params + hash, not just trailing slash (UTM dedup prevention)
- 01-01: drizzle-kit push BANNED — silently destroys FTS5 virtual tables not in schema.ts
- 01-01: FTS5 triggers applied via src/db/migrate.ts custom runner (drizzle-kit turso runner cannot execute BEGIN...END blocks)
- 01-01: Zod pinned to ^3.25.0 (not v4) — Zod 4 has breaking API changes incompatible with research patterns
- 01-01: Local dev uses file:./dev.db; production uses libsql:// Turso URL (same @libsql/client handles both)

### Pending Todos

None — Plans 01-01 and 01-02 complete. Plan 01-03 (CatalogService + SearchService) is next.

### Blockers/Concerns

- Phase 2: GitHub PAT and HF_TOKEN required before scraping workers can run — Jet must provision
- Phase 4: Decision needed on MCP deployment target (Vercel stateless vs. Fly.io Bun process) before Phase 4 planning
- General: Vercel Hobby plan is non-commercial — if any monetization is added, upgrade to Pro ($20/mo) required

## Session Continuity

Last session: 2026-02-18
Stopped at: Completed 01-01-PLAN.md
Resume file: None
