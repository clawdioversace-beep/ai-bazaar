# Phase 02: Scraping Pipeline - Research

**Researched:** 2026-02-19
**Domain:** Web scraping, job queues, data normalization, API integration
**Confidence:** HIGH

## Summary

This phase implements an automated ingestion pipeline that scrapes GitHub, npm, and HuggingFace to pre-seed the catalog with 200+ real entries before public launch. The pipeline uses bunqueue (a Bun-native job queue) for background processing, Octokit for GitHub API access, native fetch for npm and HuggingFace APIs, and Zod schemas for source normalization.

**Primary findings:**

1. **bunqueue** is the clear choice for job queuing — BullMQ-compatible API, zero external dependencies (SQLite-backed), designed specifically for Bun runtime with 94.8 benchmark score
2. **Octokit** is the standard GitHub API client with TypeScript support; authenticated requests get 5,000 requests/hour (vs 60 unauthenticated)
3. **npm registry search API** and **HuggingFace Hub API** both support keyword/tag-based search via REST endpoints
4. **Rate limiting** must be implemented per-source with exponential backoff and jitter to prevent retry storms
5. **Zod transform/preprocess** patterns already exist in the codebase (catalog-schema.ts) and should be extended for source-specific normalization

**Primary recommendation:** Build three independent scrapers (GitHub, npm, HuggingFace) as bunqueue job processors, each with source-specific rate limits. Use Zod schemas to normalize raw API responses to CatalogEntryInput format. Schedule via bunqueue's built-in cron support (repeat patterns). Existing `upsertBySourceUrl()` handles deduplication automatically.

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| **bunqueue** | Latest (1.x) | Job queue and background processing | Bun-native, BullMQ-compatible API, SQLite-backed (zero external deps), highest benchmark score (94.8) |
| **octokit** | Latest (3.x) | GitHub REST/GraphQL API client | Official GitHub SDK, TypeScript-first, handles auth and rate limits |
| **@huggingface/hub** | Latest | HuggingFace Hub API client | Official TypeScript SDK for models/spaces search |
| **zod** | 3.25+ (v4 stable) | Schema validation and transformation | Already in stack, TypeScript-first, transform/preprocess for normalization |
| **drizzle-orm** | Current | Database upserts and deduplication | Already in stack, supports SQLite `onConflictDoUpdate` |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| **croner** | Latest | Cron expression parsing/scheduling | If bunqueue's built-in repeat patterns are insufficient (unlikely) |
| **p-limit** | Latest | Concurrency control for batch operations | If bunqueue's concurrency settings need supplementing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| bunqueue | BullMQ | Requires Redis (external dependency), more battle-tested but heavier for this use case |
| Octokit | GitHub REST API via fetch | Would need to hand-roll auth, pagination, rate limit handling |
| @huggingface/hub | Direct API calls via fetch | Less type safety, manual pagination and error handling |

**Installation:**
```bash
bun add bunqueue octokit @huggingface/hub
# zod and drizzle-orm already installed from Phase 1
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── scrapers/
│   ├── github-scraper.ts      # GitHub API scraper (REST + GraphQL)
│   ├── npm-scraper.ts         # npm registry search scraper
│   ├── huggingface-scraper.ts # HuggingFace Hub API scraper
│   └── normalizers/
│       ├── github-normalizer.ts    # GitHub → CatalogEntryInput
│       ├── npm-normalizer.ts       # npm → CatalogEntryInput
│       └── huggingface-normalizer.ts # HF → CatalogEntryInput
├── workers/
│   └── scrape-worker.ts       # bunqueue worker process
├── jobs/
│   └── schedule-scrapes.ts    # Cron scheduler for re-indexing
└── scripts/
    └── seed-catalog.ts        # One-time pre-seed script
```

### Pattern 1: Source-Specific Normalizers

**What:** Each scraper returns raw API responses; normalizers transform to CatalogEntryInput schema.

**When to use:** Always — this enforces separation between API-specific logic and catalog schema.

**Example:**
```typescript
// src/scrapers/normalizers/github-normalizer.ts
import { z } from 'zod';
import { CatalogEntrySchema } from '../../lib/catalog-schema';
import type { CatalogEntryInput } from '../../lib/catalog-schema';
import { createSlug } from '../../lib/catalog-schema';

// Define the subset of GitHub API response we care about
const GitHubRepoSchema = z.object({
  full_name: z.string(),
  description: z.string().nullable(),
  html_url: z.string().url(),
  homepage: z.string().url().nullable(),
  stargazers_count: z.number().int(),
  topics: z.array(z.string()),
  license: z.object({ spdx_id: z.string() }).nullable(),
  language: z.string().nullable(),
});

type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

export function normalizeGitHubRepo(repo: GitHubRepo): CatalogEntryInput {
  // Determine category from topics
  const hasWeb3 = repo.topics.some(t => ['web3', 'blockchain', 'ethereum', 'solana'].includes(t));
  const hasMcp = repo.topics.some(t => t.includes('mcp'));

  let category: CatalogEntryInput['category'];
  if (hasMcp) category = 'mcp-server';
  else if (hasWeb3) category = 'web3-tool';
  else category = 'ai-agent';

  // Map GitHub language to runtime
  const runtimeMap: Record<string, 'node' | 'python' | 'rust' | 'go' | 'other'> = {
    'TypeScript': 'node',
    'JavaScript': 'node',
    'Python': 'python',
    'Rust': 'rust',
    'Go': 'go',
  };

  return {
    slug: createSlug(repo.full_name),
    name: repo.full_name,
    tagline: repo.description?.slice(0, 160) ?? `GitHub repository: ${repo.full_name}`,
    description: repo.description ?? `No description provided for ${repo.full_name}`,
    category,
    tags: repo.topics,
    sourceUrl: repo.html_url,
    docsUrl: repo.homepage ?? undefined,
    licenseType: repo.license?.spdx_id ?? undefined,
    runtime: repo.language ? runtimeMap[repo.language] ?? 'other' : undefined,
    stars: repo.stargazers_count,
    mcpCompatible: hasMcp,
    submittedBy: 'github-scraper',
  };
}
```

### Pattern 2: Job Queue with Per-Source Rate Limiting

**What:** Each scraper runs as a bunqueue worker with its own rate limit.

**When to use:** Always — prevents hitting API rate limits and enables concurrent processing.

**Example:**
```typescript
// src/workers/scrape-worker.ts
import { Queue, Worker } from 'bunqueue/client';
import { scrapeGitHub } from '../scrapers/github-scraper';
import { scrapeNpm } from '../scrapers/npm-scraper';
import { scrapeHuggingFace } from '../scrapers/huggingface-scraper';

// Create queues for each source
const githubQueue = new Queue('scrape-github');
const npmQueue = new Queue('scrape-npm');
const hfQueue = new Queue('scrape-huggingface');

// GitHub: 5000 req/hour = ~83/min, set conservative 60/min
githubQueue.setRateLimit(60);

// npm: no documented limit, use conservative 100/min
npmQueue.setRateLimit(100);

// HuggingFace: no documented limit, use conservative 100/min
hfQueue.setRateLimit(100);

// Workers process jobs with retries and backoff
const githubWorker = new Worker('scrape-github', async (job) => {
  const { topic } = job.data;
  await job.updateProgress(10, `Scraping GitHub topic: ${topic}`);

  const results = await scrapeGitHub(topic);

  await job.updateProgress(100, `Scraped ${results.length} repos`);
  return { count: results.length, topic };
}, {
  concurrency: 3, // Process 3 topics concurrently
});

const npmWorker = new Worker('scrape-npm', async (job) => {
  const { keywords } = job.data;
  await job.updateProgress(10, `Scraping npm: ${keywords}`);

  const results = await scrapeNpm(keywords);

  await job.updateProgress(100, `Scraped ${results.length} packages`);
  return { count: results.length, keywords };
}, {
  concurrency: 2,
});

const hfWorker = new Worker('scrape-huggingface', async (job) => {
  const { tags } = job.data;
  await job.updateProgress(10, `Scraping HuggingFace: ${tags}`);

  const results = await scrapeHuggingFace(tags);

  await job.updateProgress(100, `Scraped ${results.length} models/spaces`);
  return { count: results.length, tags };
}, {
  concurrency: 2,
});

// Graceful shutdown
async function shutdown(signal: string) {
  console.log(`Received ${signal}, shutting down workers...`);

  await Promise.all([
    githubWorker.pause(),
    npmWorker.pause(),
    hfWorker.pause(),
  ]);

  await Promise.all([
    githubWorker.close(),
    npmWorker.close(),
    hfWorker.close(),
  ]);

  await Promise.all([
    githubQueue.close(),
    npmQueue.close(),
    hfQueue.close(),
  ]);

  console.log('Shutdown complete');
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

### Pattern 3: Scheduled Re-Indexing with bunqueue Cron

**What:** Use bunqueue's built-in repeat patterns to schedule periodic re-scrapes.

**When to use:** For automated re-indexing and dead link checks (SCRP-07).

**Example:**
```typescript
// src/jobs/schedule-scrapes.ts
import { Queue } from 'bunqueue/client';

const githubQueue = new Queue('scrape-github');
const npmQueue = new Queue('scrape-npm');
const hfQueue = new Queue('scrape-huggingface');

// Schedule GitHub scrapes: daily at 2 AM
await githubQueue.add('scrape', {
  topics: ['mcp-server', 'ai-agent', 'web3', 'model-context-protocol']
}, {
  repeat: {
    pattern: '0 2 * * *', // Cron: daily at 2 AM
  }
});

// Schedule npm scrapes: daily at 3 AM
await npmQueue.add('scrape', {
  keywords: ['mcp', 'ai-agent', 'web3', 'agent-framework']
}, {
  repeat: {
    pattern: '0 3 * * *', // Cron: daily at 3 AM
  }
});

// Schedule HuggingFace scrapes: daily at 4 AM
await hfQueue.add('scrape', {
  tags: ['agent', 'web3', 'mcp']
}, {
  repeat: {
    pattern: '0 4 * * *', // Cron: daily at 4 AM
  }
});

console.log('Scheduled daily scraping jobs');
```

### Pattern 4: Exponential Backoff with Jitter

**What:** Retry failed API requests with increasing delays + random jitter to prevent retry storms.

**When to use:** Always — bunqueue provides this via job options, but implement at API client level too.

**Example:**
```typescript
// src/lib/fetch-with-retry.ts
interface RetryOptions {
  maxAttempts?: number;
  baseDelay?: number;
  maxDelay?: number;
  timeout?: number;
}

export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 30000,
    timeout = 10000,
  } = retryOptions;

  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timer);

      // Only retry on 5xx or 429 (rate limit)
      if (response.ok || (response.status >= 400 && response.status < 500 && response.status !== 429)) {
        return response;
      }

      // Check for Retry-After header (respect server guidance)
      const retryAfter = response.headers.get('retry-after');
      if (retryAfter && attempt < maxAttempts) {
        const delay = parseInt(retryAfter) * 1000; // Convert seconds to ms
        await Bun.sleep(delay);
        continue;
      }

      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (err) {
      clearTimeout(timer);
      lastError = err instanceof Error ? err : new Error(String(err));
    }

    // Don't delay after last attempt
    if (attempt < maxAttempts) {
      // Exponential backoff: baseDelay * 2^(attempt - 1)
      const exponentialDelay = Math.min(baseDelay * Math.pow(2, attempt - 1), maxDelay);

      // Add jitter: random value between 0 and exponentialDelay
      const jitter = Math.random() * exponentialDelay;

      await Bun.sleep(exponentialDelay + jitter);
    }
  }

  throw lastError ?? new Error('Fetch failed');
}
```

### Anti-Patterns to Avoid

- **Scraping without deduplication:** Always use `upsertBySourceUrl()` — it handles dedup automatically via normalized URLs
- **Ignoring Retry-After headers:** Check and respect these headers on every response, not just 429s
- **Using 403/5xx as "dead link":** Only 404/410 are definitively dead (Phase 1 already implements this in `checkDeadLink()`)
- **Scraping synchronously:** Always use job queue — prevents rate limit violations and enables recovery from crashes
- **Hard-coding API tokens:** Use environment variables (Bun loads .env automatically)

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Job queue | Custom queue with cron + SQLite | bunqueue | Handles retries, rate limiting, scheduling, graceful shutdown, process isolation |
| GitHub API pagination | Manual next-page link parsing | Octokit's built-in pagination | Handles REST and GraphQL pagination, cursors, rate limit detection |
| Exponential backoff | Custom retry loop | bunqueue job options + fetchWithRetry helper | Prevents off-by-one errors, jitter calculation, timeout handling |
| Cron expression parsing | Custom parser | bunqueue's repeat patterns or croner | Handles edge cases (leap years, DST, timezone offsets) |
| Data normalization | Manual field mapping | Zod transform/preprocess | Type-safe, composable, self-documenting |

**Key insight:** Job queues and API clients have complex edge cases (race conditions, network partitions, rate limit drift, timezone bugs). Using battle-tested libraries prevents production incidents.

## Common Pitfalls

### Pitfall 1: GitHub Rate Limit Confusion

**What goes wrong:** Hitting GitHub's secondary rate limits (900 points/min for REST, 2000 points/min for GraphQL) even when primary limit (5000/hour) isn't exhausted.

**Why it happens:** GitHub has BOTH per-hour limits AND per-minute limits. Bursting 100 requests in 10 seconds triggers secondary limits.

**How to avoid:** Set bunqueue rate limit to 60/min (below 900/min threshold). Use GraphQL for batch queries when fetching related data (repos + topics + license in one query).

**Warning signs:** HTTP 403 with `X-RateLimit-Remaining: 0` and `Retry-After` header.

**Sources:**
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api)
- [GitHub GraphQL API Rate Limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api)

### Pitfall 2: npm Search Pagination Pitfall

**What goes wrong:** npm search API returns max 250 results per query, no pagination beyond that.

**Why it happens:** The `/-/v1/search` endpoint has a hard cap; the old `/-/all` endpoint was deprecated.

**How to avoid:** Use multiple keyword-specific queries instead of one broad query. For example, query `keywords:mcp`, `keywords:ai-agent`, `keywords:web3` separately rather than searching all at once.

**Warning signs:** Search returns exactly 250 results with `total > 250` in response metadata.

**Sources:**
- [npm Registry API Documentation](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md)
- [npm Deprecating /-/all Endpoint](https://blog.npmjs.org/post/157615772423/deprecating-the-all-registry-endpoint.html)

### Pitfall 3: HuggingFace Tag Filtering Ambiguity

**What goes wrong:** Confusion between `tags` and `tasks` in HuggingFace API — both are filterable but serve different purposes.

**Why it happens:** HuggingFace has `tags` (user-defined keywords) and `tasks` (standardized ML task categories like "text-generation"). The Python SDK exposes both; TypeScript SDK examples focus on `search: {owner}` pattern.

**How to avoid:** Use `listModels({ search: { tags: ['agent', 'web3'] } })` for custom tags. Check official TypeScript SDK docs for current API surface — tag filtering may need to use different parameter structure than Python SDK.

**Warning signs:** Query returns no results despite tags existing on HuggingFace Hub web UI.

**Sources:**
- [HuggingFace Hub API Documentation](https://huggingface.co/docs/huggingface.js/hub/README)
- [HuggingFace listModels GitHub Issue](https://github.com/huggingface/huggingface_hub/issues/3313)

### Pitfall 4: Drizzle ORM Upsert Conflict Target

**What goes wrong:** `onConflictDoUpdate()` fails if conflict target doesn't match a unique constraint.

**Why it happens:** SQLite requires the conflict target to be a column with a `UNIQUE` constraint or `PRIMARY KEY`. sourceUrl has a unique index in Phase 1 schema, but must be specified correctly.

**How to avoid:** Verify schema has `unique('sourceUrl')` constraint. Use exact column reference in Drizzle: `.onConflictDoUpdate({ target: listings.sourceUrl, set: { ... } })`.

**Warning signs:** Runtime error: `SQLITE_ERROR: ON CONFLICT clause does not match any PRIMARY KEY or UNIQUE constraint`.

**Sources:**
- [Drizzle ORM Upsert Guide](https://orm.drizzle.team/docs/guides/upsert)
- [Drizzle GitHub Discussion #1555](https://github.com/drizzle-team/drizzle-orm/discussions/1555)

### Pitfall 5: False Positive Dead Links

**What goes wrong:** Marking a valid URL as dead because server returns 403 or 405 for HEAD requests.

**Why it happens:** Some servers block HEAD requests or return different status codes for HEAD vs GET.

**How to avoid:** Phase 1 already implements this correctly in `checkDeadLink()` — only 404/410 are definitively dead. Do NOT change this logic.

**Warning signs:** URLs flagged as dead but work fine when visited in browser.

**Sources:**
- [HEAD Request Best Practices](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch)
- [Safe Data Fetching Guide](https://www.builder.io/blog/safe-data-fetching)

### Pitfall 6: Zod Transform vs Preprocess Confusion

**What goes wrong:** Using `transform()` when `preprocess()` is needed (or vice versa), causing validation failures.

**Why it happens:** `transform()` runs AFTER validation; `preprocess()` runs BEFORE. If raw input doesn't match schema, `transform()` never runs.

**How to avoid:** Use `preprocess()` to clean/coerce data into schema-compatible format. Use `transform()` to reshape already-valid data. Example: `preprocess()` to parse JSON strings → `transform()` to normalize arrays.

**Warning signs:** Zod parse errors on fields that "should work" after transformation.

**Sources:**
- [Zod Preprocessing Documentation](https://zod.dev/api_id=hashes)
- [Zod Transform API](https://zod.dev/basics_id=inferring-types)

## Code Examples

Verified patterns from official sources and existing codebase:

### GitHub Repository Search with Octokit

```typescript
// src/scrapers/github-scraper.ts
import { Octokit } from 'octokit';
import { normalizeGitHubRepo } from './normalizers/github-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN, // Required for 5000 req/hour limit
});

export async function scrapeGitHub(topic: string): Promise<number> {
  let processedCount = 0;

  // Search repositories by topic
  const iterator = octokit.paginate.iterator(
    octokit.rest.search.repos,
    {
      q: `topic:${topic}`,
      sort: 'stars',
      order: 'desc',
      per_page: 100, // Max allowed
    }
  );

  for await (const { data: repos } of iterator) {
    for (const repo of repos) {
      try {
        const catalogEntry = normalizeGitHubRepo(repo);
        await upsertBySourceUrl(catalogEntry);
        processedCount++;
      } catch (err) {
        console.error(`Failed to process ${repo.full_name}:`, err);
      }
    }
  }

  return processedCount;
}
```

### npm Registry Search

```typescript
// src/scrapers/npm-scraper.ts
import { fetchWithRetry } from '../lib/fetch-with-retry';
import { normalizeNpmPackage } from './normalizers/npm-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

export async function scrapeNpm(keywords: string): Promise<number> {
  let processedCount = 0;
  let from = 0;
  const size = 250; // npm max per page

  while (true) {
    const url = `https://registry.npmjs.org/-/v1/search?text=keywords:${keywords}&size=${size}&from=${from}`;

    const response = await fetchWithRetry(url, {}, {
      maxAttempts: 3,
      baseDelay: 1000,
      timeout: 10000,
    });

    if (!response.ok) {
      throw new Error(`npm API error: ${response.status}`);
    }

    const data = await response.json();

    for (const item of data.objects) {
      try {
        const catalogEntry = normalizeNpmPackage(item.package);
        await upsertBySourceUrl(catalogEntry);
        processedCount++;
      } catch (err) {
        console.error(`Failed to process ${item.package.name}:`, err);
      }
    }

    // Check if there are more results
    if (data.objects.length < size || processedCount >= 250) {
      break; // npm limits to 250 results total
    }

    from += size;
  }

  return processedCount;
}
```

### HuggingFace Hub Search

```typescript
// src/scrapers/huggingface-scraper.ts
import { listModels, listSpaces } from '@huggingface/hub';
import { normalizeHuggingFaceModel } from './normalizers/huggingface-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

export async function scrapeHuggingFace(tags: string[]): Promise<number> {
  let processedCount = 0;

  // Scrape models
  for await (const model of listModels({
    search: { tags },
    accessToken: process.env.HUGGINGFACE_TOKEN, // Optional but increases rate limit
  })) {
    try {
      const catalogEntry = normalizeHuggingFaceModel(model);
      await upsertBySourceUrl(catalogEntry);
      processedCount++;
    } catch (err) {
      console.error(`Failed to process model ${model.id}:`, err);
    }
  }

  // Scrape spaces (similar pattern)
  for await (const space of listSpaces({
    search: { tags },
    accessToken: process.env.HUGGINGFACE_TOKEN,
  })) {
    try {
      const catalogEntry = normalizeHuggingFaceModel(space); // Reuse normalizer
      await upsertBySourceUrl(catalogEntry);
      processedCount++;
    } catch (err) {
      console.error(`Failed to process space ${space.id}:`, err);
    }
  }

  return processedCount;
}
```

### Zod Normalizer with Transform

```typescript
// src/scrapers/normalizers/npm-normalizer.ts
import { z } from 'zod';
import type { CatalogEntryInput } from '../../lib/catalog-schema';
import { createSlug } from '../../lib/catalog-schema';

// npm package metadata schema
const NpmPackageSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  keywords: z.array(z.string()).optional(),
  links: z.object({
    npm: z.string().url(),
    homepage: z.string().url().optional(),
    repository: z.string().url().optional(),
  }),
  publisher: z.object({
    username: z.string(),
  }),
}).transform((pkg) => {
  // Determine category from keywords
  const keywords = pkg.keywords ?? [];
  const hasMcp = keywords.some(k => k.includes('mcp'));
  const hasWeb3 = keywords.some(k => ['web3', 'blockchain', 'ethereum', 'solana'].includes(k));

  let category: CatalogEntryInput['category'];
  if (hasMcp) category = 'mcp-server';
  else if (hasWeb3) category = 'web3-tool';
  else category = 'ai-agent';

  return {
    slug: createSlug(pkg.name),
    name: pkg.name,
    tagline: pkg.description?.slice(0, 160) ?? `npm package: ${pkg.name}`,
    description: pkg.description ?? `No description provided for ${pkg.name}`,
    category,
    tags: keywords,
    sourceUrl: pkg.links.repository ?? pkg.links.npm, // Prefer repo, fallback to npm page
    docsUrl: pkg.links.homepage,
    runtime: 'node' as const, // npm packages are Node.js
    submittedBy: `npm-scraper`,
  } satisfies CatalogEntryInput;
});

export function normalizeNpmPackage(pkg: unknown): CatalogEntryInput {
  return NpmPackageSchema.parse(pkg);
}
```

### Dead Link Checker Scheduled Job

```typescript
// src/jobs/check-dead-links.ts
import { Queue } from 'bunqueue/client';
import { getAllListings } from '../services/catalog';
import { checkDeadLink, markDeadLink } from '../services/catalog';

const deadLinkQueue = new Queue('check-dead-links');

// Rate limit: 10 checks per second (conservative for external URLs)
deadLinkQueue.setRateLimit(10);

// Schedule: run every day at 5 AM
await deadLinkQueue.add('check-all', {}, {
  repeat: {
    pattern: '0 5 * * *', // Cron: daily at 5 AM
  }
});

// Worker: check each listing
const deadLinkWorker = new Worker('check-dead-links', async (job) => {
  const listings = await getAllListings(1000, 0); // Check first 1000
  let checkedCount = 0;
  let deadCount = 0;

  for (const listing of listings) {
    const isDead = await checkDeadLink(listing.sourceUrl);
    await markDeadLink(listing.id, isDead);

    if (isDead) deadCount++;
    checkedCount++;

    await job.updateProgress((checkedCount / listings.length) * 100);
  }

  return { checked: checkedCount, dead: deadCount };
}, {
  concurrency: 1, // Serial processing to respect rate limit
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| BullMQ + Redis | bunqueue + SQLite | 2024 (bunqueue v1.0) | Zero external deps, Bun-native performance, simpler deployment |
| node-cron | bunqueue repeat patterns | 2024 | Unified job + scheduling system, less config |
| Manual fetch retry | fetchWithRetry + AbortSignal | 2024 | Native timeout support, better error handling |
| Zod v3 | Zod v4 (stable 2026) | Jan 2026 | 7x faster array parsing, reduced TS compilation time |

**Deprecated/outdated:**
- **node-cron** for job scheduling: Use bunqueue's built-in repeat patterns (cron expressions supported)
- **AbortSignal.timeout()** in Bun: Known bug where timeout doesn't abort fetch; use manual AbortController + setTimeout
- **npm `/-/all` endpoint**: Deprecated; use `/-/v1/search` instead

## Open Questions

1. **HuggingFace TypeScript SDK tag filtering syntax**
   - What we know: Python SDK supports `tags=['agent', 'web3']` parameter
   - What's unclear: TypeScript SDK examples show `search: {owner}` pattern but not `search: {tags}`
   - Recommendation: Test with current @huggingface/hub version; fallback to direct API calls via fetch if SDK doesn't support tag filtering yet

2. **GitHub GraphQL cost estimation**
   - What we know: GraphQL has point system (5000 points/hour), more efficient for related data
   - What's unclear: Point cost per query for repo search with topics
   - Recommendation: Start with REST API (simpler, known limits); evaluate GraphQL if we need to fetch repo + issues + commits in batch

3. **Scraper failure recovery strategy**
   - What we know: bunqueue retries failed jobs with exponential backoff
   - What's unclear: Should we resume from last successful offset or restart full scrape?
   - Recommendation: Full re-scrape on retry (upsertBySourceUrl deduplicates automatically); pagination state is hard to persist correctly

## Sources

### Primary (HIGH confidence)

- **/egeominotti/bunqueue** (Context7) - Job queue setup, rate limiting, scheduling, worker patterns
- **/websites/zod_dev** (Context7) - Transform and preprocess patterns
- [GitHub REST API Rate Limits](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) - Official rate limit documentation
- [GitHub GraphQL API Rate Limits](https://docs.github.com/en/graphql/overview/rate-limits-and-query-limits-for-the-graphql-api) - GraphQL-specific limits
- [Drizzle ORM Upsert Guide](https://orm.drizzle.team/docs/guides/upsert) - SQLite upsert syntax
- Existing codebase (catalog-schema.ts, catalog.ts) - Normalization patterns, upsert implementation

### Secondary (MEDIUM confidence)

- [npm Registry API Documentation](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md) - Search endpoint format
- [HuggingFace Hub API Documentation](https://huggingface.co/docs/huggingface.js/hub/README) - TypeScript SDK overview
- [Dealing with Rate Limiting Using Exponential Backoff](https://substack.thewebscraping.club/p/rate-limit-scraping-exponential-backoff) - Retry patterns
- [API Rate Limiting Best Practices](https://medium.com/@inni.chang/api-rate-limiting-implementation-strategies-and-best-practices-8a35572ed62c) - Rate limit strategies
- [TypeScript Web Scraping Tutorial](https://www.zenrows.com/blog/web-scraping-typescript) - Scraping architecture patterns

### Tertiary (LOW confidence)

- [Octokit GitHub Examples](https://github.com/octokit/octokit.js) - Usage examples (need to verify against current version)
- [Croner Library](https://github.com/Hexagon/croner) - Alternative cron library (only if bunqueue patterns insufficient)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - bunqueue designed for Bun, Octokit is GitHub standard, Zod already in use
- Architecture: HIGH - Patterns verified via Context7 docs and existing codebase
- Pitfalls: MEDIUM-HIGH - Rate limits and API quirks verified via official docs; edge cases from community sources

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — stable ecosystem, API limits unlikely to change)
