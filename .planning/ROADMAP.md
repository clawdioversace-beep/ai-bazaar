# Roadmap: AI Bazaar

## Overview

AI Bazaar is a permissionless discovery platform for AI/Agent/Web3 tools, serving both human developers and AI agents directly via MCP protocol. The build sequence is strict: catalog foundation first, data pipeline to pre-seed it, then three interfaces (web, MCP, Telegram-deferred to v2) that all share the same service layer, capped by hardening and starter packs before any public URL is shared. Nothing ships empty.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Catalog Foundation** - DB schema, CatalogService, SearchService — the contract all interfaces consume *(completed 2026-02-19)*
- [x] **Phase 2: Scraping Pipeline** - GitHub/npm/HuggingFace scrapers, normalizers, pre-seed 200+ entries *(completed 2026-02-19)*
- [ ] **Phase 3: Web Frontend** - Browse, search, listing detail, submission form, upvotes
- [ ] **Phase 4: MCP Protocol Endpoint** - Machine-readable catalog via Streamable HTTP, agent tools
- [ ] **Phase 5: Submission and Community** - Permissionless form, JSON feed, upvote system
- [ ] **Phase 6: Starter Packs** - Curated bundles for non-technical user onboarding

## Phase Details

### Phase 1: Catalog Foundation
**Goal**: The data model, service layer, and search infrastructure that all three interfaces (web, MCP, Telegram) can be built against without touching the database directly.
**Depends on**: Nothing (first phase)
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07
**Success Criteria** (what must be TRUE):
  1. A CatalogEntry can be created, read, updated, and upserted via CatalogService without writing SQL directly
  2. Full-text search across name, tagline, description, and tags returns ranked results using SQLite FTS5
  3. Category browsing returns only entries matching a given category from the canonical taxonomy
  4. Tag normalization collapses "mcp", "MCP", and "mcp-server" to the same canonical tag
  5. Every listing has a `last_verified_at` timestamp and a dead-link health flag that can be updated independently
**Plans:** 3 plans

Plans:
- [ ] 01-01-PLAN.md — Next.js project init, Drizzle schema, libSQL client, FTS5 custom migration
- [ ] 01-02-PLAN.md — Zod CatalogEntry schema, tag taxonomy, category taxonomy with normalization transforms
- [ ] 01-03-PLAN.md — CatalogService (CRUD, upsert, dead-link), SearchService (FTS5, category browse), integration tests

### Phase 2: Scraping Pipeline
**Goal**: Automated ingestion from GitHub, npm, and HuggingFace that pre-seeds the catalog with 200+ real entries before any public URL is shared.
**Depends on**: Phase 1
**Requirements**: SCRP-01, SCRP-02, SCRP-03, SCRP-04, SCRP-05, SCRP-06, SCRP-07
**Success Criteria** (what must be TRUE):
  1. Running the scrape pipeline produces 200+ catalog entries across 5+ categories in a fresh database
  2. Re-running the pipeline on existing data updates entries in place without creating duplicates (dedup by source URL)
  3. Raw scrape output from each source normalizes to a valid CatalogEntry via Zod without manual field mapping
  4. Each scraper respects per-source rate limits and retries transiently-failed requests with exponential backoff
  5. A scheduled cron re-indexes all sources and flags entries whose source URL returns a non-200 response
**Plans:** 3 plans

Plans:
- [ ] 02-01-PLAN.md — fetchWithRetry utility + 3 source normalizers (GitHub, npm, HuggingFace) with TDD tests
- [ ] 02-02-PLAN.md — GitHub, npm, and HuggingFace API scrapers using Octokit + fetchWithRetry
- [ ] 02-03-PLAN.md — Pre-seed script (200+ entries), bunqueue worker process, cron scheduler, dead-link checks

### Phase 3: Web Frontend
**Goal**: A human-browsable catalog where any developer can find a tool, read its details, and share a clean URL — without an account and without any friction.
**Depends on**: Phase 2
**Requirements**: WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07, WEB-08
**Success Criteria** (what must be TRUE):
  1. A visitor can land on the homepage and immediately see featured listings and "new this week" without scrolling past hero content
  2. A visitor can filter browse results by category, chain, protocol, and runtime in any combination, with results updating on selection
  3. Each listing has a unique URL at `/tools/[slug]` that renders all structured metadata, external metrics, and source links
  4. The site is fully usable on a mobile device with no horizontal scrolling or overlapping elements
  5. Browse and search result pages load with cursor-based pagination, and URLs are shareable and bookmarkable
**Plans**: TBD

Plans:
- [ ] 03-01: Homepage (featured/new listings, category nav), browse page (multi-select filters, sort, pagination)
- [ ] 03-02: Listing detail page at `/tools/[slug]` (all metadata, external metrics, source links, SEO)
- [ ] 03-03: Mobile-responsive layout, Tailwind CSS, "new this week" section, shareable URLs

### Phase 4: MCP Protocol Endpoint
**Goal**: Agents can discover, query, and submit catalog entries programmatically via a compliant MCP server — making AI Bazaar the first AI/Web3 directory that agents can query at runtime.
**Depends on**: Phase 1 (can build in parallel with Phase 3)
**Requirements**: MCP-01, MCP-02, MCP-03, MCP-04, MCP-05, MCP-06
**Success Criteria** (what must be TRUE):
  1. An MCP client can connect to `/api/mcp` via Streamable HTTP transport and list available tools
  2. Calling `search_catalog` with a keyword returns matching listings with cursor-based pagination in MCP-compliant format
  3. Calling `get_listing` with a valid slug or ID returns the full listing detail record
  4. Calling `submit_listing` with a URL creates a new catalog entry (or enqueues enrichment)
  5. The catalog entry schema is accessible as an MCP resource from the server
**Plans**: TBD

Plans:
- [ ] 04-01: MCP server setup at `/api/mcp` using @modelcontextprotocol/sdk 1.26.0, Streamable HTTP transport
- [ ] 04-02: `search_catalog`, `get_listing`, `submit_listing` tools wired to CatalogService/SearchService
- [ ] 04-03: Catalog schema as MCP resource, cursor pagination matching MCP registry spec, `.well-known` metadata

### Phase 5: Submission and Community
**Goal**: Anyone — human or agent — can add a tool to the catalog without an account, and the catalog exposes a machine-readable feed for power users and crawlers.
**Depends on**: Phase 3
**Requirements**: SUB-01, SUB-02, SUB-03, SUB-04
**Success Criteria** (what must be TRUE):
  1. A visitor can submit a tool URL via a web form with no account required, and the submission appears in the catalog after enrichment
  2. Submitting a URL that already exists in the catalog surfaces a deduplicated result rather than creating a duplicate entry
  3. Any listing can be upvoted once per browser session with no authentication required
  4. A JSON feed at a stable URL returns new listings in reverse-chronological order, consumable by agent crawlers
**Plans**: TBD

Plans:
- [ ] 05-01: Permissionless submission form (URL + optional metadata, async BullMQ enrichment job)
- [ ] 05-02: Submission validation (Zod + dedup), anonymous upvote, JSON feed endpoint

### Phase 6: Starter Packs
**Goal**: Non-technical users have guided entry points into the catalog — curated bundles that tell a story about what tools to combine and why, reducing the "where do I even start?" problem.
**Depends on**: Phase 3
**Requirements**: PACK-01, PACK-02, PACK-03, PACK-04
**Success Criteria** (what must be TRUE):
  1. A non-technical user can browse all starter packs at `/packs` and understand what each one is for without reading documentation
  2. Each pack detail page at `/packs/[slug]` lists 5-10 linked tool entries with narrative context explaining how they work together
  3. At least 3 packs covering distinct use cases (e.g. DeFi, AI agent toolbox, Solana builder) are live at launch
**Plans**: TBD

Plans:
- [ ] 06-01: Starter pack data model and seeding (3-5 packs, 5-10 tools each, narrative copy)
- [ ] 06-02: Pack browse page at `/packs`, pack detail page at `/packs/[slug]`

## Progress

**Execution Order:**
Phases 1 -> 2 -> (3, 4, 5 in parallel) -> 6

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Catalog Foundation | 3/3 | Complete | 2026-02-19 |
| 2. Scraping Pipeline | 3/3 | Complete | 2026-02-19 |
| 3. Web Frontend | 0/3 | Not started | - |
| 4. MCP Protocol Endpoint | 0/3 | Not started | - |
| 5. Submission and Community | 0/2 | Not started | - |
| 6. Starter Packs | 0/2 | Not started | - |
