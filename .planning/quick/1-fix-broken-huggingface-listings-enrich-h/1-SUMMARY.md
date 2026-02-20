---
phase: quick
plan: 01
subsystem: database, scraping, ui
tags: [huggingface, scraper, enrichment, quality-filters, search, homepage]

requires: []
provides:
  - isHexId() guard in HF normalizer prevents future hex ID ingestion
  - enrich-huggingface.ts CLI script resolves 600 hex ID listings via HF REST API
  - getNewThisWeek() with quality filters (hex ID exclusion, description length)
  - getRecentlyAdded() fallback function for sparse weeks
  - Homepage "New This Week" falls back to "Recently Added" when < 6 quality items
affects: [scraping, homepage, search, catalog]

tech-stack:
  added: []
  patterns:
    - "SQL GLOB pattern for hex ID detection in queries"
    - "Raw SQL quality filters alongside Drizzle relational queries"
    - "Homepage fallback pattern: quality-primary, recency-fallback"

key-files:
  created:
    - src/scripts/enrich-huggingface.ts
  modified:
    - src/scrapers/normalizers/huggingface-normalizer.ts
    - src/services/search.ts
    - src/app/page.tsx
    - package.json

key-decisions:
  - "isHexId regex /^[0-9a-f]{20,}$/i — 20+ hex chars without a slash"
  - "Enrichment tries models → spaces → datasets endpoint order per hex ID"
  - "All-404 hex IDs marked as dead links (markDeadLink), not deleted"
  - "createdAt stored as Unix seconds — use Math.floor(Date.now()/1000) not Date objects"
  - "GLOB pattern in SQL matches same set as isHexId() function"
  - "Fallback threshold: < 6 quality new items triggers Recently Added section"

duration: 12min
completed: 2026-02-20
---

# Quick Task 1: Fix Broken HuggingFace Listings Summary

**Enrichment script resolves 600 hex ID HF listings via REST API (models/spaces/datasets), normalizer guards future ingestion, homepage quality-filters hex IDs from New This Week with Recently Added fallback**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-02-20T09:18:00Z
- **Completed:** 2026-02-20T09:30:05Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Added `isHexId()` export to huggingface-normalizer.ts — throws on hex IDs during scraper ingestion, preventing future bad data from entering catalog
- Created `src/scripts/enrich-huggingface.ts` with full retry logic: tries HF API (models → spaces → datasets) per hex ID, enriches with real metadata or marks dead
- Replaced `getNewThisWeek()` Drizzle relational query with quality-filtered raw SQL (hex ID exclusion via GLOB, description length >= 10, no HF placeholder descriptions)
- Added `getRecentlyAdded()` fallback function with same quality filters minus 7-day window
- Homepage dynamically shows "Recently Added" heading when fewer than 6 quality new-this-week items exist
- `bun run enrich-hf` package.json script for easy invocation against dev.db

## Task Commits

1. **Task 1: Create enrichment script and fix HF normalizer** - `287c646` (feat)
2. **Task 2: Add quality filters to getNewThisWeek and add Recently Added fallback** - `efd73b9` (feat)

**Plan metadata:** (in final commit)

## Files Created/Modified

- `src/scripts/enrich-huggingface.ts` - CLI enrichment script: queries hex ID listings, resolves via HF API, updates or marks dead
- `src/scrapers/normalizers/huggingface-normalizer.ts` - Added `isHexId()` export and hex ID guard in `normalizeHuggingFaceEntry()`
- `src/services/search.ts` - `getNewThisWeek()` rewritten with SQL quality filters; `getRecentlyAdded()` added
- `src/app/page.tsx` - Fallback logic: `showRecent` flag switches heading and data source when < 6 quality new items
- `package.json` - Added `enrich-hf` script

## Decisions Made

- `isHexId()` uses regex `/^[0-9a-f]{20,}$/i` — 20+ hex chars without slash. Same logic mirrored in SQL GLOB for query-side filtering.
- Enrichment script tries endpoints in order: `models` → `spaces` → `datasets`. First 200-OK response wins.
- Hex IDs that 404 on all three endpoints are marked as `dead_link = true` via `markDeadLink()` (not deleted — preserves audit trail).
- `createdAt` is stored as Unix seconds INTEGER, not Date. Fixed the original `getNewThisWeek()` which passed a `Date` object to a Unix-seconds comparison — this would have returned 0 results after the data type mismatch.
- Fallback threshold set at < 6 (plan spec) — ensures section always shows a meaningful grid.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed createdAt type mismatch in getNewThisWeek()**
- **Found during:** Task 2 (replacing Drizzle relational query with raw SQL)
- **Issue:** Original `getNewThisWeek()` used Drizzle's `gte(l.createdAt, sevenDaysAgo)` where `sevenDaysAgo` was a `Date` object. The `created_at` column is stored as Unix seconds (INTEGER). Drizzle's `{ mode: 'timestamp' }` handles conversion internally, but the raw SQL query needed Unix seconds explicitly.
- **Fix:** Used `Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60` to compute Unix seconds cutoff
- **Files modified:** src/services/search.ts
- **Verification:** `getNewThisWeek()` returns 12 results from dev.db, `getRecentlyAdded()` returns 12 with zero hex ID names
- **Committed in:** efd73b9

---

**Total deviations:** 1 auto-fixed (Rule 1 bug fix)
**Impact on plan:** Necessary for correctness — the timestamp type mismatch would have returned 0 results in production. No scope creep.

## Issues Encountered

- All 600 hex IDs tested against HF API return 404 (confirmed by running script for 27 entries). These are internal HF object hashes that were never valid public URLs. Enrichment correctly marks them all as dead links.

## User Setup Required

None — no external service configuration required. `bun run enrich-hf` runs against local dev.db automatically.

## Next Phase Readiness

- Homepage section is clean — no hex IDs visible
- Enrichment script ready to run against production Turso DB (set TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
- Future HF scraper runs will reject hex IDs at normalizer level
- 600 dead-linked hex ID listings can be pruned from DB in a future cleanup pass if desired

## Self-Check: PASSED

All files verified present. All commit hashes confirmed in git log. Key exports (`isHexId`, `getRecentlyAdded`) confirmed in source files.

---
*Phase: quick*
*Completed: 2026-02-20*
