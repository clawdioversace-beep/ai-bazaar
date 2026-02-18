# Phase 1: Catalog Foundation - Research

**Researched:** 2026-02-18
**Domain:** SQLite/libSQL with Drizzle ORM, FTS5 full-text search, Zod schema validation, tag taxonomy design, dead-link detection
**Confidence:** HIGH (core stack verified via official docs and Context7; FTS5 patterns from official SQLite docs)

---

## Summary

Phase 1 builds the data layer and service contract that all three consumer interfaces (web, MCP, Telegram) depend on. The stack is locked: Drizzle ORM 0.45.1 + Turso/libSQL as the database, SQLite FTS5 for full-text search, and Zod 3.25+ for schema validation. The entire phase is greenfield — no source files exist in the project yet.

The most important technical finding is that Drizzle ORM does NOT support FTS5 virtual tables in its schema DSL. FTS5 virtual tables and their synchronization triggers must be created via custom SQL migrations using `drizzle-kit generate --custom`. This is a verified limitation confirmed by the Drizzle team. The FTS5 table must be an external content table (`content='listings'`) backed by the main `listings` table, with three triggers (INSERT/UPDATE/DELETE) to keep the index in sync. Trying to define FTS5 in `schema.ts` via Drizzle's table DSL will fail silently or produce wrong output.

The Zod CatalogEntry schema must be the shared contract that CatalogService, scrapers, and the MCP tool layer all validate against. Tag normalization happens at parse time using Zod's `.transform()` + `.toLowerCase().trim()` chained with a canonical tag map lookup. Dead-link detection uses HEAD requests with `AbortSignal.timeout(5000)` — this is the modern pattern (no AbortController + setTimeout needed); note a Bun bug exists where `AbortSignal.timeout()` may not respect the timeout on unreachable hosts, so a manual AbortController + setTimeout fallback is recommended for the health-check worker.

**Primary recommendation:** Build in the order: (1) Drizzle schema + custom FTS5 migration + Turso connection → (2) Zod CatalogEntry schema + tag/category taxonomy → (3) CatalogService CRUD → (4) SearchService with FTS5. Never bypass this order — SearchService depends on CatalogService writing correctly-tagged rows, and both depend on the schema compiling.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.1 | Type-safe DB access layer | Zero runtime overhead, SQL-first mental model, native libSQL support, generates TypeScript types from schema |
| @libsql/client | 0.17.0 | Turso/libSQL driver | Required by drizzle-orm/libsql; handles auth token + URL connection to Turso cloud or local SQLite |
| drizzle-kit | 0.31.9 | Migration generation + push | Generates schema migrations, supports `--custom` flag for raw SQL (required for FTS5) |
| zod | 3.25+ | Schema validation and transform | Required peer dep of @modelcontextprotocol/sdk; used across entire stack for CatalogEntry validation; built-in `.transform()` for tag normalization |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @modelcontextprotocol/sdk | 1.26.0 | MCP tool definitions (Phase 4) | Imported in Phase 1 only for Zod peer dep compatibility check — do not wire MCP server yet |
| crypto (built-in) | Node/Bun built-in | UUID generation for `id` field | Use `crypto.randomUUID()` — no external dep needed |
| slugify or custom | tiny | URL-safe slug from name | For `slug` field on CatalogEntry — can hand-roll or use `slugify` npm package (500B) |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| SQLite FTS5 | Meilisearch | Meilisearch is superior at scale but adds ops burden; FTS5 is zero-infra and handles <5k entries fine; introduce Meilisearch as sidecar when FTS5 latency becomes measurable (measure at 1k entries first) |
| Drizzle ORM | Prisma | Prisma has worse Bun/edge compat and heavier runtime; Drizzle is correct choice for this stack |
| Zod .transform() for tags | Custom pure function | Zod transform integrates normalization into schema parse — inputs are normalized before any service function sees them; custom function works but is a second system to maintain |
| AbortSignal.timeout() | AbortController + setTimeout | AbortSignal.timeout() is cleaner syntax but has a known Bun bug on unreachable hosts; use manual AbortController + setTimeout for health check worker specifically |

**Installation:**

```bash
# From the ai-bazaar project root (greenfield — no package.json yet)
bun create next-app . --typescript --tailwind --app --no-git

# Database layer
bun add drizzle-orm @libsql/client
bun add -D drizzle-kit

# Validation (also required for MCP SDK later)
bun add zod

# Dev tooling
bun add -D tsx @types/node
```

---

## Architecture Patterns

### Recommended Project Structure (Phase 1 scope only)

```
ai-bazaar/
├── src/
│   ├── db/
│   │   ├── client.ts           # libSQL/Drizzle singleton — created once, imported everywhere
│   │   ├── schema.ts           # Drizzle table definitions (listings, NOT FTS5 — that's in migrations)
│   │   └── migrations/         # Generated by drizzle-kit; custom FTS5 migration lives here
│   ├── lib/
│   │   ├── catalog-schema.ts   # Zod CatalogEntry schema with .transform() for tag normalization
│   │   ├── tags.ts             # Canonical tag taxonomy: Map<string, string> (input → canonical)
│   │   └── categories.ts       # Canonical category enum and type
│   └── services/
│       ├── catalog.ts          # CatalogService: create, read, update, upsertBySourceUrl
│       └── search.ts           # SearchService: fullTextSearch, browseByCategory, healthCheck
├── drizzle.config.ts           # Drizzle ORM config with turso dialect
└── .env.local                  # TURSO_DATABASE_URL, TURSO_AUTH_TOKEN
```

### Pattern 1: External Content FTS5 Table (CRITICAL)

**What:** FTS5 virtual table is defined in a custom migration, NOT in schema.ts. The FTS5 table references the `listings` main table as its content source. Three SQL triggers keep them in sync.

**When to use:** Any time you need full-text search on the `listings` table. This is the only supported pattern with Drizzle + SQLite FTS5.

**Why it matters:** Drizzle's schema DSL has no `CREATE VIRTUAL TABLE` support as of v0.45.1. If you try to define FTS5 in schema.ts, drizzle-kit will either ignore it or error. The custom migration approach is the official workaround.

**How to create the custom migration:**

```bash
# Step 1: Generate schema migration first (creates listings table)
bunx drizzle-kit generate

# Step 2: Generate empty custom migration for FTS5
bunx drizzle-kit generate --custom --name=fts5-listings-index
```

**Migration file content (custom FTS5 migration):**

```sql
-- Source: https://www.sqlite.org/fts5.html (Section 4.4: External Content Tables)
-- Create FTS5 virtual table backed by listings table
CREATE VIRTUAL TABLE IF NOT EXISTS listings_fts USING fts5(
  name,
  tagline,
  description,
  tags,
  content='listings',
  content_rowid='rowid'
);

-- Populate the index from existing data (for initial seed)
INSERT INTO listings_fts(listings_fts) VALUES('rebuild');

-- INSERT trigger: sync new listings to FTS index
CREATE TRIGGER IF NOT EXISTS listings_ai AFTER INSERT ON listings BEGIN
  INSERT INTO listings_fts(rowid, name, tagline, description, tags)
  VALUES (new.rowid, new.name, new.tagline, new.description, new.tags);
END;

-- DELETE trigger: remove deleted listings from FTS index
CREATE TRIGGER IF NOT EXISTS listings_ad AFTER DELETE ON listings BEGIN
  INSERT INTO listings_fts(listings_fts, rowid, name, tagline, description, tags)
  VALUES ('delete', old.rowid, old.name, old.tagline, old.description, old.tags);
END;

-- UPDATE trigger: update FTS index when listing changes (delete old, insert new)
CREATE TRIGGER IF NOT EXISTS listings_au AFTER UPDATE ON listings BEGIN
  INSERT INTO listings_fts(listings_fts, rowid, name, tagline, description, tags)
  VALUES ('delete', old.rowid, old.name, old.tagline, old.description, old.tags);
  INSERT INTO listings_fts(rowid, name, tagline, description, tags)
  VALUES (new.rowid, new.name, new.tagline, new.description, new.tags);
END;
```

### Pattern 2: Drizzle Schema (listings table)

**What:** The `listings` table defined in Drizzle's schema DSL. This is the source of truth for all catalog data.

**Source:** Drizzle + Turso official tutorial (orm.drizzle.team/docs/tutorials/drizzle-with-turso) + ARCHITECTURE.md from project research.

```typescript
// src/db/schema.ts
// Source: orm.drizzle.team/docs/tutorials/drizzle-with-turso
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';

export const listings = sqliteTable('listings', {
  id:              text('id').primaryKey(),           // crypto.randomUUID()
  slug:            text('slug').notNull().unique(),    // url-safe, e.g. "anthropic-claude-mcp"
  name:            text('name').notNull(),
  tagline:         text('tagline').notNull(),          // one-liner, max 160 chars
  description:     text('description').notNull(),
  category:        text('category').notNull(),         // from canonical category enum
  tags:            text('tags').notNull(),             // JSON array, canonical tags only
  sourceUrl:       text('source_url').notNull().unique(), // dedup key
  docsUrl:         text('docs_url'),
  licenseType:     text('license_type'),               // 'MIT' | 'Apache-2.0' | 'commercial' | null
  runtime:         text('runtime'),                    // 'node' | 'python' | 'rust' | null
  chainSupport:    text('chain_support'),              // JSON array or null
  mcpCompatible:   integer('mcp_compatible', { mode: 'boolean' }).default(false),
  acpCompatible:   integer('acp_compatible', { mode: 'boolean' }).default(false),
  stars:           integer('stars').default(0),
  downloads:       integer('downloads').default(0),
  lastVerifiedAt:  integer('last_verified_at', { mode: 'timestamp' }),
  deadLink:        integer('dead_link', { mode: 'boolean' }).default(false),
  submittedBy:     text('submitted_by'),               // null = scraped; handle = submitter
  verified:        integer('verified', { mode: 'boolean' }).default(false),
  createdAt:       integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:       integer('updated_at', { mode: 'timestamp' }).notNull(),
});

export type Listing = typeof listings.$inferSelect;
export type NewListing = typeof listings.$inferInsert;
```

### Pattern 3: Drizzle Client Singleton

**What:** Single module that exports the Drizzle client. Import `db` from this module everywhere — never create a second client.

**Why:** libSQL connections are cheap but the Drizzle wrapper holds internal state. In Next.js, module-level singletons survive across requests within a process.

```typescript
// src/db/client.ts
// Source: orm.drizzle.team/docs/tutorials/drizzle-with-turso
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

// Single instance — module is cached by Bun/Node module system
export const db = drizzle({
  connection: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,  // optional for local SQLite file
  },
  schema,
});
```

**drizzle.config.ts:**

```typescript
// drizzle.config.ts
// Source: orm.drizzle.team/docs/connect-turso
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema.ts',
  out: './src/db/migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
} satisfies Config;
```

### Pattern 4: SearchService with FTS5 MATCH via sql`` Operator

**What:** FTS5 queries cannot be expressed with Drizzle's standard query builder. Use Drizzle's `sql` tagged template literal with `db.all()` to execute raw FTS5 queries safely (parameterized, injection-safe).

**Source:** orm.drizzle.team/docs/sql + sqlite.org/fts5.html

```typescript
// src/services/search.ts
import { sql } from 'drizzle-orm';
import { db } from '../db/client';
import type { Listing } from '../db/schema';

export interface SearchParams {
  query: string;
  category?: string;
  tags?: string[];
  mcpCompatible?: boolean;
  limit?: number;
  offset?: number;
}

export async function searchCatalog(params: SearchParams): Promise<Listing[]> {
  const { query, category, mcpCompatible, limit = 20, offset = 0 } = params;

  // FTS5 MATCH uses BM25 ranking (ORDER BY rank = ORDER BY bm25 ascending = best first)
  // Source: sqlite.org/fts5.html Section 4.1 — `rank` column alias for bm25()
  const results = await db.all<Listing>(sql`
    SELECT l.*
    FROM listings_fts
    JOIN listings l ON listings_fts.rowid = l.rowid
    WHERE listings_fts MATCH ${query}
    ${category ? sql`AND l.category = ${category}` : sql``}
    ${mcpCompatible ? sql`AND l.mcp_compatible = 1` : sql``}
    AND l.dead_link = 0
    ORDER BY listings_fts.rank
    LIMIT ${limit} OFFSET ${offset}
  `);

  return results;
}

export async function browseByCategory(
  category: string,
  limit = 20,
  offset = 0,
): Promise<Listing[]> {
  return db.query.listings.findMany({
    where: (l, { eq, and }) => and(eq(l.category, category), eq(l.deadLink, false)),
    limit,
    offset,
    orderBy: (l, { desc }) => [desc(l.stars)],
  });
}
```

### Pattern 5: Zod CatalogEntry Schema with Tag Normalization

**What:** The shared Zod schema that acts as the contract between scrapers, CatalogService, and MCP tools. Tag normalization (canonical form) happens inside `.transform()` at parse time — downstream code always receives canonical tags.

**Source:** zod.dev/api + tags taxonomy design from ARCHITECTURE.md anti-pattern #4.

```typescript
// src/lib/tags.ts
// Canonical tag taxonomy — add entries here as new tags emerge
export const TAG_ALIASES: Record<string, string> = {
  // MCP variants
  'mcp':           'mcp-server',
  'MCP':           'mcp-server',
  'mcpserver':     'mcp-server',
  'mcp_server':    'mcp-server',
  'model-context-protocol': 'mcp-server',

  // ACP/A2A variants
  'acp':           'acp-agent',
  'ACP':           'acp-agent',
  'a2a':           'a2a-agent',

  // Web3 variants
  'web3':          'web3-tool',
  'defi':          'defi-tool',
  'blockchain':    'web3-tool',
  'onchain':       'web3-tool',
  'on-chain':      'web3-tool',

  // Solana
  'sol':           'solana',
  'solana-network': 'solana',
};

export function normalizeTag(input: string): string {
  const cleaned = input.toLowerCase().trim().replace(/\s+/g, '-');
  return TAG_ALIASES[cleaned] ?? TAG_ALIASES[input] ?? cleaned;
}
```

```typescript
// src/lib/catalog-schema.ts
import { z } from 'zod';
import { normalizeTag } from './tags';

export const CATEGORIES = [
  'mcp-server',
  'ai-agent',
  'web3-tool',
  'defi-tool',
  'infra',
  'framework',
] as const;

export type Category = typeof CATEGORIES[number];

export const CatalogEntrySchema = z.object({
  id:             z.string().uuid().optional(),      // generated if not provided
  slug:           z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  name:           z.string().min(1).max(100),
  tagline:        z.string().min(1).max(160),
  description:    z.string().min(1).max(2000),
  category:       z.enum(CATEGORIES),
  // Tag normalization at parse time
  tags:           z.array(z.string()).transform(
                    (tags) => [...new Set(tags.map(normalizeTag))]
                  ),
  sourceUrl:      z.string().url(),
  docsUrl:        z.string().url().optional(),
  licenseType:    z.string().optional(),
  runtime:        z.enum(['node', 'python', 'rust', 'go', 'other']).optional(),
  chainSupport:   z.array(z.string()).optional(),
  mcpCompatible:  z.boolean().default(false),
  acpCompatible:  z.boolean().default(false),
  stars:          z.number().int().min(0).default(0),
  downloads:      z.number().int().min(0).default(0),
  lastVerifiedAt: z.date().optional(),
  deadLink:       z.boolean().default(false),
  submittedBy:    z.string().optional(),
  verified:       z.boolean().default(false),
});

export type CatalogEntry = z.infer<typeof CatalogEntrySchema>;
export type CatalogEntryInput = z.input<typeof CatalogEntrySchema>;
```

### Pattern 6: CatalogService (CRUD + Upsert by Source URL)

**What:** The single point of all database writes. All callers (scrapers, submission handlers) go through this. The `upsertBySourceUrl` method is the dedup mechanism — same source URL = update existing, not insert.

```typescript
// src/services/catalog.ts
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { listings, type NewListing } from '../db/schema';
import { CatalogEntrySchema, type CatalogEntryInput } from '../lib/catalog-schema';

export async function createListing(input: CatalogEntryInput) {
  const entry = CatalogEntrySchema.parse(input);
  const now = new Date();
  const record: NewListing = {
    id: entry.id ?? crypto.randomUUID(),
    slug: entry.slug,
    name: entry.name,
    tagline: entry.tagline,
    description: entry.description,
    category: entry.category,
    tags: JSON.stringify(entry.tags),           // store as JSON string
    sourceUrl: entry.sourceUrl,
    docsUrl: entry.docsUrl ?? null,
    licenseType: entry.licenseType ?? null,
    runtime: entry.runtime ?? null,
    chainSupport: entry.chainSupport ? JSON.stringify(entry.chainSupport) : null,
    mcpCompatible: entry.mcpCompatible,
    acpCompatible: entry.acpCompatible,
    stars: entry.stars,
    downloads: entry.downloads,
    lastVerifiedAt: entry.lastVerifiedAt ?? now,
    deadLink: entry.deadLink,
    submittedBy: entry.submittedBy ?? null,
    verified: entry.verified,
    createdAt: now,
    updatedAt: now,
  };
  await db.insert(listings).values(record);
  return record;
}

export async function upsertBySourceUrl(input: CatalogEntryInput) {
  const existing = await db.query.listings.findFirst({
    where: (l, { eq }) => eq(l.sourceUrl, input.sourceUrl),
  });
  if (existing) {
    return updateListing(existing.id, input);
  }
  return createListing(input);
}

export async function updateListing(id: string, input: Partial<CatalogEntryInput>) {
  const now = new Date();
  await db.update(listings)
    .set({ ...input, updatedAt: now })
    .where(eq(listings.id, id));
}

export async function markDeadLink(id: string, isDead: boolean) {
  await db.update(listings)
    .set({ deadLink: isDead, lastVerifiedAt: new Date(), updatedAt: new Date() })
    .where(eq(listings.id, id));
}
```

### Pattern 7: Dead-Link Detection

**What:** Scheduled HEAD request against each listing's sourceUrl. Uses `AbortController` + `setTimeout` fallback (not `AbortSignal.timeout()`) due to a known Bun bug where `AbortSignal.timeout()` may not fire on unreachable hosts.

```typescript
// src/services/catalog.ts (add this function)
export async function checkDeadLink(sourceUrl: string): Promise<boolean> {
  const controller = new AbortController();
  // Manual timeout — AbortSignal.timeout() has a Bun bug on unreachable hosts
  // Source: github.com/oven-sh/bun/issues/13302
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(sourceUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    return response.status >= 400;  // 404, 410, 5xx = dead
  } catch {
    return true;  // Network error or abort = treat as dead
  } finally {
    clearTimeout(timer);
  }
}
```

### Anti-Patterns to Avoid

- **Defining FTS5 in schema.ts:** Drizzle cannot generate `CREATE VIRTUAL TABLE` DDL. It will silently fail or not create the table. Use `--custom` migration exclusively.
- **Storing tags as a normalized join table from day one:** The `tags` JSON column is appropriate for <10k listings. A `listing_tags` junction table adds query complexity with no performance benefit at this scale. The ARCHITECTURE.md documents this decision.
- **Writing SQL directly in MCP tool handlers or API routes:** All DB access goes through CatalogService and SearchService. This is non-negotiable — see ARCHITECTURE.md Pattern 1.
- **Using Drizzle's `push` for FTS5 tables:** `drizzle-kit push` will re-create the schema on each push and will not know about virtual tables defined outside schema.ts. In production, use `drizzle-kit migrate` not `push`. Use `push` only for the regular schema tables during rapid iteration.
- **Not calling `INSERT INTO listings_fts(listings_fts) VALUES('rebuild')` after bulk inserts:** If you insert many rows bypassing triggers (e.g., via a bulk SQL INSERT), the FTS5 index will be stale. Call `rebuild` after any bulk operation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Full-text search | Custom LIKE/ILIKE queries | SQLite FTS5 with BM25 ranking | LIKE scans every row; FTS5 uses an inverted index and BM25 relevance ranking; LIKE has no relevance ordering |
| Schema validation + normalization | Custom type-checking functions | Zod with `.transform()` | Zod handles type coercion, transform chaining, error messages, and TypeScript inference in one call |
| UUID generation | UUID library | `crypto.randomUUID()` | Built into Node 16+ and Bun; no external dependency |
| Slug generation | Custom regex | `slugify` npm package (500B, zero deps) or hand-rolled `name.toLowerCase().replace(/[^a-z0-9]+/g, '-')` | Simple enough to hand-roll given the small surface area |
| Database migrations | Custom migration runner | drizzle-kit generate + migrate | drizzle-kit handles ordering, checksums, and journal; custom runner is a second system |
| Dead-link batch check | Scrapy or Playwright-based health checks | Native `fetch` with HEAD + AbortController | HEAD requests are sufficient for URL validity; no JS execution needed; Playwright is massive overkill |
| Tag deduplication | Set logic in application code | Zod array `.transform()` with `new Set()` | Runs at parse time before any service function; dedup is guaranteed at the schema boundary |

**Key insight:** The combination of SQLite FTS5 + Zod transforms means the two most complex problems (search relevance, data normalization) are solved by battle-tested systems with zero operational overhead. The temptation to add Meilisearch or a custom normalizer at Phase 1 should be resisted — measure FTS5 latency at 1k entries before adding infrastructure.

---

## Common Pitfalls

### Pitfall 1: FTS5 Index Out of Sync After Bulk Insert

**What goes wrong:** Scrapers insert 200+ rows in a tight loop. If done via a raw SQL batch INSERT that bypasses triggers (e.g., Drizzle's `.values([...])` with a large array), the FTS5 index may not reflect all rows. Search returns partial results.

**Why it happens:** Drizzle's batch insert fires triggers row-by-row at the SQLite level in most configurations, but there are edge cases with transactional bulk inserts and libSQL's HTTP mode where trigger execution order is not guaranteed.

**How to avoid:** After any bulk insert operation, always call:
```typescript
await db.run(sql`INSERT INTO listings_fts(listings_fts) VALUES('rebuild')`);
```
This rebuilds the entire index from the content table. Cheap for <10k rows.

**Warning signs:** Search returns 0 results for terms you know are in the database; or result count is lower than `SELECT COUNT(*) FROM listings`.

### Pitfall 2: `drizzle-kit push` Overwrites the Database Schema and Loses FTS5 Tables

**What goes wrong:** Developer runs `bunx drizzle-kit push` during iteration. Drizzle compares its schema to the DB and drops tables it doesn't recognize (including the FTS5 virtual table and its triggers). All full-text search stops working silently.

**Why it happens:** `push` is a "bring the database to match the schema" command. Virtual tables defined outside schema.ts are invisible to drizzle-kit and treated as orphans.

**How to avoid:** Use `drizzle-kit push` ONLY for rapid prototyping of the `listings` table structure. Switch to `drizzle-kit generate` + `drizzle-kit migrate` immediately after the table is stable. Add a comment to `drizzle.config.ts` warning against using `push` in this project.

**Warning signs:** `SELECT * FROM listings_fts WHERE listings_fts MATCH 'test'` throws `no such table: listings_fts`.

### Pitfall 3: Zod Validation Rejecting Valid Category Strings at Runtime

**What goes wrong:** A scraper populates a `category` field with `'web3'` (not in the enum). Zod throws at parse time. The scraper error silently drops the entry.

**Why it happens:** The `category` field uses `z.enum(CATEGORIES)` which is strict. Scraper code was written before the taxonomy was finalized, or the taxonomy was updated without updating the scraper normalizer.

**How to avoid:** Import `CATEGORIES` from `src/lib/catalog-schema.ts` in ALL scrapers and normalizers — they must reference the same source of truth. Add a `.catch()` on the Zod parse that logs the rejected input with the full validation error, so dropped entries are visible in logs.

**Warning signs:** Catalog entry count growing more slowly than expected; scraper logs showing Zod parse errors.

### Pitfall 4: `sourceUrl` Uniqueness Constraint Causing Silent Upsert Failures

**What goes wrong:** Two slightly different URLs point to the same project (e.g., `https://github.com/org/repo` vs `https://github.com/org/repo/`). Both pass the `upsertBySourceUrl` lookup as different entries, creating duplicates.

**Why it happens:** URL normalization is not applied before the uniqueness check. Trailing slashes, `www.` prefixes, and `http://` vs `https://` all produce different strings.

**How to avoid:** Normalize URLs before any write: remove trailing slash, normalize to `https://`, strip `www.`. Apply this in the Zod schema's `.transform()` for `sourceUrl`:
```typescript
sourceUrl: z.string().url().transform((url) => {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
}),
```

**Warning signs:** Duplicate entries in the catalog for the same GitHub repo; `sourceUrl` unique constraint violation errors in logs.

### Pitfall 5: Dead-Link False Positives from HEAD Request Blocking

**What goes wrong:** GitHub, npm, or HuggingFace return 405 Method Not Allowed for HEAD requests, causing the health check to incorrectly flag live listings as dead links.

**Why it happens:** Some servers do not implement the HEAD method and return 405 even though the resource exists.

**How to avoid:** Treat only 404 and 410 status codes as definitively dead. 405, 403, and 5xx should be treated as "inconclusive" — do not set `dead_link = true` for these. Only set `dead_link = true` after 3 consecutive 404/410 responses across multiple check intervals.

**Warning signs:** Large numbers of live-looking listings flagged as dead; community reports of working links being marked stale.

---

## Code Examples

Verified patterns from official sources:

### Drizzle Client Initialization (from official Turso tutorial)

```typescript
// Source: orm.drizzle.team/docs/tutorials/drizzle-with-turso
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

export const db = drizzle({
  connection: {
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  },
  schema,
});
```

### FTS5 MATCH Query with BM25 Ranking (from official SQLite FTS5 docs)

```typescript
// Source: sqlite.org/fts5.html — rank column = bm25() alias, lower = more relevant
import { sql } from 'drizzle-orm';

const results = await db.all(sql`
  SELECT l.id, l.slug, l.name, l.tagline, l.category
  FROM listings_fts
  JOIN listings l ON listings_fts.rowid = l.rowid
  WHERE listings_fts MATCH ${searchQuery}
  AND l.dead_link = 0
  ORDER BY listings_fts.rank
  LIMIT ${limit} OFFSET ${offset}
`);
```

### FTS5 Rebuild After Bulk Insert

```typescript
// Source: sqlite.org/fts5.html Section 4.5.3
// Call after any bulk insert that may bypass triggers
await db.run(sql`INSERT INTO listings_fts(listings_fts) VALUES('rebuild')`);
```

### Zod Transform for Tag Normalization

```typescript
// Source: zod.dev/api — .transform() runs after validation, before output
// Tags are deduplicated and normalized at schema boundary
tags: z.array(z.string()).transform(
  (tags) => [...new Set(tags.map(normalizeTag))]
),
```

### URL Normalization in Zod

```typescript
// Prevents duplicate entries from trailing slash / http/https differences
sourceUrl: z.string().url().transform((url) => {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`.replace(/\/$/, '');
}),
```

### Dead-Link Health Check with Manual Timeout

```typescript
// AbortSignal.timeout() has Bun bug on unreachable hosts (github.com/oven-sh/bun/issues/13302)
// Use manual AbortController + setTimeout instead
export async function checkDeadLink(sourceUrl: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const response = await fetch(sourceUrl, {
      method: 'HEAD',
      signal: controller.signal,
      redirect: 'follow',
    });
    // Only 404 and 410 are definitively dead; others are inconclusive
    return response.status === 404 || response.status === 410;
  } catch {
    return false; // Network error = inconclusive, not definitively dead
  } finally {
    clearTimeout(timer);
  }
}
```

### Drizzle Migration Commands

```bash
# Generate migration from schema.ts changes
bunx drizzle-kit generate

# Generate empty custom migration for FTS5 (run AFTER the schema migration)
bunx drizzle-kit generate --custom --name=fts5-listings-index

# Apply all pending migrations (use this in production; NOT push)
bunx drizzle-kit migrate

# Rapid iteration ONLY (dev only; destroys FTS5 virtual tables)
bunx drizzle-kit push
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `drizzle-kit push` for everything | `generate` + `migrate` for prod; `push` only for raw schema iteration | Drizzle v0.30+ | `push` destroys unrecognized virtual tables; migration journal is required for FTS5 |
| `AbortSignal.timeout(ms)` | Manual AbortController + setTimeout for Bun | Bun 1.x known issue | `AbortSignal.timeout()` works fine in Node.js and browsers; Bun has a bug on unreachable hosts |
| Standalone Meilisearch from day 1 | SQLite FTS5 first; Meilisearch as upgrade path | N/A (deliberate choice) | FTS5 handles <5k entries with zero ops; measure before adding Meilisearch |
| JSON tags in `listing_tags` junction table | `tags TEXT` (JSON string) in main table | N/A (deliberate choice) | Junction table justified at >10k listings with complex tag queries; JSON is fine at MVP scale |

**Deprecated/outdated:**
- `SSE transport for MCP`: Officially deprecated 2025-11-25; use Streamable HTTP — relevant for Phase 4, not Phase 1
- `Prisma with Bun/edge`: Known binary client incompatibility — Drizzle is the correct choice for this stack

---

## Open Questions

1. **Local SQLite vs. Turso remote for Phase 1 development**
   - What we know: Drizzle supports both via `TURSO_DATABASE_URL=file:./local.db` (no auth token needed) for local dev and `libsql://...turso.io` for cloud
   - What's unclear: Whether to start with local SQLite file and migrate to Turso, or connect to Turso from day 1
   - Recommendation: Use `TURSO_DATABASE_URL=file:./dev.db` locally; point to Turso cloud in production. No migration needed — same libSQL client, different URL.

2. **Tags JSON storage vs. indexing**
   - What we know: Tags are stored as a JSON string in the `tags TEXT` column; FTS5 indexes this column as full text
   - What's unclear: Whether FTS5 will correctly tokenize `["mcp-server","defi-tool"]` or treat it as a single token with brackets/quotes
   - Recommendation: Store tags as space-separated string in the FTS5 index rather than JSON: the FTS5 column should get `tags.join(' ')` not `JSON.stringify(tags)`. Store JSON in the main `tags` column for structured reads; store the joined string in the FTS5 virtual table. This requires the triggers to transform: `new.tags` in triggers should reference the main column (which stores JSON), but FTS5 MATCH will tokenize it including the brackets. Test this explicitly in Phase 1 with a unit test before proceeding to Phase 2.

3. **`drizzle-kit migrate` vs. `push` for Turso**
   - What we know: Turso requires HTTP API for DDL; drizzle-kit supports `turso` dialect specifically for this
   - What's unclear: Whether `drizzle-kit migrate` works correctly with the `turso` dialect for custom SQL migrations containing `CREATE VIRTUAL TABLE`
   - Recommendation: Test this in the first task of Phase 1 — run `drizzle-kit migrate` against a real Turso database (or local libSQL file) with the FTS5 custom migration and verify the virtual table is created correctly.

---

## Sources

### Primary (HIGH confidence)

- [orm.drizzle.team/docs/tutorials/drizzle-with-turso](https://orm.drizzle.team/docs/tutorials/drizzle-with-turso) — Drizzle + Turso client initialization, schema patterns, migration commands
- [orm.drizzle.team/docs/kit-custom-migrations](https://orm.drizzle.team/docs/kit-custom-migrations) — `drizzle-kit generate --custom --name=X` for raw SQL migrations
- [orm.drizzle.team/docs/sql](https://orm.drizzle.team/docs/sql) — `sql` tagged template literal for raw queries, parameterization, `db.all()` vs `db.run()`
- [sqlite.org/fts5.html](https://www.sqlite.org/fts5.html) — External content table syntax, INSERT/UPDATE/DELETE trigger patterns, BM25 ranking via `rank` column, MATCH syntax
- ARCHITECTURE.md in `.planning/research/` — Drizzle schema design verified against project requirements, service layer pattern

### Secondary (MEDIUM confidence)

- [Drizzle FTS5 virtual table limitation](https://www.answeroverflow.com/m/1146392232509833256) — Verified Drizzle ORM does not support `CREATE VIRTUAL TABLE` in schema DSL; community-confirmed via Drizzle team response
- [Bun AbortSignal.timeout() bug](https://github.com/oven-sh/bun/issues/13302) — Bun bug tracker; AbortSignal.timeout() may not respect timeout on unreachable hosts in Bun 1.x
- [zod.dev/api](https://zod.dev/api) — `.transform()`, `.toLowerCase()`, `.trim()` string methods verified

### Tertiary (LOW confidence)

- WebSearch result about FTS5 trigger `PRAGMA recursive_triggers` requirement for `UPDATE OR REPLACE` — not directly applicable here (we use standard INSERT/UPDATE/DELETE, not REPLACE), but worth knowing: if any code path uses `INSERT OR REPLACE`, recursive triggers must be enabled to fire DELETE triggers

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all versions verified against npm registry 2026-02-18; Drizzle + Turso integration from official docs
- Architecture (FTS5 via custom migration): HIGH — confirmed Drizzle limitation + official SQLite FTS5 trigger patterns from sqlite.org
- Architecture (service layer patterns): HIGH — from ARCHITECTURE.md, which was verified against MCP official docs
- Zod tag normalization: HIGH — official Zod docs confirmed `.transform()` + `.toLowerCase()` + custom map lookup
- Dead-link detection: MEDIUM — HEAD request pattern is standard; Bun-specific AbortSignal bug is MEDIUM (bug tracker, not official Bun docs)
- Open Questions: MEDIUM — FTS5 tokenization of JSON tags strings is flagged as needing a test; not verified against real database

**Research date:** 2026-02-18
**Valid until:** 2026-03-20 (30 days — Drizzle and SQLite are stable; Bun bug may be fixed sooner)
