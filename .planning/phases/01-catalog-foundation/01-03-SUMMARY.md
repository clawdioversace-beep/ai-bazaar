---
phase: 01-catalog-foundation
plan: 03
subsystem: database
tags: [drizzle-orm, libsql, sqlite, fts5, zod, bun-test]

# Dependency graph
requires:
  - phase: 01-catalog-foundation
    plan: 01
    provides: Drizzle schema (listings table), db client singleton, FTS5 virtual table + triggers
  - phase: 01-catalog-foundation
    plan: 02
    provides: CatalogEntrySchema (Zod validation), tag normalization, category taxonomy
provides:
  - CatalogService: 7 exported functions covering all write operations (create, read, update, upsert, markDeadLink, checkDeadLink, getAllListings)
  - SearchService: 4 exported functions covering all read/search operations (searchCatalog, browseByCategory, countByCategory, rebuildFtsIndex)
  - Integration test suite: 7 tests covering CAT-01 through CAT-07, all passing against real SQLite
affects:
  - 02-scraping (scrapers call CatalogService.upsertBySourceUrl and SearchService.rebuildFtsIndex)
  - 03-web-ui (Next.js routes import SearchService for search/browse, CatalogService for submissions)
  - 04-mcp-server (MCP tools query via SearchService.searchCatalog)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Service layer pattern: CatalogService owns all writes, SearchService owns all reads — no consumer ever touches db directly"
    - "Dynamic imports in test beforeAll to ensure env var is set before db/client.ts module initialization"
    - "Manual AbortController + setTimeout for fetch timeout (not AbortSignal.timeout, which has Bun bug)"
    - "FTS5 raw SQL via drizzle sql`` tagged template; all other queries use relational API"
    - "normalizeSourceUrl extracted as shared helper to ensure upsert lookup matches schema-normalized stored value"
    - "JSON serialization at service boundary: tags and chainSupport stored as TEXT, parsed at service layer"

key-files:
  created:
    - src/services/catalog.ts
    - src/services/search.ts
    - src/lib/__tests__/catalog-service.test.ts
  modified:
    - .gitignore (added test.db)

key-decisions:
  - "Dynamic imports in beforeAll (not static imports) — db/client.ts reads TURSO_DATABASE_URL at module init; env var must be set before module loads"
  - "searchCatalog uses db.run() with sql`` template for FTS5 MATCH queries — Drizzle relational API has no FTS5 support"
  - "browseByCategory uses relational API with eq(l.deadLink, false) — cleaner than raw SQL for simple equality filters"
  - "checkDeadLink returns false (inconclusive) for all non-404/410 statuses including 403, 405, 5xx — prevents false positives from HEAD-blocking servers"
  - "updateListing applies normalization field-by-field (not through CatalogEntrySchema.parse) because input is Partial<> — can't parse incomplete data through full schema"

patterns-established:
  - "Pattern 1 (service-only DB access): All database code goes through CatalogService or SearchService. No raw SQL in consumer code except within these two service files."
  - "Pattern 2 (test isolation): Tests use file:./test.db (cleaned before/after suite), env var set before dynamic imports, migrations applied programmatically via execSync."
  - "Pattern 3 (FTS5 search): Use db.run(sql\`SELECT...FROM listings_fts JOIN listings...\`) for ranked text search. Use browseByCategory for category-filtered lists."

# Metrics
duration: 6min
completed: 2026-02-18
---

# Phase 1 Plan 03: CatalogService + SearchService Summary

**CatalogService (7 functions) and SearchService (4 functions) providing the complete read/write API over the catalog, with 7 integration tests passing against real SQLite with FTS5**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-02-18T22:02:27Z
- **Completed:** 2026-02-18T22:07:47Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments

- CatalogService: complete write API — createListing, getListingById, getListingBySlug, updateListing, upsertBySourceUrl, markDeadLink, checkDeadLink, getAllListings
- SearchService: complete read API — searchCatalog (FTS5 BM25 ranked), browseByCategory, countByCategory, rebuildFtsIndex
- 7 integration tests covering all phase success criteria, all passing against real SQLite file

## Task Commits

1. **Task 1: CatalogService** - `9848213` (feat)
2. **Task 2: SearchService + integration tests** - `1edba1c` (feat)

**Plan metadata:** `[pending final commit]` (docs: complete plan)

## Files Created/Modified

- `src/services/catalog.ts` — CatalogService with 7 exported functions; only valid write path to database
- `src/services/search.ts` — SearchService with FTS5 search, category browsing, and index rebuild
- `src/lib/__tests__/catalog-service.test.ts` — 7 integration tests against real SQLite (test.db)
- `.gitignore` — added test.db to SQLite exclusions

## Decisions Made

- **Dynamic imports in beforeAll**: `db/client.ts` reads `TURSO_DATABASE_URL` at module init time (when `drizzle()` is called). Static imports would be resolved before `beforeAll` runs, so the env var would still be `undefined`. Using `await import()` inside `beforeAll` ensures the env var is set first.

- **db.run() for FTS5**: Drizzle's relational query API has no native FTS5 MATCH support. Used `db.run(sql\`...\`)` with conditional SQL fragments for the search query. All other queries use the relational API.

- **checkDeadLink returns false for non-404/410**: Per research Pitfall 5 — servers that return 403, 405, or 5xx for HEAD requests are not definitively dead. Only 404 and 410 indicate the resource is gone. This prevents false positive dead-link flags.

- **updateListing uses field-by-field normalization**: `CatalogEntrySchema.parse()` requires all required fields. Since `updateListing` takes `Partial<CatalogEntryInput>`, we can't pass incomplete data through the full schema. Instead, tag normalization is applied manually with `Array.from(new Set(input.tags.map(normalizeTag)))` when tags are provided.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restructured test imports from static to dynamic**
- **Found during:** Task 2 (running tests)
- **Issue:** Bun resolves static imports before any module code runs. Setting `process.env.TURSO_DATABASE_URL` in the module body doesn't help — by the time it runs, `db/client.ts` has already been evaluated with `undefined` as the URL, throwing `URL_INVALID`.
- **Fix:** Removed static service imports; used `type`-only imports for type checking and `await import()` inside `beforeAll` for runtime module loading. This ensures the env var is set before `drizzle()` is called.
- **Files modified:** `src/lib/__tests__/catalog-service.test.ts`
- **Verification:** All 7 tests pass — `LibsqlError: URL_INVALID` no longer occurs
- **Committed in:** `1edba1c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking)
**Impact on plan:** Fix was necessary for correct test operation. No scope changes.

## Issues Encountered

- Bun static import resolution order: imports are hoisted and resolved before any module body code runs, which is stricter than some Node.js patterns where `require()` is lazy. Dynamic imports are required for test isolation of singleton modules.

## User Setup Required

None — no external service configuration required. Tests run locally against `file:./test.db`.

## Next Phase Readiness

- Phase 1 complete: DB schema, Zod validation, CatalogService, and SearchService are all production-ready
- Phase 2 (scraping) can begin: scrapers call `upsertBySourceUrl()` to add listings and `rebuildFtsIndex()` after bulk inserts
- Phase 3 (web UI) can begin: Next.js API routes import `searchCatalog` and `browseByCategory` for search/browse pages
- Phase 4 (MCP server) can begin in parallel: MCP tools call `searchCatalog` for tool discovery queries
- No blockers from this phase — all success criteria demonstrated by test suite

---
*Phase: 01-catalog-foundation*
*Completed: 2026-02-18*

## Self-Check: PASSED

- FOUND: src/services/catalog.ts
- FOUND: src/services/search.ts
- FOUND: src/lib/__tests__/catalog-service.test.ts
- FOUND: .planning/phases/01-catalog-foundation/01-03-SUMMARY.md
- FOUND commit: 9848213 (feat: CatalogService)
- FOUND commit: 1edba1c (feat: SearchService + tests)
- Tests: 7 pass, 0 fail
