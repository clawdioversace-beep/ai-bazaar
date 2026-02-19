---
phase: 04-mcp-protocol-endpoint
plan: 01
subsystem: api
tags: [mcp, model-context-protocol, mcp-handler, @modelcontextprotocol/sdk, zod, next.js, api-routes]

# Dependency graph
requires:
  - phase: 01-catalog-foundation
    provides: CatalogService and SearchService with database operations
  - phase: 01-catalog-foundation
    provides: CatalogEntrySchema for validation and schema introspection
provides:
  - MCP server endpoint at /api/[transport] with Streamable HTTP support
  - search_catalog tool for FTS5 full-text search with cursor-based pagination
  - get_listing tool for retrieving entries by slug or UUID
  - submit_listing tool for programmatic catalog submissions via MCP
  - catalog-schema resource exposing schema as machine-readable JSON
affects: [05-telegram-bot, 06-verification]

# Tech tracking
tech-stack:
  added: [mcp-handler ^1.0.7, @modelcontextprotocol/sdk ^1.25.2]
  patterns: [MCP tool registration with Zod validation, cursor-based pagination with base64-encoded offsets, error handling with isError responses]

key-files:
  created: [src/app/api/[transport]/route.ts]
  modified: [package.json, src/jobs/schedule-scrapes.ts, src/lib/fetch-with-retry.ts, src/workers/scrape-worker.ts]

key-decisions:
  - "Used type assertion `as any` for Zod schemas to avoid TypeScript type recursion errors with mcp-handler"
  - "Replaced Bun-specific code (Bun.sleep, import.meta.main) with cross-platform equivalents for Next.js build compatibility"
  - "Registered tools with registerTool() API instead of deprecated server.tool() based on actual mcp-handler signature"
  - "Used base64-encoded JSON cursors for pagination (opaque to client, contains { offset: number } internally)"

patterns-established:
  - "Pattern 1: MCP tool handlers wrap all logic in try/catch and return isError: true with safe messages (no stack traces)"
  - "Pattern 2: Cursor pagination uses btoa(JSON.stringify({ offset })) for encoding, atob + JSON.parse for decoding"
  - "Pattern 3: All MCP tools delegate to existing CatalogService and SearchService — no direct database access"

# Metrics
duration: 18min
completed: 2026-02-19
---

# Phase 4 Plan 1: MCP Protocol Endpoint Summary

**MCP server at /api/mcp with 3 tools (search, get, submit) and catalog schema resource, wired to existing services via mcp-handler**

## Performance

- **Duration:** 18 min
- **Started:** 2026-02-19T07:55:07Z
- **Completed:** 2026-02-19T08:13:56Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments
- MCP server endpoint created at /api/[transport]/route.ts using Vercel's mcp-handler
- Three tools registered: search_catalog (FTS5 search with pagination), get_listing (slug/UUID lookup), submit_listing (programmatic submissions)
- Catalog schema resource exposed at schema://ai-bazaar/catalog-entry for agent introspection
- All tools wired to existing CatalogService and SearchService from Phase 1
- Error handling returns safe messages with isError flag (no stack trace leaks)

## Task Commits

Each task was committed atomically:

1. **Task 1: Install MCP dependencies** - `90945cd` (chore)
   - Installed mcp-handler ^1.0.7 and @modelcontextprotocol/sdk ^1.25.2
   - Build verification passed with no type conflicts

2. **Task 2: Create MCP route handler** - `ecd0847` (feat)
   - Created /api/[transport]/route.ts with registerTool and registerResource calls
   - Fixed Bun-specific code for Next.js TypeScript compatibility
   - All three tools and resource registered successfully

## Files Created/Modified
- `src/app/api/[transport]/route.ts` - MCP server handler with 3 tools and 1 resource
- `package.json` - Added mcp-handler and @modelcontextprotocol/sdk dependencies
- `src/jobs/schedule-scrapes.ts` - Added @ts-ignore for Bun import.meta.main
- `src/lib/fetch-with-retry.ts` - Replaced Bun.sleep with setTimeout Promise
- `src/workers/scrape-worker.ts` - Replaced Bun.sleep with setTimeout Promise, added @ts-ignore for import.meta.main

## Decisions Made
- **Type assertion workaround:** Used `as any` on Zod schemas to avoid TypeScript "excessively deep type instantiation" errors with mcp-handler's generic types
- **Cross-platform compatibility:** Replaced Bun-specific APIs (Bun.sleep, import.meta.main) with standard JavaScript equivalents to pass Next.js TypeScript checking
- **API method selection:** Used registerTool() instead of deprecated server.tool() based on mcp-handler README examples
- **Cursor format:** Base64-encoded JSON with `{ offset: number }` structure for opaque pagination (client can't manipulate offset directly)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Fixed TypeScript type recursion errors**
- **Found during:** Task 2 (MCP route handler implementation)
- **Issue:** TypeScript compiler reported "Type instantiation is excessively deep" when using Zod schemas with mcp-handler's registerTool() API
- **Fix:** Applied `as any` type assertion to Zod schema objects to bypass deep type inference
- **Files modified:** src/app/api/[transport]/route.ts
- **Verification:** `bun run build` succeeded after fix
- **Committed in:** ecd0847 (Task 2 commit)

**2. [Rule 3 - Blocking] Replaced Bun-specific code for Next.js compatibility**
- **Found during:** Task 2 (Build verification)
- **Issue:** Next.js TypeScript checking failed on Bun-specific APIs: `Bun.sleep()` (3 occurrences) and `import.meta.main` (2 occurrences)
- **Fix:** Replaced `Bun.sleep(delay)` with `new Promise(resolve => setTimeout(resolve, delay))` and added `@ts-ignore` comments for `import.meta.main` checks
- **Files modified:** src/lib/fetch-with-retry.ts, src/workers/scrape-worker.ts, src/jobs/schedule-scrapes.ts
- **Verification:** `bun run build` passed with no TypeScript errors
- **Committed in:** ecd0847 (Task 2 commit)

---

**Total deviations:** 2 auto-fixed (2 blocking issues)
**Impact on plan:** Both auto-fixes necessary for build compatibility. No scope creep — fixes maintain existing functionality while enabling Next.js TypeScript checking.

## Issues Encountered
- **TypeScript type recursion:** mcp-handler's generic type constraints caused deep type instantiation errors when using Zod schemas. Resolution: Type assertion `as any` on schema objects.
- **Bun/Next.js compatibility:** Bun-specific runtime APIs (Bun.sleep, import.meta.main) are not recognized by Next.js TypeScript checking. Resolution: Cross-platform equivalents and @ts-ignore directives for Bun-only entry point checks.

## User Setup Required

None - no external service configuration required.

The MCP server runs as a Next.js API route and uses only local services (CatalogService, SearchService). No API keys, OAuth setup, or external dependencies needed.

## Next Phase Readiness

**Ready for MCP client testing:**
- Endpoint available at /api/mcp (Streamable HTTP transport)
- Three tools and one resource registered
- All tools delegate to existing Phase 1 services (no database changes needed)

**Next steps:**
- Test MCP connection with a client (Claude Desktop, Cursor, or Windsurf)
- Verify tool calls execute correctly
- Test cursor-based pagination with search_catalog
- Validate submit_listing creates entries via CatalogService

**Blockers:**
- None

---
*Phase: 04-mcp-protocol-endpoint*
*Completed: 2026-02-19*

## Self-Check: PASSED

All claims verified:
- ✓ Created file exists: src/app/api/[transport]/route.ts
- ✓ Task 1 commit exists: 90945cd
- ✓ Task 2 commit exists: ecd0847
- ✓ All modified files exist and contain expected changes
