---
phase: 06-starter-packs
plan: 01
subsystem: catalog-data-model
tags: [database, drizzle-orm, starter-packs, seed-data]
dependency_graph:
  requires: [01-catalog-foundation, 02-scraping-pipeline]
  provides: [starter-pack-data-model, pack-service-layer]
  affects: [web-frontend]
tech_stack:
  added: [pack-service, seed-packs-script]
  patterns: [drizzle-relations, junction-table, composite-primary-key, cascade-delete]
key_files:
  created:
    - src/services/packs.ts
    - src/db/seed-packs.ts
    - src/db/migrations/0003_starter_packs.sql
  modified:
    - src/db/schema.ts
    - src/db/migrate.ts
decisions:
  - title: Apply starter pack migration directly in migrate.ts
    rationale: Manual migration not tracked in drizzle-kit journal, applied via client.execute() like FTS5 triggers
    alternatives: [Generate via drizzle-kit, Update journal manually]
  - title: Use hyphens instead of em dashes in narrative copy
    rationale: Em dashes and curly quotes cause parser errors in TypeScript/Bun string literals
    alternatives: [Escape characters, Use template literals]
  - title: Replace fancy quotes with straight quotes
    rationale: Curly apostrophes break JavaScript string parsing
    alternatives: [Escape apostrophes, Use double quotes]
metrics:
  duration: 8 min
  tasks_completed: 2
  commits: 2
  files_created: 3
  files_modified: 2
  lines_added: 477
  completed_at: 2026-02-19T15:50:01Z
---

# Phase 6 Plan 1: Starter Pack Data Model Summary

**One-liner:** Created starter pack tables with Drizzle relations, pack service layer, and seeded 3 curated packs linking 23 tools from the catalog.

## What Was Built

**Objective:** Starter pack data model, migration, relations, service layer, and seed data.

This plan established the database foundation for curated starter packs — a discovery mechanism where 3-5 tools are bundled together for specific use cases like "DeFi Dev Starter" or "AI Agent Toolbox". The implementation includes:

1. **Database schema additions** (src/db/schema.ts):
   - `starterPacks` table with slug, name, tagline, description, coverImage
   - `packTools` junction table with composite primary key (pack_id, tool_id)
   - Cascade delete on both foreign keys (pack → tools, listing → packs)
   - Drizzle relations for nested queries: starterPacksRelations, packToolsRelations, listingsRelations

2. **SQL migration** (0003_starter_packs.sql):
   - CREATE TABLE for both tables
   - Composite PRIMARY KEY on pack_tools (pack_id, tool_id)
   - Indexes on both foreign keys for join performance
   - Applied directly in migrate.ts (not tracked in drizzle-kit journal)

3. **Pack service layer** (src/services/packs.ts):
   - `getPackWithTools(slug)` — fetch pack with ordered tools and full listing data
   - `listPacks()` — fetch all packs for browse page (no nested tools)
   - Uses Drizzle relational query API with `.with()` for nested loading

4. **Seed script** (src/db/seed-packs.ts):
   - 3 starter packs: DeFi Dev Starter (8 tools), AI Agent Toolbox (9 tools), Solana Builder Kit (6 tools)
   - Each pack-tool link has `order` (1-based) and `narrative` (why this tool is in the pack)
   - Gracefully handles missing tools (warns + skips)
   - All 23 tool slugs matched existing catalog entries — 100% link success

## Tasks Completed

### Task 1: Add starter pack tables, relations, and migration to schema

**Files:** src/db/schema.ts, src/db/migrations/0003_starter_packs.sql, src/db/migrate.ts

**What was done:**
- Imported `relations` and `primaryKey` from drizzle-orm
- Added `starterPacks` table definition (8 columns)
- Added `packTools` junction table with composite primary key
- Added Drizzle relations for relational query API
- Created migration 0003 with both tables + indexes
- Updated migrate.ts to apply starter pack migration directly (like FTS5 triggers)

**Commit:** ebdcfc0

**Verification:**
- TypeScript compiles (test files have bun:test import errors — unrelated)
- Migration ran successfully
- Tables exist in dev.db (verified via Drizzle queries)
- Relations work for nested queries

### Task 2: Create pack service layer and seed script with 3+ packs

**Files:** src/services/packs.ts, src/db/seed-packs.ts

**What was done:**
- Created PackService with 2 functions (getPackWithTools, listPacks)
- Wrote comprehensive JSDoc comments with usage examples
- Created seed script with 3 packs and 23 tool links
- Used actual tool slugs from dev.db catalog (queried before writing seed data)
- Ran seed script — all 23 tools found and linked

**Commit:** af1e6ff

**Verification:**
- Service compiles and runs (Bun)
- getPackWithTools returns pack with nested tools array
- Tools are ordered by `order` field
- Each tool has narrative text
- 3 packs seeded with 100% tool match rate

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual migration not in drizzle-kit journal**
- **Found during:** Task 1 migration run
- **Issue:** Migration file 0003 created but not tracked in meta/_journal.json — migrate() function skipped it
- **Fix:** Added starter pack table creation directly to migrate.ts using client.execute() (same pattern as FTS5 triggers)
- **Files modified:** src/db/migrate.ts
- **Commit:** ebdcfc0

**2. [Rule 1 - Bug] Curly quotes breaking JavaScript parser**
- **Found during:** Task 2 seed script test run
- **Issue:** Curly apostrophes in narrative strings ("Microsoft's") caused Bun parser errors
- **Fix:** Rewrote entire seed file with straight quotes and hyphens instead of em dashes
- **Files modified:** src/db/seed-packs.ts
- **Commit:** af1e6ff

## Verification Results

All verification steps passed:

1. ✅ TypeScript compiles (src/services/packs.ts, src/db/seed-packs.ts)
2. ✅ Migration creates both tables with indexes
3. ✅ Seed script runs and links all tools (23/23 matched)
4. ✅ Pack count: 3 packs in dev.db
5. ✅ Tool links: 23 pack_tools rows in dev.db
6. ✅ Nested query works: getPackWithTools returns pack with tools array
7. ✅ Cascade deletes configured on both FKs
8. ✅ Composite primary key prevents duplicate pack-tool links

## Self-Check: PASSED

### Files Created
- ✅ src/services/packs.ts (exists, 77 lines)
- ✅ src/db/seed-packs.ts (exists, 265 lines)
- ✅ src/db/migrations/0003_starter_packs.sql (exists, 26 lines)

### Files Modified
- ✅ src/db/schema.ts (relations and tables added)
- ✅ src/db/migrate.ts (starter pack migration added)

### Commits Exist
- ✅ ebdcfc0 (Task 1: tables + migration)
- ✅ af1e6ff (Task 2: service + seed)

### Data Verification
- ✅ 3 packs in starter_packs table
- ✅ 23 rows in pack_tools table
- ✅ getPackWithTools('defi-dev-starter') returns pack with 8 tools
- ✅ All tools have order, narrative, and full listing data

## Key Technical Decisions

### 1. Manual migration via client.execute()
**Context:** drizzle-kit's journal system tracks migrations, but our migration was added manually (not generated via `drizzle-kit generate`).

**Decision:** Apply the migration directly in migrate.ts using client.execute(), same pattern used for FTS5 triggers.

**Rationale:**
- Avoids manually editing meta/_journal.json (error-prone)
- Keeps migration logic in one place (migrate.ts)
- FTS5 triggers already use this pattern — proven approach
- CREATE TABLE IF NOT EXISTS is idempotent

**Tradeoffs:**
- Migration not tracked in drizzle-kit journal (can't use `drizzle-kit drop`)
- Requires manual coordination if schema changes
- Works fine since this is a one-time setup for starter packs

### 2. Straight quotes only in seed data
**Context:** Narrative copy originally used curly quotes and em dashes for better typography.

**Decision:** Replace all fancy punctuation with ASCII equivalents (straight quotes, hyphens).

**Rationale:**
- JavaScript string literals don't handle curly quotes well (parser errors)
- Em dashes render fine in HTML but break .ts file parsing
- Readability loss is minimal
- Avoids escaping complexity

**Tradeoffs:**
- Slightly less polished typography
- No visual distinction between apostrophes and closing quotes
- Trade accepted for code reliability

## What's Next

This plan provides the data model foundation for Phase 6. Next plans will:

1. **Phase 6 Plan 2:** Frontend pack browse page (list all packs) and pack detail page (show pack with tools)
2. **Phase 6 Plan 3:** Admin UI for creating/editing packs and adding/removing tools from packs

The pack service layer (getPackWithTools, listPacks) is ready for immediate use in Plan 2's UI components.

## Notes

- The pack seed data uses real tool slugs from the catalog — all 23 tools matched on first run (100% success rate)
- Tool slugs were verified by querying dev.db before writing the seed script
- Narrative copy explains WHY each tool is in the pack (not just WHAT it is)
- Pack order is chronological (createdAt ASC) — early packs = highest quality
- DeFi pack has 8 tools, AI Agent has 9, Solana has 6 — different sizes are intentional
- Seed script is idempotent-ish (re-running creates duplicate packs with new UUIDs — fine for dev, but production needs upsert logic)
