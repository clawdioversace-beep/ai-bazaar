---
phase: 02-scraping-pipeline
plan: 03
subsystem: scraping-pipeline
tags: [scraping, workers, scheduler, bunqueue, automation]
dependency_graph:
  requires: [02-02-scrapers]
  provides: [seed-script, scrape-workers, job-scheduler]
  affects: [catalog-database, fts5-index]
tech_stack:
  added: [bunqueue-2.4.6]
  patterns: [embedded-queue, cron-scheduling, graceful-shutdown]
key_files:
  created:
    - src/scripts/seed-catalog.ts
    - src/workers/scrape-worker.ts
    - src/jobs/schedule-scrapes.ts
  modified:
    - src/scrapers/normalizers/github-normalizer.ts
    - src/scrapers/normalizers/npm-normalizer.ts
    - src/scrapers/normalizers/huggingface-normalizer.ts
    - package.json
decisions:
  - choice: Use bunqueue embedded mode instead of server mode
    rationale: Single-process application with 286K ops/sec embedded performance vs 149K ops/sec TCP mode; no need for distributed workers
    alternatives: [BullMQ+Redis, Agenda+MongoDB, custom cron]
  - choice: Fixed categorization priority bug in all 3 normalizers
    rationale: defi-tool was unreachable due to being checked after web3-tool (which includes 'defi' in its check array); infra and framework categories were missing
    alternatives: [none - this was a correctness bug]
  - choice: Serial worker concurrency (1) for all scrapers
    rationale: Respect rate limits and avoid overwhelming upstream APIs
    alternatives: [parallel execution - rejected due to rate limit risks]
metrics:
  duration: 12m 36s
  tasks_completed: 2
  files_created: 3
  files_modified: 4
  tests_passing: 22
  catalog_entries: 3259
  categories_populated: 6
  commits: 2
  completed_date: 2026-02-19
---

# Phase 02 Plan 03: Worker Scheduler & Pre-seed Summary

**One-liner:** Pre-seed script produces 3,259 entries across 6 categories; bunqueue workers automate daily re-indexing

## What Was Built

**1. Pre-seed Script (`src/scripts/seed-catalog.ts`)**
- Standalone script that runs all 3 scrapers with predefined topics/keywords
- Scrapes 6 GitHub topics, 6 npm keywords, 3 HuggingFace tags
- Produces 3,259 catalog entries across all 6 categories
- Idempotent: re-running maintains stable count (upsertBySourceUrl deduplication)
- Rebuilds FTS5 index after bulk insert
- Validates success criteria (200+ entries, 5+ categories) and exits with error if not met

**Category Breakdown:**
- mcp-server: 898 entries
- framework: 619 entries
- infra: 526 entries (new)
- defi-tool: 510 entries (new)
- web3-tool: 356 entries
- ai-agent: 350 entries

**2. Scrape Workers (`src/workers/scrape-worker.ts`)**
- 4 bunqueue workers in embedded mode (SQLite-backed, no Redis)
- GitHub scraper worker: processes 'scrape-github' queue jobs
- npm scraper worker: processes 'scrape-npm' queue jobs
- HuggingFace scraper worker: processes 'scrape-huggingface' queue jobs
- Dead link checker worker: processes 'check-dead-links' queue jobs
  - Iterates all listings
  - Calls checkDeadLink + markDeadLink for each
  - Throttled at 10 checks/second to avoid overwhelming servers
- All workers run serially (concurrency: 1) to respect rate limits
- Graceful shutdown on SIGTERM/SIGINT

**3. Job Scheduler (`src/jobs/schedule-scrapes.ts`)**
- Enqueues 16 recurring jobs via bunqueue cron scheduling
- GitHub scrapes: daily at 2 AM UTC (6 jobs, one per topic)
- npm scrapes: daily at 3 AM UTC (6 jobs, one per keyword)
- HuggingFace scrapes: daily at 4 AM UTC (3 jobs, one per tag)
- Dead link check: daily at 5 AM UTC (1 job)
- Jobs process when workers are active

**4. package.json Scripts:**
- `seed` / `seed:prod`: Run pre-seed script
- `worker` / `worker:prod`: Start background workers
- `schedule`: Enqueue recurring jobs

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed categorization priority order in all normalizers**
- **Found during:** Task 1 (first seed run produced only 4 categories instead of 5+)
- **Issue:** defi-tool category was unreachable because 'defi' was included in the web3-tool check, which ran before defi-tool check. infra and framework categories had no detection logic.
- **Fix:** Reordered category checks in all 3 normalizers (GitHub, npm, HuggingFace) to check defi-tool BEFORE web3-tool. Added infra and framework category detection.
- **Files modified:**
  - src/scrapers/normalizers/github-normalizer.ts
  - src/scrapers/normalizers/npm-normalizer.ts
  - src/scrapers/normalizers/huggingface-normalizer.ts
- **Commit:** 6c4c53d

**2. [Rule 2 - Missing critical] Added missing category logic**
- **Found during:** Task 1 (analyzing why only 4 categories populated)
- **Issue:** infra and defi-tool categories existed in schema but had no normalizer logic to assign them
- **Fix:** Added keyword/topic/tag detection for:
  - infra: ['infrastructure', 'infra', 'docker', 'kubernetes', 'k8s', 'monitoring', 'database', 'devops']
  - defi-tool: ['defi', 'yield', 'swap', 'amm', 'dex', 'lending', 'staking']
  - framework: ['framework', 'library', 'sdk']
- **Files modified:** Same as above
- **Commit:** 6c4c53d

## Technical Notes

**bunqueue Architecture:**
- Embedded mode uses SQLite (file-backed queue) instead of Redis
- 286K ops/sec throughput (vs 149K for TCP mode)
- Zero external dependencies
- Workers and queues run in the same process
- Suitable for single-server deployments

**Rate Limit Strategy:**
- All workers use concurrency: 1 (serial execution)
- Dead link checker throttles at 10 checks/second
- GitHub API: 60 req/hour unauthenticated (warning logged)
- npm registry: no documented rate limits
- HuggingFace: no documented rate limits

**FTS5 Index Rebuild:**
- Critical after bulk inserts (seed script)
- Normal single-row inserts via createListing() are auto-synced by triggers
- rebuildFtsIndex() called once after all scrapers complete

## Verification Results

All verification criteria passed:

1. `bun run seed` produces 3,259 entries across 6 categories ✓
2. Re-running seed maintains stable count (idempotency verified) ✓
3. All 22 tests pass ✓
4. TypeScript compiles with zero errors ✓
5. Category distribution: all 6 categories populated with 350-898 entries each ✓
6. Worker starts without errors and handles SIGTERM gracefully ✓
7. Scheduler enqueues all 16 recurring jobs successfully ✓

## Self-Check: PASSED

**Created files verified:**
- [FOUND] src/scripts/seed-catalog.ts
- [FOUND] src/workers/scrape-worker.ts
- [FOUND] src/jobs/schedule-scrapes.ts

**Commits verified:**
- [FOUND] 6c4c53d (Task 1: seed script + categorization fixes)
- [FOUND] 0686371 (Task 2: workers + scheduler)

## Success Criteria Met

- [x] 200+ catalog entries exist after seed run (actual: 3,259)
- [x] 5+ categories have at least 1 entry each (actual: 6 categories)
- [x] Duplicate run stability: second seed run maintains ~same count ✓
- [x] Worker process starts, handles SIGTERM gracefully, exits cleanly ✓
- [x] Scheduler enqueues recurring jobs for all sources + dead-link checks ✓
- [x] All package.json scripts work: seed, worker, schedule ✓

## Phase 2 Complete

**Phase 2 Success Criteria:**
1. **200+ entries from real APIs** — ✓ 3,259 entries from GitHub, npm, HuggingFace
2. **Deduplication works** — ✓ Re-running seed script maintains stable count
3. **Categories auto-assigned** — ✓ All 6 categories populated via normalizer logic

Phase 2 (Scraping Pipeline) is complete. Ready for Phase 3 (Next.js Frontend).
