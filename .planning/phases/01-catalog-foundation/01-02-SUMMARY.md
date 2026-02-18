---
phase: 01-catalog-foundation
plan: 02
subsystem: database
tags: [zod, typescript, catalog, taxonomy, validation, tags, categories]

requires: []
provides:
  - TAG_ALIASES map and normalizeTag function (src/lib/tags.ts)
  - CATEGORIES const array and Category type (src/lib/categories.ts)
  - Zod CatalogEntrySchema with tag/URL transforms (src/lib/catalog-schema.ts)
  - CatalogEntry output type and CatalogEntryInput pre-transform type
  - createSlug utility for scraper and form slug generation
affects:
  - 01-03 (search and catalog service will import CatalogEntrySchema)
  - Phase 2 scrapers (must parse all ingested data through CatalogEntrySchema)
  - Phase 3 web UI (uses Category type for filters, CATEGORY_LABELS for display)
  - Phase 4 MCP server (validates tool query results through schema)

tech-stack:
  added: [zod@4.3.6, typescript@5.9.3, @types/bun@1.3.9]
  patterns:
    - "Parse-don't-validate: all normalization at schema boundary, not in service code"
    - "Array.from(new Set()) for deduplication to avoid ES2015 iterable spread issues"
    - "z.input<> and z.infer<> dual types for pre/post-transform type safety"

key-files:
  created:
    - src/lib/tags.ts
    - src/lib/categories.ts
    - src/lib/catalog-schema.ts
  modified: []

key-decisions:
  - "Use Array.from(new Set()) instead of spread [...new Set()] to avoid TypeScript lib config issues"
  - "sourceUrl transform strips query params and hash in addition to trailing slash to prevent dedup failures from UTM params"
  - "Tags field uses z.array().transform() so input type accepts raw strings but output guarantees canonical forms"

patterns-established:
  - "All data entering catalog passes through CatalogEntrySchema.parse() — no exceptions"
  - "Tag normalization at schema boundary, not in service/scraper code"
  - "URL normalization (sourceUrl) at schema boundary to enforce dedup key consistency"

duration: 3min
completed: 2026-02-18
---

# Phase 1 Plan 2: Catalog Schema and Taxonomy Summary

**Zod CatalogEntrySchema with Bun/TypeScript project init, 22-alias tag normalization, 6-category enum, and URL dedup transforms enforced at parse time**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-18T21:50:52Z
- **Completed:** 2026-02-18T21:53:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- TAG_ALIASES covers 22 variant strings across MCP, ACP, A2A, Web3, DeFi, Solana, AI/ML, LLM tag groups — all collapsed to canonical hyphenated slugs at parse time
- CatalogEntrySchema validates all CAT-01 fields: normalizes tags (dedup + alias resolution), strips trailing slashes and query params from sourceUrl, and rejects any category not in the canonical 6-item enum
- CATEGORIES const array with Category type and CATEGORY_LABELS provides compile-time safety for all category references throughout the codebase

## Task Commits

Each task was committed atomically:

1. **Task 1: Create tag taxonomy and category enum** - `d553a79` (feat)
2. **Task 2: Create Zod CatalogEntry schema with tag and URL normalization transforms** - `4cbdbd1` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/lib/tags.ts` - TAG_ALIASES map (22 entries) and normalizeTag() function
- `src/lib/categories.ts` - CATEGORIES const array, Category type, CATEGORY_LABELS display map
- `src/lib/catalog-schema.ts` - CatalogEntrySchema Zod object with transforms, CatalogEntry/CatalogEntryInput types, createSlug utility

## Decisions Made

- Used `Array.from(new Set())` instead of `[...new Set()]` spread — the tsconfig `lib: ["ESNext"]` without `dom` causes the spread to fail with TypeScript's iterable check; `Array.from` is universally supported
- `sourceUrl` transform strips the full URL to `protocol + hostname + pathname` (no query params, no hash) — ensures UTM params and tracking fragments don't create false duplicates for the same canonical resource
- Initialized bun project with `bun init` + installed `zod` manually since Plan 01-01 (Next.js + Drizzle setup) had not been executed yet — these library files have no dependency on Next.js or Drizzle and compile cleanly in a standalone Bun/TypeScript context

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Initialized minimal Bun project before creating lib files**
- **Found during:** Task 1 (before starting)
- **Issue:** Plan 01-01 (Next.js project init) had not been executed — no package.json, no tsconfig, no zod installed. The verify step `bunx tsc --noEmit` would fail with no TypeScript installed.
- **Fix:** Ran `bun init -y` then `bun add zod` to create the minimal project scaffold required for compilation verification
- **Files modified:** package.json, tsconfig.json, bun.lock (project init files)
- **Verification:** `bunx tsc --noEmit` exits cleanly after initialization
- **Committed in:** d553a79 (Task 1 commit — init files included)

**2. [Rule 1 - Bug] Replaced spread syntax with Array.from() for Set deduplication**
- **Found during:** Task 2 (TypeScript compilation)
- **Issue:** `[...new Set(tags.map(normalizeTag))]` failed with TS2802 ("Type 'Set<string>' can only be iterated through when using --downlevelIteration or ES2015+") when passing the file directly to tsc without the tsconfig
- **Fix:** Changed to `Array.from(new Set(tags.map(normalizeTag)))` — functionally identical, no TS issues
- **Files modified:** src/lib/catalog-schema.ts
- **Verification:** `bunx tsc --noEmit` passes, runtime dedup test confirms `['MCP','mcp','mcpserver'] -> ['mcp-server']`
- **Committed in:** 4cbdbd1 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both auto-fixes necessary and non-invasive. No scope changes. All plan must-haves satisfied.

## Issues Encountered

None — both deviations were resolved inline without blocking task completion.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- CatalogEntrySchema is ready for import by 01-03 (catalog service), Phase 2 scrapers, Phase 3 UI, and Phase 4 MCP
- Plan 01-01 (Next.js + Drizzle setup) still needs execution before 01-03 can run DB queries
- All three exported types (CatalogEntry, CatalogEntryInput, CATEGORIES) tested and verified

---
*Phase: 01-catalog-foundation*
*Completed: 2026-02-18*

## Self-Check: PASSED

- FOUND: src/lib/tags.ts
- FOUND: src/lib/categories.ts
- FOUND: src/lib/catalog-schema.ts
- FOUND commit: d553a79 (feat(01-02): create tag taxonomy and category enum)
- FOUND commit: 4cbdbd1 (feat(01-02): create Zod CatalogEntry schema with tag and URL normalization)
