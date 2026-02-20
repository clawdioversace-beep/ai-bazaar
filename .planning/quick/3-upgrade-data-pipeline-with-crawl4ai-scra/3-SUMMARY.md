---
phase: quick-3
plan: 01
subsystem: scraping-pipeline + frontend
tags: [scrapers, hype-score, trending, product-hunt, github-trending, homepage]
dependency_graph:
  requires: [src/db/schema.ts, src/services/catalog.ts, src/lib/fetch-with-retry.ts]
  provides: [hype_score column, scrapeProductHunt, scrapeGitHubTrending, computeHypeScores, getTrendingListings, Hot Right Now section]
  affects: [src/app/page.tsx, src/components/listing-card.tsx, src/db/schema.ts, src/services/search.ts]
tech_stack:
  added: []
  patterns: [HTML regex scraping (no DOM parser deps), logarithmic scoring scale, batch DB transactions via client.batch()]
key_files:
  created:
    - src/scrapers/producthunt-scraper.ts
    - src/scrapers/normalizers/producthunt-normalizer.ts
    - src/scrapers/github-trending-scraper.ts
    - src/scrapers/normalizers/github-trending-normalizer.ts
    - src/scripts/run-all-scrapers.ts
    - src/scripts/compute-hype-scores.ts
  modified:
    - src/db/schema.ts
    - src/db/migrate.ts
    - src/services/search.ts
    - src/app/page.tsx
    - src/components/listing-card.tsx
    - src/workers/scrape-worker.ts
    - src/jobs/schedule-scrapes.ts
    - package.json
decisions:
  - "Stay TypeScript/Bun — no Python/Crawl4AI dependency introduced"
  - "Product Hunt: parse __NEXT_DATA__ JSON with regex fallback (no cheerio/jsdom)"
  - "GitHub Trending: split HTML on article boundaries instead of multi-line regex"
  - "Hype score weights: stars 30%, downloads 25%, recency 25%, upvotes 20% (redistributed from spec since we lack social_mentions_7d)"
  - "Recency uses updatedAt (refreshed on every scraper upsert) not createdAt"
  - "batch() API used for hype score updates — single atomic transaction for 3200+ rows"
metrics:
  duration: 15 min
  completed: 2026-02-20
  tasks_completed: 2
  files_created: 6
  files_modified: 8
---

# Quick Task 3: Upgrade Data Pipeline — Summary

**One-liner:** Added Product Hunt + GitHub Trending scrapers with regex HTML parsing, hype score algorithm (0-100 weighted), Trending homepage section, and orange hype badges on listing cards.

## What Was Built

### Task 1: Schema + New Scrapers

**Database changes:**
- Added `hype_score INTEGER DEFAULT 0` and `hype_updated_at INTEGER` columns to `listings` table
- Migration uses `ALTER TABLE` with duplicate-column guard (same pattern as upvotes migration)
- Applies to both local SQLite and remote Turso via `runRemoteMigrations()`

**Product Hunt scraper (`src/scrapers/producthunt-scraper.ts`):**
- Fetches `/topics/artificial-intelligence` and `/topics/developer-tools`
- Parses `__NEXT_DATA__` JSON from Next.js script tag using regex
- Falls back to post link extraction (`/posts/*`) if JSON structure changes
- Non-blocking: returns `{processed: 0, errors: 0}` on fatal error
- Normalizer maps PH votes to `stars` field for social proof signal

**GitHub Trending scraper (`src/scrapers/github-trending-scraper.ts`):**
- Fetches `trending?since=daily` and `trending?since=weekly`
- Splits HTML on `<article class="Box-row">` boundaries, extracts per-chunk
- No external DOM parser dependencies (pure regex)
- Categorizes by description keywords since trending page has no topics
- Non-blocking on fatal errors

**Run-all-scrapers (`src/scripts/run-all-scrapers.ts`):**
- Orchestrates all 5 sources sequentially with timing logs
- Direct function calls (no worker queue dependency)
- Usage: `bun run scrape:all` (dev) or `bun run scrape:all:prod`

**Workers + Scheduler:**
- Added `scrape-github-trending` and `scrape-producthunt` workers (concurrency: 1)
- Scheduled: GitHub Trending at 2:30 AM UTC, Product Hunt at 4:30 AM UTC daily

### Task 2: Hype Score Algorithm + UI

**Compute hype scores (`src/scripts/compute-hype-scores.ts`):**

Algorithm (0-100):
```
hype_score = round(
  stars_score     * 0.30  — log10 scale, 100k stars = 100
  downloads_score * 0.25  — log10 scale, 1M downloads = 100
  recency_score   * 0.25  — linear decay: today=100, 30d ago=0
  upvotes_score   * 0.20  — linear: 50 upvotes = 100
)
```

- Queries all non-dead listings, computes scores, batch-updates via `client.batch()`
- Logs: total scored, average, top 10 by score
- Tested: scored 3,206 listings in 0.4s, average score 33, max 54

**getTrendingListings (`src/services/search.ts`):**
- Returns top listings by `hype_score DESC` where `hype_score > 0`
- Dead links excluded

**Homepage "Hot Right Now" section (`src/app/page.tsx`):**
- Fetched in same `Promise.all` as other homepage data
- Rendered between "Top Tools" and "New This Week"
- Uses inline SVG flame icon (no emoji, no external icon dependency)
- Conditionally rendered: hidden if no listings have hype scores

**Listing card hype badge (`src/components/listing-card.tsx`):**
- Orange rounded pill in top-right corner: `[flame icon] [score]`
- Shown only when `listing.hypeScore > 0`
- Dark mode compatible: `orange-100/orange-700` and `orange-900/30/orange-300`

## Verification Results

1. Schema: `hype_score` and `hype_updated_at` columns confirmed in `listings` table
2. Scrapers: all new files compile without type errors via `bun build --no-bundle`
3. Run-all: `bun run scrape:all` script available and compiles clean
4. Hype compute: `bun run hype:compute` scored 3,206 listings, logged top 10
5. Build: `bun run build` passes clean (no type errors, no import issues)
6. DB count: `SELECT COUNT(*) FROM listings WHERE hype_score > 0` returns 3206

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Key Design Decisions Made During Execution

1. **Category type casts removed** — `saas-tool` and `developer-tool` are valid `Category` enum members, no `as Category` cast needed. Fixed during implementation.

2. **Hype score batch update** — Used `client.batch()` API instead of manual BEGIN/COMMIT `client.execute()` blocks. Cleaner, atomic, and the libsql client supports it directly.

3. **Recency uses `updated_at` not `created_at`** — `updated_at` is refreshed on every scraper upsert, so it reflects how recently a tool was re-confirmed active. This makes the recency signal more useful for distinguishing freshly-scraped tools.

## Commits

| Hash | Description |
|------|-------------|
| `b1e5151` | feat(quick-3-01): add hype_score schema, Product Hunt + GitHub Trending scrapers |
| `b33e7ea` | feat(quick-3-02): hype score algorithm, Trending section, and hype badges on cards |

## Self-Check: PASSED
