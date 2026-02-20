---
phase: quick-3
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/db/schema.ts
  - src/db/migrate.ts
  - src/scrapers/producthunt-scraper.ts
  - src/scrapers/normalizers/producthunt-normalizer.ts
  - src/scrapers/github-trending-scraper.ts
  - src/scrapers/normalizers/github-trending-normalizer.ts
  - src/scripts/compute-hype-scores.ts
  - src/scripts/run-all-scrapers.ts
  - src/services/search.ts
  - src/app/page.tsx
  - src/components/listing-card.tsx
  - src/workers/scrape-worker.ts
  - src/jobs/schedule-scrapes.ts
  - package.json
autonomous: true
must_haves:
  truths:
    - "Homepage shows a Trending / Hot Right Now section with top 6 tools by hype score"
    - "Tool cards display a hype score badge (flame icon + score) when hype_score > 0"
    - "Running a single command scrapes all sources (GitHub, npm, HuggingFace, Product Hunt, GitHub Trending)"
    - "Hype scores are computed from available signals and stored on each listing"
    - "New tools from scraping appear in New This Week automatically"
  artifacts:
    - path: "src/db/schema.ts"
      provides: "hypeScore and hypeUpdatedAt columns on listings"
      contains: "hypeScore"
    - path: "src/scrapers/producthunt-scraper.ts"
      provides: "Product Hunt scraper fetching AI/dev tool posts"
    - path: "src/scrapers/github-trending-scraper.ts"
      provides: "GitHub Trending scraper via HTML parsing"
    - path: "src/scripts/compute-hype-scores.ts"
      provides: "Hype score computation algorithm (0-100)"
    - path: "src/scripts/run-all-scrapers.ts"
      provides: "Single-command scraper orchestrator"
    - path: "src/services/search.ts"
      provides: "getTrendingListings query function"
    - path: "src/app/page.tsx"
      provides: "Trending section on homepage"
  key_links:
    - from: "src/scripts/compute-hype-scores.ts"
      to: "src/db/schema.ts"
      via: "UPDATE listings SET hype_score"
      pattern: "hype_score"
    - from: "src/app/page.tsx"
      to: "src/services/search.ts"
      via: "getTrendingListings()"
      pattern: "getTrendingListings"
    - from: "src/components/listing-card.tsx"
      to: "src/db/schema.ts"
      via: "listing.hypeScore display"
      pattern: "hypeScore"
---

<objective>
Upgrade the data pipeline with new scrapers (Product Hunt, GitHub Trending), add a hype score algorithm, and build a Trending section on the homepage.

Purpose: Enrich the catalog with more sources and surface the hottest tools prominently, driving engagement and making the homepage feel alive.

Output: 2 new scrapers, hype score computation script, run-all-scrapers command, Trending homepage section, hype badges on cards.

Key decision: Staying in TypeScript/Bun rather than introducing Crawl4AI (Python) — adding a Python dependency to a Bun/Next.js project creates unnecessary complexity. The existing scraper pattern is proven and extensible. Product Hunt has a GraphQL API. GitHub Trending can be scraped via HTML fetch + regex parsing.
</objective>

<execution_context>
@/Users/clawdioversace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/clawdioversace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@src/db/schema.ts
@src/db/migrate.ts
@src/services/catalog.ts
@src/services/search.ts
@src/scrapers/github-scraper.ts
@src/scrapers/huggingface-scraper.ts
@src/scrapers/npm-scraper.ts
@src/scrapers/normalizers/github-normalizer.ts
@src/workers/scrape-worker.ts
@src/jobs/schedule-scrapes.ts
@src/app/page.tsx
@src/components/listing-card.tsx
@src/lib/catalog-schema.ts
@src/lib/categories.ts
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Add hype_score columns + new scrapers (Product Hunt + GitHub Trending)</name>
  <files>
    src/db/schema.ts
    src/db/migrate.ts
    src/scrapers/producthunt-scraper.ts
    src/scrapers/normalizers/producthunt-normalizer.ts
    src/scrapers/github-trending-scraper.ts
    src/scrapers/normalizers/github-trending-normalizer.ts
    src/lib/catalog-schema.ts
    src/scripts/run-all-scrapers.ts
    src/workers/scrape-worker.ts
    src/jobs/schedule-scrapes.ts
    package.json
  </files>
  <action>
**1. Schema changes (src/db/schema.ts):**
Add two new columns to the `listings` table definition:
- `hypeScore: integer('hype_score').default(0)` — Hype score 0-100
- `hypeUpdatedAt: integer('hype_updated_at', { mode: 'timestamp' })` — When hype was last computed

Update the Listing/NewListing types accordingly (they auto-infer).

**2. Migration (src/db/migrate.ts):**
Add two ALTER TABLE statements in the `main()` function, AFTER the starter pack tables block, using the same try/catch pattern as the upvotes migration in `runRemoteMigrations()`. Also add these to `runRemoteMigrations()`:
```typescript
// Add hype_score columns
console.log('Adding hype score columns...');
try {
  await client.execute(`ALTER TABLE listings ADD COLUMN hype_score integer DEFAULT 0`);
} catch (e: any) {
  if (!e.message?.includes('duplicate column')) throw e;
}
try {
  await client.execute(`ALTER TABLE listings ADD COLUMN hype_updated_at integer`);
} catch (e: any) {
  if (!e.message?.includes('duplicate column')) throw e;
}
console.log('Hype score columns ready.');
```

**3. CatalogEntrySchema (src/lib/catalog-schema.ts):**
Do NOT add hypeScore to CatalogEntrySchema — hype is computed post-ingest, not provided by scrapers. Leave the schema unchanged.

**4. Product Hunt scraper (src/scrapers/producthunt-scraper.ts + normalizers/producthunt-normalizer.ts):**

Product Hunt's official GraphQL API requires an API token. Instead, scrape their front page / topic pages via simple HTML fetch. Product Hunt renders server-side and includes structured data.

**producthunt-normalizer.ts:**
- Create a normalizer that takes a Product Hunt post object (name, tagline, url, votesCount, topics) and returns CatalogEntryInput
- Map topics to categories using the same priority logic as github-normalizer (AI/ML topics -> ai-agent, web3 topics -> web3-tool, dev tools -> developer-tool, default -> saas-tool)
- Set `stars` to votesCount (reuse the social proof field)
- Set `submittedBy` to 'producthunt-scraper'
- Create slug from name via createSlug()

**producthunt-scraper.ts:**
- Fetch `https://www.producthunt.com/topics/artificial-intelligence` and `https://www.producthunt.com/topics/developer-tools` using fetchWithRetry
- Parse the HTML response to extract post data. Product Hunt pages include `<script>` tags with `__NEXT_DATA__` JSON containing post arrays. Extract this JSON using regex: `/__NEXT_DATA__.*?<\/script>/` and parse it
- If __NEXT_DATA__ parsing fails (PH may change their format), fall back to a simpler regex approach: find all links matching `/posts/` pattern and extract post names from the HTML
- For each post found, normalize via producthunt-normalizer and upsertBySourceUrl
- Export `scrapeProductHunt(maxResults = 100)` matching the same signature pattern as other scrapers
- Log progress: `[producthunt-scraper] {processed} processed, {errors} errors`
- Important: Product Hunt may return 403 or block scrapers. Wrap the entire function in try/catch and return {processed: 0, errors: 0} on fatal errors (non-blocking — don't crash the run-all pipeline)

**5. GitHub Trending scraper (src/scrapers/github-trending-scraper.ts + normalizers/github-trending-normalizer.ts):**

GitHub Trending has no API but the HTML page is simple and stable.

**github-trending-normalizer.ts:**
- Takes an object `{ repoFullName, description, language, stars, starsToday, url }` and returns CatalogEntryInput
- Reuse the same `categorizeFromTopics` logic from github-normalizer — but since trending doesn't have topics, categorize based on language and description keywords instead:
  - If description contains 'mcp' or 'model context protocol' -> mcp-server
  - If description contains 'agent', 'llm', 'gpt', 'claude' -> ai-agent
  - If description contains 'web3', 'blockchain', 'ethereum', 'solana' -> web3-tool
  - If description contains 'defi', 'swap', 'yield' -> defi-tool
  - If language is 'Dockerfile' or description mentions 'infra', 'k8s', 'docker' -> infra
  - Default -> framework
- Set `submittedBy` to 'github-trending-scraper'

**github-trending-scraper.ts:**
- Fetch `https://github.com/trending?since=weekly` and `https://github.com/trending?since=daily` using fetchWithRetry
- Parse HTML to extract repo data. GitHub trending uses article elements with class `Box-row`. For each row, extract:
  - repoFullName from `h2 > a` href (e.g. "/owner/repo" -> "owner/repo")
  - description from `p` text
  - language from `[itemprop="programmingLanguage"]` text
  - stars from the stargazer count link
  - starsToday from the "stars today/this week" span
  - url: `https://github.com/${repoFullName}`
- Use simple regex patterns (NOT a DOM parser — avoid adding dependencies):
  - Repo: `/class="Box-row"[\s\S]*?<h2[\s\S]*?<a href="\/([\w-]+\/[\w.-]+)"/g`
  - Or more robustly, split the HTML on `Box-row` class markers and parse each chunk
- For each repo, normalize and upsertBySourceUrl
- Export `scrapeGitHubTrending(maxResults = 50)` with same pattern
- Non-blocking on errors (same as PH scraper)

**6. Run-all-scrapers script (src/scripts/run-all-scrapers.ts):**
- Create a script that runs ALL scrapers sequentially (not via bunqueue — direct function calls):
  ```
  1. scrapeGitHub for topics: mcp-server, ai-agent, model-context-protocol, web3, defi
  2. scrapeNpm for keywords: mcp, ai-agent, web3, agent-framework, defi
  3. scrapeHuggingFace for tags: agent, web3, mcp
  4. scrapeGitHubTrending(50)
  5. scrapeProductHunt(100)
  ```
- Log timing and totals for each source
- Log grand total at the end
- Callable via: `TURSO_DATABASE_URL=file:./dev.db bun src/scripts/run-all-scrapers.ts`

**7. Add package.json scripts:**
- `"scrape:all": "TURSO_DATABASE_URL=file:./dev.db bun src/scripts/run-all-scrapers.ts"`
- `"scrape:all:prod": "bun src/scripts/run-all-scrapers.ts"`
- `"hype:compute": "TURSO_DATABASE_URL=file:./dev.db bun src/scripts/compute-hype-scores.ts"`
- `"hype:compute:prod": "bun src/scripts/compute-hype-scores.ts"`

**8. Update workers and scheduler:**
- In `src/workers/scrape-worker.ts`: Add workers for `scrape-github-trending` and `scrape-producthunt` queues with concurrency: 1 each
- In `src/jobs/schedule-scrapes.ts`: Add GitHub Trending (daily at 2:30 AM UTC) and Product Hunt (daily at 4:30 AM UTC) to the scheduled jobs

**IMPORTANT:** Do NOT use any Python, Crawl4AI, or external scraping libraries. Everything stays in TypeScript with the existing fetchWithRetry utility. The HTML parsing is simple regex — no cheerio, jsdom, or other DOM parser dependencies needed.
  </action>
  <verify>
    - `bun run db:migrate` succeeds without errors (hype columns added)
    - `bun build src/scrapers/producthunt-scraper.ts --no-bundle` compiles without type errors
    - `bun build src/scrapers/github-trending-scraper.ts --no-bundle` compiles without type errors
    - `bun build src/scripts/run-all-scrapers.ts --no-bundle` compiles without type errors
    - `bun run build` (Next.js build) still succeeds
  </verify>
  <done>
    - listings table has hype_score and hype_updated_at columns
    - Product Hunt scraper exists and follows the normalizer pattern
    - GitHub Trending scraper exists and follows the normalizer pattern
    - run-all-scrapers.ts can orchestrate all 5 scraper sources
    - Workers and scheduler updated for new scraper types
    - `bun run scrape:all` command available in package.json
  </done>
</task>

<task type="auto">
  <name>Task 2: Hype score algorithm + Trending homepage section + card badges</name>
  <files>
    src/scripts/compute-hype-scores.ts
    src/services/search.ts
    src/app/page.tsx
    src/components/listing-card.tsx
  </files>
  <action>
**1. Hype score computation (src/scripts/compute-hype-scores.ts):**

Create a standalone script that computes hype scores for all listings.

Algorithm (0-100 scale):
```
hype_score = round(
  stars_score * 0.30 +
  downloads_score * 0.25 +
  recency_score * 0.25 +
  upvotes_score * 0.20
)
```

Why these weights differ from the spec: The spec assumes social_mentions_7d and producthunt_upvotes as separate signals, but we don't have dedicated fields for those. Stars already captures Product Hunt votes (stored in stars field by PH normalizer), and upvotes captures community signal. We redistribute weight to signals we actually have.

**Scoring functions (each returns 0-100):**

- `stars_score`: Logarithmic scale. `min(100, (log10(stars + 1) / log10(100000)) * 100)`. This gives: 0 stars=0, 10 stars=20, 100 stars=40, 1000 stars=60, 10000 stars=80, 100000=100.

- `downloads_score`: Logarithmic scale. `min(100, (log10(downloads + 1) / log10(1000000)) * 100)`. Similar log curve but calibrated for download counts which tend to be higher.

- `recency_score`: Linear decay over 30 days. `max(0, 100 - (daysSinceUpdate * (100/30)))`. A listing updated today scores 100, 15 days ago scores 50, 30+ days ago scores 0. Use `updatedAt` timestamp (which gets refreshed on every scraper upsert).

- `upvotes_score`: Linear scale capped at 50. `min(100, upvotes * 2)`. 50 upvotes = max score.

**Implementation:**
- Query all non-dead listings: `SELECT id, stars, downloads, upvotes, updated_at FROM listings WHERE dead_link = 0`
- Compute hype_score for each
- Batch update using: `UPDATE listings SET hype_score = ?, hype_updated_at = ? WHERE id = ?`
- Use a transaction for the batch (wrap in BEGIN/COMMIT via client.execute)
- Log: total scored, average score, top 10 by score
- Make it runnable: `TURSO_DATABASE_URL=file:./dev.db bun src/scripts/compute-hype-scores.ts`

**2. Search service — getTrendingListings (src/services/search.ts):**

Add a new exported function:
```typescript
/**
 * Returns top listings by hype score for the Trending section.
 * Only returns listings with a non-zero hype score.
 * Dead links are always excluded.
 */
export async function getTrendingListings(limit = 6): Promise<Listing[]> {
  const result = await db.run(sql`
    SELECT *
    FROM listings
    WHERE dead_link = 0
    AND hype_score > 0
    ORDER BY hype_score DESC
    LIMIT ${limit}
  `);
  return result.rows as unknown as Listing[];
}
```

**3. Homepage Trending section (src/app/page.tsx):**

Add a "Hot Right Now" section between "Top Tools" and "New This Week". This section only renders if there are trending listings with hype scores > 0.

- Import `getTrendingListings` from search service
- Add to the Promise.all data fetch: `getTrendingListings(6)`
- Render section with a flame emoji-free heading: use text "Hot Right Now" with a small orange/red accent
- Use the same grid layout as other sections (3 cols on lg, 1 on mobile)
- Conditionally render: only show if `trendingListings.length > 0`

Structure:
```tsx
{trendingListings.length > 0 && (
  <section className="flex flex-col gap-6">
    <div className="flex items-center gap-2">
      <span className="text-2xl">🔥</span>
      <h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Hot Right Now
      </h2>
    </div>
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {trendingListings.map((listing) => (
        <ListingCard key={listing.id} listing={listing} />
      ))}
    </div>
  </section>
)}
```

Wait — the instructions say no emojis unless the user explicitly requests. The spec says "flame icon" though. Use an inline SVG flame icon instead of the emoji:
```tsx
<svg className="h-6 w-6 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
  <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5 .5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
</svg>
```

**4. ListingCard hype badge (src/components/listing-card.tsx):**

Add a hype score badge to the card when `listing.hypeScore > 0`. Place it in the top-right corner of the card as an absolute-positioned badge.

- Add `relative` to the card container (already has it via `group relative`)
- Add badge AFTER the Link element, positioned absolute top-right:
```tsx
{listing.hypeScore !== null && listing.hypeScore > 0 && (
  <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-orange-100 px-2 py-0.5 text-xs font-semibold text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
    <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 23c-3.5 0-7-2.5-7-7 0-3.5 2-6 4-8 .5-.5 1.5 0 1.5.5 0 2 1 3 2.5 4.5 .5-1.5 1-3 1-5 0-.5.5-1 1-.5 2 1.5 4 4 4 7.5 0 4.5-3.5 8-7 8z"/>
    </svg>
    {listing.hypeScore}
  </div>
)}
```

Note: The `hypeScore` field comes from the Drizzle schema `listings.$inferSelect` — since we added it to schema.ts in Task 1, the Listing type already includes it. The field may be null for listings that haven't been scored yet, so always check `> 0`.

**IMPORTANT:** The Listing type will automatically include `hypeScore` since it's inferred from the schema. However, raw SQL queries (like in search.ts) return all columns via `SELECT *` so the field will be present in the result set. No extra work needed for type compatibility.
  </action>
  <verify>
    - `bun run build` succeeds (Next.js build verifies all imports and types)
    - `bun build src/scripts/compute-hype-scores.ts --no-bundle` compiles without errors
    - After running `bun run db:migrate` then `bun run hype:compute`, the dev.db has non-zero hype_score values: `sqlite3 dev.db "SELECT COUNT(*) FROM listings WHERE hype_score > 0"`
    - `bun run dev` shows the homepage with:
      - "Hot Right Now" section (if hype scores were computed)
      - Hype badges on cards with scores > 0
  </verify>
  <done>
    - compute-hype-scores.ts implements the weighted algorithm and batch-updates all listings
    - getTrendingListings() returns top listings by hype_score
    - Homepage displays "Hot Right Now" section with flame icon heading and top 6 trending tools
    - ListingCard shows orange hype score badge (flame + number) in top-right corner when score > 0
    - Section gracefully hidden when no listings have hype scores
  </done>
</task>

</tasks>

<verification>
1. **Schema:** `sqlite3 dev.db ".schema listings"` shows `hype_score` and `hype_updated_at` columns
2. **Scrapers compile:** All new scraper files pass `bun build --no-bundle` without type errors
3. **Run-all works:** `bun run scrape:all` runs all 5 sources without crashing (some may return 0 results without API tokens — that's fine)
4. **Hype compute works:** `bun run hype:compute` updates listings with scores, logs top 10
5. **Build passes:** `bun run build` succeeds (no type errors, no import issues)
6. **Homepage renders:** `bun run dev` shows Hot Right Now section and hype badges on cards
</verification>

<success_criteria>
- 5 scraper sources available (GitHub, npm, HuggingFace, Product Hunt, GitHub Trending)
- Single `bun run scrape:all` command runs everything
- Hype scores computed and stored (0-100 scale)
- Homepage shows "Hot Right Now" section ordered by hype_score
- Tool cards display flame + score badge when hype > 0
- All existing functionality preserved (New This Week, Top Tools, search, browse)
- `bun run build` passes clean
</success_criteria>

<output>
After completion, create `.planning/quick/3-upgrade-data-pipeline-with-crawl4ai-scra/3-SUMMARY.md`
</output>
