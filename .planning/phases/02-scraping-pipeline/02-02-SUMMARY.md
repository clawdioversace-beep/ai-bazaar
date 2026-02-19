---
phase: 02-scraping-pipeline
plan: 02
subsystem: scraping
tags: [octokit, github-api, npm-registry, huggingface-hub, fetch-retry]

# Dependency graph
requires:
  - phase: 02-01
    provides: HTTP retry utility and source normalizers (GitHub, npm, HuggingFace)
provides:
  - GitHub scraper with Octokit pagination and rate limit handling
  - npm registry scraper with 250-result cap handling
  - HuggingFace scraper with SDK + direct API fallback strategy
  - Environment variable documentation for API tokens
affects: [02-03, 03-web-catalog]

# Tech tracking
tech-stack:
  added: [octokit, @huggingface/hub]
  patterns: [scraper module pattern with processed/error counts, SDK-first with fallback strategy]

key-files:
  created:
    - src/scrapers/github-scraper.ts
    - src/scrapers/npm-scraper.ts
    - src/scrapers/huggingface-scraper.ts
    - p1/.env.example
  modified:
    - .env.example
    - package.json
    - bun.lock

key-decisions:
  - "GitHub scraper uses Octokit pagination with maxResults cap to prevent runaway scrapes"
  - "npm scraper respects 250-result API cap — multiple keyword queries needed for broader coverage"
  - "HuggingFace scraper uses SDK (listModels, listSpaces) with direct API fallback for resilience"
  - "All scrapers use upsertBySourceUrl for idempotent operation (re-running updates, doesn't duplicate)"

patterns-established:
  - "Scraper return signature: Promise<{ processed: number; errors: number }>"
  - "Individual item errors are caught, logged, and counted — batch never aborts"
  - "Environment variables are optional with fallback logging (warn but don't crash)"

# Metrics
duration: 3min
completed: 2026-02-19
---

# Phase 02 Plan 02: Scraper Workers Summary

**Three API scrapers (GitHub, npm, HuggingFace) with pagination, rate limiting, and idempotent upsert into catalog**

## Performance

- **Duration:** 3 min
- **Started:** 2026-02-19T03:07:54Z
- **Completed:** 2026-02-19T03:11:52Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments

- GitHub scraper with Octokit pagination handles 5000 req/hr authenticated (60 unauthenticated)
- npm scraper handles registry API 250-result cap with resilient fetch-retry
- HuggingFace scraper uses SDK-first approach with direct API fallback for maximum coverage
- All scrapers are idempotent — re-running updates existing entries without duplicates

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies and create GitHub scraper** - `13bddfe` (feat)
2. **Task 2: npm registry scraper** - `6bf08e6` (feat)
3. **Task 3: HuggingFace Hub scraper** - `aff51b2` (feat)

## Files Created/Modified

- `src/scrapers/github-scraper.ts` - GitHub topic-based repo scraper using Octokit with pagination and rate limit handling
- `src/scrapers/npm-scraper.ts` - npm keyword search with 250-result cap and fetchWithRetry
- `src/scrapers/huggingface-scraper.ts` - HuggingFace tag search with SDK + fallback API strategy
- `.env.example` - Documents GITHUB_TOKEN and HUGGINGFACE_TOKEN with generation instructions
- `p1/.env.example` - Created for p1 subdirectory (appears to be separate env config)
- `package.json` - Added octokit and @huggingface/hub dependencies
- `bun.lock` - Dependency lockfile updates

## Decisions Made

**1. maxResults cap on all scrapers**
- Prevents runaway API consumption during testing
- Default 500 for GitHub, 250 for npm, 200 for HuggingFace
- Scraper consumers (worker scheduler) can override as needed

**2. Individual item error handling**
- Each scraper catches errors per-item and logs them
- Errors increment the `errors` counter but don't abort the batch
- This ensures partial success — 95 successful out of 100 is valuable data

**3. Optional environment variables**
- All API tokens are optional with warning logs
- GitHub scraper works unauthenticated (60 req/hr) for testing
- HuggingFace scraper works unauthenticated with lower rate limits
- Production deployment will require GITHUB_TOKEN for practical usage

**4. HuggingFace fallback strategy**
- SDK approach is preferred (type-safe, better error handling)
- Direct API fallback ensures resilience if SDK filtering has issues
- Research noted TypeScript SDK tag filtering syntax was uncertain

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - all scrapers compiled and passed smoke tests on first attempt.

## User Setup Required

**External services require manual configuration.** Before running scrapers in production:

**GitHub (required for practical scraping):**
- Generate personal access token at: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens
- Scope: `public_repo` read-only is sufficient
- Add to `.env`: `GITHUB_TOKEN=ghp_your_token_here`
- Benefit: 5000 req/hour vs 60 unauthenticated

**HuggingFace (optional):**
- Generate access token at: huggingface.co → Settings → Access Tokens
- Scope: read-only
- Add to `.env`: `HUGGINGFACE_TOKEN=hf_your_token_here`
- Benefit: Higher rate limits (no specific limit documented)

**Verification:**
```bash
# Test GitHub scraper (5 repos limit for quick test)
TURSO_DATABASE_URL=file:./dev.db bun -e "import { scrapeGitHub } from './src/scrapers/github-scraper'; scrapeGitHub('mcp-server', 5).then(r => console.log(r))"

# Test npm scraper
TURSO_DATABASE_URL=file:./dev.db bun -e "import { scrapeNpm } from './src/scrapers/npm-scraper'; scrapeNpm('mcp', 5).then(r => console.log(r))"

# Test HuggingFace scraper
TURSO_DATABASE_URL=file:./dev.db bun -e "import { scrapeHuggingFace } from './src/scrapers/huggingface-scraper'; scrapeHuggingFace('agent', 5).then(r => console.log(r))"
```

## Next Phase Readiness

**Ready for Phase 02 Plan 03 (Worker Scheduler):**
- All three scrapers are functional and tested
- Idempotent upsert ensures safe re-scraping
- Error handling prevents partial failures from blocking progress
- maxResults caps prevent runaway API usage

**Blockers:**
- GITHUB_TOKEN required before production scraping (Jet must provision)
- HUGGINGFACE_TOKEN optional but recommended for higher rate limits

**Database:**
- Catalog database schema in place from Phase 01
- Normalizers tested and working from Phase 02-01
- upsertBySourceUrl handles deduplication correctly

---
*Phase: 02-scraping-pipeline*
*Completed: 2026-02-19*

## Self-Check: PASSED

All files created and commits verified:

**Files:**
- ✓ src/scrapers/github-scraper.ts (2769 bytes)
- ✓ src/scrapers/npm-scraper.ts (3024 bytes)
- ✓ src/scrapers/huggingface-scraper.ts (7397 bytes)
- ✓ p1/.env.example (430 bytes)

**Commits:**
- ✓ 13bddfe (GitHub scraper)
- ✓ 6bf08e6 (npm scraper)
- ✓ aff51b2 (HuggingFace scraper)

**Tests:** All 22 tests passing (no regressions)
**TypeScript:** Zero compilation errors
