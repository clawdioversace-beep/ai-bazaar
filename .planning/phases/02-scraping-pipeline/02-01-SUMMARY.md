---
phase: 02-scraping-pipeline
plan: 01
subsystem: scraping-foundation
tags: [tdd, http-client, data-normalization, pure-functions]

dependency_graph:
  requires: [01-catalog-foundation]
  provides: [fetch-with-retry, github-normalizer, npm-normalizer, huggingface-normalizer]
  affects: [scraper-workers]

tech_stack:
  added: []
  patterns: [tdd-red-green-refactor, zod-validation, exponential-backoff, jitter]

key_files:
  created:
    - src/lib/fetch-with-retry.ts
    - src/lib/__tests__/fetch-with-retry.test.ts
    - src/scrapers/normalizers/github-normalizer.ts
    - src/scrapers/normalizers/npm-normalizer.ts
    - src/scrapers/normalizers/huggingface-normalizer.ts
    - src/lib/__tests__/normalizers.test.ts
  modified: []

decisions:
  - slug: manual-abort-controller
    summary: Use manual AbortController + setTimeout for timeout instead of AbortSignal.timeout
    rationale: AbortSignal.timeout has known bugs in Bun (per Phase 2 research)
    alternatives: [AbortSignal.timeout, no timeout]
    impact: Ensures reliable request timeout across all Bun versions

  - slug: repository-url-preference
    summary: npm normalizer prefers repository URL over npm page URL for sourceUrl
    rationale: GitHub links are more stable and useful than npmjs.com package pages
    alternatives: [prefer npm URL, use both]
    impact: Better deduplication (GitHub URL canonical) and more useful links for users

  - slug: category-detection-priority
    summary: Each normalizer has its own category detection logic based on source-specific metadata
    rationale: Different sources provide different signals (GitHub topics, npm keywords, HF tags)
    alternatives: [unified category detection, manual categorization]
    impact: Automated category assignment with source-specific intelligence

  - slug: test-mock-any-type
    summary: Use 'as any' for fetch mock in tests instead of complex type assertions
    rationale: Standard test pattern; type safety not critical in test mocks
    alternatives: [implement full fetch interface, suppress errors]
    impact: Clean TypeScript compilation without runtime impact

metrics:
  duration_minutes: 5
  completed_at: "2026-02-19T03:04:39Z"
  tasks_completed: 2
  tests_added: 15
  files_created: 6
  commits: 5
  test_pass_rate: 100%
---

# Phase 02 Plan 01: Scraping Foundation - HTTP Retry + Normalizers Summary

**One-liner:** HTTP retry utility with exponential backoff and three source-specific normalizers (GitHub, npm, HuggingFace) built TDD-first as pure, testable functions.

## What Was Built

Built the foundational infrastructure that all scraper workers depend on:

1. **fetchWithRetry utility** - Production-grade HTTP client with:
   - Retry on 429 (rate limit) and 5xx (server errors)
   - Immediate passthrough on 4xx (non-429) client errors
   - Exponential backoff with jitter: `baseDelay * 2^(attempt-1) + random`
   - Retry-After header support on 429 responses
   - Manual AbortController timeout (Bun-compatible)
   - Configurable maxAttempts, baseDelay, maxDelay, timeout

2. **Three source-specific normalizers**:
   - **GitHub normalizer**: Transforms GitHub API repo objects → CatalogEntryInput
     - Category detection from topics (MCP, web3, DeFi, AI agent)
     - Language → runtime mapping (TypeScript/JS → node, Python, Rust, Go)
     - Homepage URL validation before setting docsUrl
     - mcpCompatible flag from topics

   - **npm normalizer**: Transforms npm package objects → CatalogEntryInput
     - Prefers repository URL over npm page URL (better deduplication)
     - Category detection from keywords
     - Runtime always 'node' (npm ecosystem)

   - **HuggingFace normalizer**: Transforms HF model/space objects → CatalogEntryInput
     - Generates sourceUrl as `https://huggingface.co/{id}`
     - Category from tags (agent, web3, MCP, fallback framework)
     - Maps likes → stars, downloads field direct

3. **Complete test coverage** (TDD RED-GREEN-REFACTOR):
   - 6 tests for fetchWithRetry (retry logic, status codes, backoff, Retry-After)
   - 9 tests for normalizers (3 per source: full fields, category detection, edge cases)
   - All normalizer tests validate output via `CatalogEntrySchema.parse()`
   - 15 new tests + 7 Phase 1 tests = 22 total, all passing

## Deviations from Plan

None - plan executed exactly as written.

TDD workflow followed strictly:
1. RED: Write failing tests, commit
2. GREEN: Implement to pass tests, commit
3. REFACTOR: Fix TypeScript type errors, commit

## Key Technical Decisions

**Manual AbortController for timeout** - Used `new AbortController() + setTimeout()` instead of `AbortSignal.timeout()` due to documented Bun timeout handling bugs. Ensures reliable request timeouts across all Bun versions.

**Repository URL preference in npm normalizer** - Prefer `links.repository` over `links.npm` for sourceUrl. GitHub URLs are canonical and enable better deduplication (same repo may have multiple npm packages).

**Source-specific category detection** - Each normalizer has its own logic:
- GitHub: topics → MCP, web3, DeFi, AI agent (default)
- npm: keywords → same priority order
- HuggingFace: tags → agent, web3, MCP, framework (default)

Different sources provide different metadata; source-specific logic maximizes accuracy.

**Zod schemas for input validation** - All normalizers define Zod schemas (`GitHubRepoSchema`, `NpmPackageSchema`, `HuggingFaceEntrySchema`) to validate raw API data before transformation. Catches malformed responses early.

## Testing Strategy

TDD RED-GREEN-REFACTOR cycle:

**fetchWithRetry tests:**
1. Successful response returns immediately without retry
2. 429 response triggers retry (mock 429 → 200)
3. 5xx response triggers retry (mock 503 → 200)
4. 4xx (non-429) response returns immediately (mock 404)
5. maxAttempts is respected (mock always-failing, verify count)
6. Retry-After header is respected (mock 429 with Retry-After: 1, verify delay)

**Normalizer tests (3 per source):**
- GitHub: full fields, MCP topic detection, null fallbacks
- npm: repository preference, MCP keyword, minimal fields
- HuggingFace: sourceUrl format, agent tag, defaults

All tests validate final output via `CatalogEntrySchema.parse()` to ensure catalog schema compatibility.

## Integration Points

**Provides to Phase 2 Plan 2 (Scraper Workers):**
- `fetchWithRetry` - HTTP client for all API calls
- `normalizeGitHubRepo` - GitHub search results → CatalogEntryInput
- `normalizeNpmPackage` - npm search results → CatalogEntryInput
- `normalizeHuggingFaceEntry` - HF model/space → CatalogEntryInput

**Depends on Phase 1 (Catalog Foundation):**
- `CatalogEntrySchema` - Validation contract for all normalized data
- `createSlug` - Slug generation from names
- `normalizeTag` - Tag normalization (applied by schema transform)
- `CATEGORIES` - Valid category enum

## Next Steps

Phase 2 Plan 2 (Scraper Workers) can now:
1. Use `fetchWithRetry` for all GitHub/npm/HF API calls
2. Pass raw API results through normalizers
3. Feed normalized data to `CatalogService.upsertBySourceUrl()`

No runtime dependencies needed yet (Octokit, bunqueue) - those come in Plan 2.

## Commits

1. `5912a0a` - test(02-scraping-pipeline): add failing tests for fetchWithRetry (RED)
2. `0687d8d` - feat(02-scraping-pipeline): implement fetchWithRetry with exponential backoff (GREEN)
3. `9d69377` - test(02-scraping-pipeline): add failing tests for 3 normalizers (RED)
4. `572ff7d` - feat(02-scraping-pipeline): implement 3 source normalizers (GREEN)
5. `3228db9` - refactor(02-scraping-pipeline): fix TypeScript errors in fetch mock (REFACTOR)

## Files Created

**Production code:**
- `src/lib/fetch-with-retry.ts` - 161 lines, HTTP retry utility
- `src/scrapers/normalizers/github-normalizer.ts` - 111 lines, GitHub normalizer
- `src/scrapers/normalizers/npm-normalizer.ts` - 89 lines, npm normalizer
- `src/scrapers/normalizers/huggingface-normalizer.ts` - 96 lines, HuggingFace normalizer

**Tests:**
- `src/lib/__tests__/fetch-with-retry.test.ts` - 133 lines, 6 tests
- `src/lib/__tests__/normalizers.test.ts` - 223 lines, 9 tests

**Total:** 813 lines of production code + tests

## Self-Check: PASSED

All files verified:
- ✓ src/lib/fetch-with-retry.ts
- ✓ src/lib/__tests__/fetch-with-retry.test.ts
- ✓ src/scrapers/normalizers/github-normalizer.ts
- ✓ src/scrapers/normalizers/npm-normalizer.ts
- ✓ src/scrapers/normalizers/huggingface-normalizer.ts
- ✓ src/lib/__tests__/normalizers.test.ts

All commits verified:
- ✓ 5912a0a - test(02-scraping-pipeline): add failing tests for fetchWithRetry
- ✓ 0687d8d - feat(02-scraping-pipeline): implement fetchWithRetry with exponential backoff
- ✓ 9d69377 - test(02-scraping-pipeline): add failing tests for 3 normalizers
- ✓ 572ff7d - feat(02-scraping-pipeline): implement 3 source normalizers
- ✓ 3228db9 - refactor(02-scraping-pipeline): fix TypeScript errors in fetch mock
