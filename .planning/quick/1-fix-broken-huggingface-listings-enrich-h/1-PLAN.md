---
phase: quick
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/scripts/enrich-huggingface.ts
  - src/scrapers/normalizers/huggingface-normalizer.ts
  - src/services/search.ts
  - src/app/page.tsx
  - package.json
autonomous: true
must_haves:
  truths:
    - "Homepage 'New This Week' section shows only listings with real names and descriptions (no hex IDs)"
    - "If fewer than 6 valid new-this-week items, section falls back to 'Recently Added' with valid recent listings"
    - "Running `bun run enrich-hf` resolves hex ID listings via HF API, updating DB with real metadata or marking them dead"
    - "Future HF scraper runs skip hex-only IDs and only ingest entries with owner/model format IDs"
  artifacts:
    - path: "src/scripts/enrich-huggingface.ts"
      provides: "CLI script to enrich hex ID HF listings via HF API"
      min_lines: 60
    - path: "src/scrapers/normalizers/huggingface-normalizer.ts"
      provides: "Hex ID detection and rejection in normalizer"
      contains: "isHexId"
    - path: "src/services/search.ts"
      provides: "Quality-filtered getNewThisWeek with fallback"
      contains: "getRecentlyAdded"
  key_links:
    - from: "src/scripts/enrich-huggingface.ts"
      to: "src/services/catalog.ts"
      via: "updateListing and markDeadLink"
      pattern: "(updateListing|markDeadLink)"
    - from: "src/app/page.tsx"
      to: "src/services/search.ts"
      via: "getNewThisWeek + getRecentlyAdded fallback"
      pattern: "getRecentlyAdded"
---

<objective>
Fix broken HuggingFace listings showing hex hash IDs as names. 600 of 3259 listings have raw hex IDs (e.g. `6939a361cf5d81d67a8fb9b2`) as name, slug, and sourceUrl because the HF SDK sometimes returns these instead of `owner/model` format IDs.

Purpose: Clean up the catalog so the homepage shows real tool names instead of garbage hex strings.
Output: Enrichment script, fixed normalizer, quality-filtered search queries.
</objective>

<execution_context>
@/Users/clawdioversace/.claude/get-shit-done/workflows/execute-plan.md
@/Users/clawdioversace/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@src/db/schema.ts
@src/db/client.ts
@src/services/catalog.ts
@src/services/search.ts
@src/scrapers/normalizers/huggingface-normalizer.ts
@src/scrapers/huggingface-scraper.ts
@src/app/page.tsx
@src/lib/fetch-with-retry.ts
@src/lib/catalog-schema.ts
@package.json
</context>

<tasks>

<task type="auto">
  <name>Task 1: Create enrichment script and fix HF normalizer</name>
  <files>src/scripts/enrich-huggingface.ts, src/scrapers/normalizers/huggingface-normalizer.ts, package.json</files>
  <action>
**1a. Add hex ID detection to huggingface-normalizer.ts:**

Add a helper function `isHexId(id: string): boolean` that returns true when the ID matches a pattern like 24-char hex string without a slash (i.e. NOT in `owner/model` format). Use regex: `/^[0-9a-f]{20,}$/i`.

Modify `normalizeHuggingFaceEntry()` to check `isHexId(validated.id)` BEFORE processing. If hex ID detected, throw an Error with message `"Skipping hex ID: ${validated.id}"`. This causes the scraper's existing try/catch to skip it and increment errors count, which is the correct behavior. Export `isHexId` for use by the enrichment script.

**1b. Create `src/scripts/enrich-huggingface.ts`:**

This script:
1. Queries all listings where `source_url LIKE 'https://huggingface.co/%'` AND the name looks like a hex ID (use the same `isHexId` function from the normalizer).
2. For each hex ID listing, tries to resolve it via HuggingFace API:
   - First try `https://huggingface.co/api/models/${hexId}` (using `fetchWithRetry` from `src/lib/fetch-with-retry.ts`)
   - If 404, try `https://huggingface.co/api/spaces/${hexId}`
   - If 404 on both, try `https://huggingface.co/api/datasets/${hexId}`
3. If resolved (200 response):
   - Extract: `id` (real owner/model ID), `modelId` or `id` for name, `description` or `cardData.description`, `tags`, `likes`, `downloads`
   - Call `updateListing(listing.id, { name, slug: createSlug(realId), tagline, description, sourceUrl: 'https://huggingface.co/' + realId, stars: likes, downloads, tags })` from catalog service
   - Use `createSlug` from `src/lib/catalog-schema.ts` for the slug
4. If ALL three API calls return 404: call `markDeadLink(listing.id, true)` from catalog service
5. Add 200ms delay between API calls to avoid rate limiting (simple `await new Promise(r => setTimeout(r, 200))`)
6. Log progress: `[enrich-hf] {current}/{total}: {hexId} -> {realId || 'DEAD'}`
7. At the end, log summary: `{enriched} enriched, {dead} marked dead, {errors} errors out of {total} total`

Import db, sql from drizzle. Import updateListing, markDeadLink from catalog service. Import fetchWithRetry. Import isHexId from normalizer. Import createSlug from catalog-schema.

Use `TURSO_DATABASE_URL` env var (Bun auto-loads .env). The script should be directly runnable: `bun src/scripts/enrich-huggingface.ts`.

**1c. Add package.json script:**

Add to scripts: `"enrich-hf": "TURSO_DATABASE_URL=file:./dev.db bun src/scripts/enrich-huggingface.ts"`
  </action>
  <verify>
Run `bun run enrich-hf` and confirm it starts processing hex ID listings. Let it run for at least 10 entries to verify enrichment or dead-marking works. Check a few enriched records in DB to confirm real names replaced hex IDs. Verify the normalizer rejects hex IDs by inspecting the code.
  </verify>
  <done>
Enrichment script exists at `src/scripts/enrich-huggingface.ts`, runnable via `bun run enrich-hf`. Normalizer has `isHexId` guard that prevents future hex IDs from being ingested. Script resolves hex IDs to real metadata or marks them dead.
  </done>
</task>

<task type="auto">
  <name>Task 2: Add quality filters to getNewThisWeek and add Recently Added fallback</name>
  <files>src/services/search.ts, src/app/page.tsx</files>
  <action>
**2a. Fix `getNewThisWeek()` in `src/services/search.ts`:**

Replace the current Drizzle relational query with a raw SQL query (using `sql` template tag like other functions in this file) that adds quality filters:
- `dead_link = 0` (already exists)
- `created_at >= ${sevenDaysAgoUnix}` (keep existing 7-day window — NOTE: timestamps are stored as Unix seconds, NOT Date objects. Use `Math.floor(Date.now() / 1000) - 7 * 24 * 60 * 60`)
- `name != ''` — name is not empty
- `name NOT GLOB '[0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f][0-9a-f]*'` — name is not a 20+ char hex string
- `LENGTH(description) >= 10` — description has meaningful content
- `description NOT LIKE 'HuggingFace model %'` — not a templated placeholder description
- ORDER BY `created_at DESC`, LIMIT param

Use `db.run(sql\`...\`)` and cast result like other functions: `return result.rows as unknown as Listing[]`.

**2b. Add `getRecentlyAdded()` function in `src/services/search.ts`:**

New exported async function `getRecentlyAdded(limit = 12): Promise<Listing[]>` that returns the most recent valid listings regardless of date, with the same quality filters as getNewThisWeek (minus the date constraint). This is the fallback when fewer than 6 items pass the new-this-week quality filters.

Use raw SQL with same quality filters minus the date check. Order by `created_at DESC`.

**2c. Update `src/app/page.tsx` to use fallback:**

Import `getRecentlyAdded` from search service.

After fetching `newListings` from `getNewThisWeek(12)`, add logic:
- If `newListings.length < 6`, fetch `recentListings` from `getRecentlyAdded(12)`
- Use a variable like `showRecent = newListings.length < 6`
- In the JSX, if `showRecent`:
  - Change section heading to "Recently Added" instead of "New This Week"
  - Render `recentListings` instead of `newListings`
- Else: keep current "New This Week" heading and render `newListings`

Keep the empty state fallback ("Check back soon for new tools!") for when BOTH are empty.
  </action>
  <verify>
Run `bun run build` to confirm no TypeScript/build errors. Start dev server with `bun run dev` and visit homepage — "New This Week" section should not show any hex ID listings. If there are fewer than 6 valid new items, section should show "Recently Added" with quality listings instead.
  </verify>
  <done>
`getNewThisWeek()` filters out hex ID names, empty descriptions, and placeholder descriptions. `getRecentlyAdded()` provides a fallback for sparse weeks. Homepage dynamically switches between "New This Week" and "Recently Added" based on available quality listings.
  </done>
</task>

</tasks>

<verification>
1. `bun run enrich-hf` runs without crashes, processes hex ID listings, and logs enrichment/dead results
2. `bun run build` succeeds with no errors
3. Homepage shows only real tool names (no hex strings) in the "New This Week" / "Recently Added" section
4. Running `bun run worker` (scraper) no longer ingests hex-only HF IDs
</verification>

<success_criteria>
- Zero hex ID strings visible on the homepage
- Enrichment script resolves or marks dead all 600 hex ID listings
- Future scraper runs skip hex IDs via normalizer guard
- Homepage gracefully falls back to "Recently Added" when fewer than 6 quality new items exist
</success_criteria>

<output>
After completion, create `.planning/quick/1-fix-broken-huggingface-listings-enrich-h/1-SUMMARY.md`
</output>
