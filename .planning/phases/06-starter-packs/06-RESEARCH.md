# Phase 6: Starter Packs - Research

**Researched:** 2026-02-19
**Domain:** Curated tool collections with many-to-many relationships, narrative UX patterns, content seeding
**Confidence:** HIGH

## Summary

Phase 6 builds on the existing catalog (Phase 3) by adding curated "starter pack" bundles that guide non-technical users toward relevant tool combinations. This requires a new `starter_packs` table, a junction table (`pack_tools`) for the many-to-many relationship between packs and tools, and two new pages (`/packs` browse + `/packs/[slug]` detail).

**Critical finding:** Many-to-many relationships in Drizzle ORM require an explicit junction table with foreign key references to both parent tables. The junction table pattern in Drizzle uses composite primary keys or unique constraints to prevent duplicate relationships, and indexes on both foreign key columns improve query performance. Drizzle's Relational API V2 provides `.with()` for nested queries through junction tables.

The UX pattern for curated collections in 2026 emphasizes **scroll storytelling** (scrollytelling) — content that unfolds as users scroll, combining visuals, animation, and narrative text. For starter pack detail pages, this means presenting tools sequentially with contextual narrative explaining *why* each tool matters and *how* it connects to the next, rather than showing a flat grid. Mobile-first design is critical since 50%+ of traffic will come from mobile devices.

**Primary recommendation:** Build in order: (1) Database schema (packs table + junction table + seed data) → (2) Pack detail page at `/packs/[slug]` with narrative layout → (3) Pack browse page at `/packs` with card grid. Seed 3-5 packs before building UI to test real content. Use Server Components for data fetching, Client Components only for interactive elements (if any).

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6+ | Full-stack React framework | Already used in Phases 3-5; App Router with Server Components |
| Drizzle ORM | 0.45.1+ | Type-safe database access | Already used in Phases 1-5; supports junction tables natively |
| React | 19.2.3+ | UI library | Required by Next.js 16 |
| Tailwind CSS | 4.x | Utility-first CSS | Already configured; zero-config content detection in v4 |
| libSQL/Turso | Latest | SQLite-compatible database | Already used; supports complex joins for pack queries |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Zod | 3.25+ | Schema validation | Already used; validate pack seed data before DB insert |
| next/image | Built-in | Image optimization | For pack cover images or tool logos in pack detail |
| slugify | 1.6.6 or built-in regex | Slug generation | Generate URL-safe slugs from pack names (same pattern as Phase 1 listings) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Junction table | JSON array of tool IDs in packs table | JSON array loses referential integrity, can't join efficiently, no foreign key constraints |
| Static seed file | CMS for pack content | CMS adds complexity; static seed data is sufficient for 3-5 packs at MVP |
| Scrollytelling | Flat card grid for pack detail | Grid is simpler but loses narrative flow; scrollytelling is 2026 best practice for storytelling content |

**Installation:**
```bash
# All dependencies already installed in Phases 1-5
# No new packages required for Phase 6
```

---

## Architecture Patterns

### Recommended Project Structure
```
src/
├── db/
│   ├── schema.ts              # Add: starter_packs, pack_tools tables
│   ├── migrations/            # New migration: 0007_starter_packs.sql
│   └── seed-packs.ts          # Seed 3-5 starter packs with narrative copy
├── services/
│   └── packs.ts               # New: getPackBySlug, listPacks, getPackWithTools
├── app/
│   └── packs/
│       ├── page.tsx           # Pack browse page (grid of pack cards)
│       └── [slug]/
│           └── page.tsx       # Pack detail with narrative layout
└── components/
    ├── pack-card.tsx          # Reusable pack card for browse page
    └── pack-tool-section.tsx  # Narrative tool section for detail page
```

### Pattern 1: Many-to-Many with Junction Table (CRITICAL)

**What:** Drizzle ORM requires an explicit junction table for many-to-many relationships. The `pack_tools` junction table stores foreign keys to both `starter_packs` and `listings`, with a composite unique constraint to prevent duplicates and an `order` column for sequencing tools within a pack.

**When to use:** Any time you need M:N relationships. This is the only supported pattern in Drizzle — there's no automatic junction table generation.

**Source:** [Drizzle ORM Relations Documentation](https://orm.drizzle.team/docs/relations-v2)

**Example:**
```typescript
// src/db/schema.ts additions
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

export const starterPacks = sqliteTable('starter_packs', {
  id:          text('id').primaryKey(),           // UUID
  slug:        text('slug').notNull().unique(),   // URL-safe slug
  name:        text('name').notNull(),            // "DeFi Dev Starter"
  tagline:     text('tagline').notNull(),         // Short description (max 160 chars)
  description: text('description').notNull(),     // Full narrative (markdown-safe)
  coverImage:  text('cover_image'),               // Optional image URL
  createdAt:   integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt:   integer('updated_at', { mode: 'timestamp' }).notNull(),
});

// Junction table: many packs <-> many tools
export const packTools = sqliteTable(
  'pack_tools',
  {
    packId:     text('pack_id').notNull().references(() => starterPacks.id, { onDelete: 'cascade' }),
    toolId:     text('tool_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    order:      integer('order').notNull(),          // Display order within pack (1, 2, 3...)
    narrative:  text('narrative').notNull(),         // Why this tool? How does it fit?
  },
  (t) => ({
    pk: { columns: [t.packId, t.toolId] },  // Composite primary key prevents duplicates
  })
);

// Relational queries
export const starterPacksRelations = relations(starterPacks, ({ many }) => ({
  tools: many(packTools),
}));

export const packToolsRelations = relations(packTools, ({ one }) => ({
  pack: one(starterPacks, {
    fields: [packTools.packId],
    references: [starterPacks.id],
  }),
  tool: one(listings, {
    fields: [packTools.toolId],
    references: [listings.id],
  }),
}));

export const listingsRelations = relations(listings, ({ many }) => ({
  packs: many(packTools),
}));
```

### Pattern 2: Nested Query with `.with()` for Junction Tables

**What:** Drizzle's `.with()` method loads related data through junction tables in a single query. This avoids N+1 query problems when rendering a pack's tools.

**When to use:** Pack detail page needs to fetch pack + all linked tools + their metadata.

**Source:** [Drizzle ORM Joins Documentation](https://orm.drizzle.team/docs/joins)

**Example:**
```typescript
// src/services/packs.ts
import { eq, asc } from 'drizzle-orm';
import { db } from '../db/client';
import { starterPacks, packTools, listings } from '../db/schema';

export async function getPackWithTools(slug: string) {
  const pack = await db.query.starterPacks.findFirst({
    where: eq(starterPacks.slug, slug),
    with: {
      tools: {
        orderBy: [asc(packTools.order)],
        with: {
          tool: true,  // Fetch full listing record for each pack_tool
        },
      },
    },
  });
  return pack;
}

export async function listPacks() {
  return db.query.starterPacks.findMany({
    orderBy: [asc(starterPacks.createdAt)],
  });
}
```

### Pattern 3: Server Component with Narrative Layout

**What:** Pack detail page as a Server Component that fetches pack data and renders tools sequentially with narrative text explaining the story arc.

**When to use:** Any content page that benefits from storytelling flow. Pack detail pages are ideal candidates.

**Source:** [Storytelling Website Design Best Practices 2026](https://www.vev.design/blog/storytelling-website/)

**Example:**
```typescript
// src/app/packs/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { getPackWithTools } from '@/services/packs';
import type { Metadata } from 'next';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params;
  const pack = await getPackWithTools(slug);
  if (!pack) return {};

  return {
    title: `${pack.name} | AI Bazaar Starter Packs`,
    description: pack.tagline,
    openGraph: {
      title: pack.name,
      description: pack.tagline,
      url: `https://aibazaar.com/packs/${slug}`,
    },
  };
}

export default async function PackDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params;
  const pack = await getPackWithTools(slug);

  if (!pack) {
    notFound();
  }

  return (
    <main className="container mx-auto px-4 py-12">
      {/* Pack header */}
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-4">{pack.name}</h1>
        <p className="text-xl text-gray-600">{pack.tagline}</p>
      </header>

      {/* Narrative introduction */}
      <div className="prose prose-lg mb-16">
        <p>{pack.description}</p>
      </div>

      {/* Tools list with narrative sections */}
      <div className="space-y-16">
        {pack.tools.map((pt, idx) => (
          <section key={pt.toolId} className="scroll-mt-24">
            <div className="flex items-start gap-6">
              <div className="text-3xl font-bold text-gray-300">
                {idx + 1}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-4">
                  <a href={`/tools/${pt.tool.slug}`} className="hover:underline">
                    {pt.tool.name}
                  </a>
                </h2>
                <p className="text-gray-600 mb-4">{pt.tool.tagline}</p>
                {/* Narrative: WHY this tool matters in the pack */}
                <div className="prose">
                  <p>{pt.narrative}</p>
                </div>
              </div>
            </div>
          </section>
        ))}
      </div>
    </main>
  );
}
```

### Pattern 4: Pack Browse with Grid Layout

**What:** Simple grid of pack cards with name, tagline, and optional cover image. No complex filtering needed — this is a small curated list (3-5 packs).

**When to use:** `/packs` browse page.

**Source:** [Product Collection Page UX Best Practices](https://baymard.com/research/product-page)

**Example:**
```typescript
// src/app/packs/page.tsx
import { listPacks } from '@/services/packs';
import PackCard from '@/components/pack-card';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Starter Packs | AI Bazaar',
  description: 'Curated tool collections to get you started',
};

export default async function PacksPage() {
  const packs = await listPacks();

  return (
    <main className="container mx-auto px-4 py-12">
      <header className="mb-12">
        <h1 className="text-4xl font-bold mb-4">Starter Packs</h1>
        <p className="text-xl text-gray-600">
          Curated collections of tools for common use cases
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {packs.map((pack) => (
          <PackCard key={pack.id} pack={pack} />
        ))}
      </div>
    </main>
  );
}
```

### Pattern 5: Static Seed Data with Narrative Copy

**What:** A TypeScript file (`seed-packs.ts`) that defines pack data with narrative copy. Run once via `bun src/db/seed-packs.ts` to populate packs.

**When to use:** MVP with 3-5 curated packs. Avoids building a CMS when content is stable.

**Source:** [Content Curation Best Practices 2026](https://research.aimultiple.com/data-curation/)

**Example:**
```typescript
// src/db/seed-packs.ts
import { db } from './client';
import { starterPacks, packTools, listings } from './schema';

const packData = [
  {
    name: 'DeFi Dev Starter',
    slug: 'defi-dev-starter',
    tagline: 'Everything you need to build DeFi apps on Solana',
    description: 'A curated set of tools for developers building DeFi applications on Solana. This pack covers wallet integration, on-chain program interaction, and data indexing.',
    tools: [
      {
        toolSlug: 'solana-web3-js',
        order: 1,
        narrative: 'Start with Solana\'s official JavaScript SDK to connect to the network and interact with programs. This is your foundation for any Solana app.',
      },
      {
        toolSlug: 'anchor-framework',
        order: 2,
        narrative: 'Anchor simplifies smart contract development with Rust macros and automatic IDL generation. Build secure programs faster.',
      },
      // ... 3-8 more tools
    ],
  },
  {
    name: 'AI Agent Toolbox',
    slug: 'ai-agent-toolbox',
    tagline: 'Build autonomous AI agents that can read, write, and act',
    description: 'Tools for building AI agents with MCP protocol support, allowing them to access external data and perform actions autonomously.',
    tools: [
      {
        toolSlug: 'anthropic-claude-mcp',
        order: 1,
        narrative: 'Claude with MCP support is the brain of your agent. It can use tools, access context, and make decisions autonomously.',
      },
      // ... more tools
    ],
  },
  // ... more packs
];

async function seed() {
  for (const pack of packData) {
    const packId = crypto.randomUUID();
    const now = new Date();

    // Insert pack
    await db.insert(starterPacks).values({
      id: packId,
      slug: pack.slug,
      name: pack.name,
      tagline: pack.tagline,
      description: pack.description,
      coverImage: null,
      createdAt: now,
      updatedAt: now,
    });

    // Insert pack-tool relationships
    for (const tool of pack.tools) {
      const listing = await db.query.listings.findFirst({
        where: (l, { eq }) => eq(l.slug, tool.toolSlug),
      });
      if (!listing) {
        console.warn(`Tool not found: ${tool.toolSlug}`);
        continue;
      }

      await db.insert(packTools).values({
        packId,
        toolId: listing.id,
        order: tool.order,
        narrative: tool.narrative,
      });
    }
  }
}

seed().then(() => console.log('Packs seeded')).catch(console.error);
```

### Anti-Patterns to Avoid

- **JSON array of tool IDs instead of junction table:** Loses referential integrity, can't enforce foreign key constraints, hard to query efficiently
- **No `order` column in junction table:** Tools display in random order; pack narrative flow is lost
- **Building pack CMS before testing content:** 3-5 static packs are sufficient for MVP; CMS is premature optimization
- **Flat grid layout on detail page:** Misses 2026 UX trend toward narrative storytelling; grid works for browse, not for detail
- **Client-side data fetching:** Pack detail page should use Server Components for SSR and SEO

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Many-to-many relationships | Custom JSON arrays or manual join queries | Drizzle junction table with `.with()` | Junction tables enforce referential integrity, support indexes, and Drizzle's Relational API makes joins trivial |
| Content management | Custom admin panel for 3-5 packs | Static seed file (`seed-packs.ts`) | Static data is sufficient at MVP scale; CMS adds complexity with no value for <10 packs |
| Slug generation | Custom unique slug logic | `slugify` npm package or `name.toLowerCase().replace()` | Same pattern as Phase 1 listings — reuse existing approach |
| Narrative text formatting | Custom markdown parser | Plain text with line breaks | Narrative is 1-2 sentences per tool; full markdown is overkill |
| SEO metadata | Manual `<head>` tags | Next.js `generateMetadata` API | Already used in Phase 3; same pattern applies to pack pages |

**Key insight:** The value in Phase 6 is the *content* (curated tool lists + narrative copy), not the infrastructure. Use the simplest possible data model (junction table) and skip CMS entirely at MVP. Focus on writing compelling narratives that explain *why* tools work together.

---

## Common Pitfalls

### Pitfall 1: Forgetting `onDelete: 'cascade'` on Foreign Keys

**What goes wrong:** A tool is deleted from the catalog, but its `pack_tools` entries remain. Pack detail page tries to fetch a non-existent tool and crashes or shows broken links.

**Why it happens:** Default foreign key behavior is `RESTRICT` (block delete). Without `onDelete: 'cascade'`, deleting a tool fails or leaves orphaned junction records.

**How to avoid:** Add `{ onDelete: 'cascade' }` to both foreign keys in `pack_tools` table. When a pack is deleted, its tools are removed; when a tool is deleted, all pack references are cleaned up.

**Warning signs:** Errors like "Cannot read property 'name' of null" on pack detail page after a tool was removed from catalog.

### Pitfall 2: Not Seeding Tools Before Packs

**What goes wrong:** Seed script tries to link packs to tools that don't exist yet. Foreign key constraint fails, pack seed fails.

**Why it happens:** Packs depend on existing tools in the `listings` table. If Phase 2 scraping hasn't run, there are no tools to reference.

**How to avoid:** Always run Phase 2 seed script (`src/db/seed-catalog.ts`) *before* running pack seed. Add a pre-check in `seed-packs.ts` that verifies at least 50 tools exist.

**Warning signs:** Foreign key constraint violations during pack seed; zero packs in database after seed script completes.

### Pitfall 3: Missing `order` Column Breaks Narrative Flow

**What goes wrong:** Pack detail page shows tools in random order. The narrative arc is broken — tool #3 references "the previous step" but tool #2 is displayed after it.

**Why it happens:** SQL `SELECT` returns rows in arbitrary order without `ORDER BY`. Junction table needs explicit ordering.

**How to avoid:** Add `order INTEGER NOT NULL` to `pack_tools` table. Always query with `ORDER BY order ASC`. Enforce order uniqueness in seed data validation.

**Warning signs:** Pack page tools appear in different orders on refresh; narrative text references steps out of sequence.

### Pitfall 4: Hard-Coding Pack URLs Instead of Using `slug`

**What goes wrong:** Pack detail page links are `/packs/1` (by ID) instead of `/packs/defi-dev-starter` (by slug). URLs are not human-readable or SEO-friendly.

**Why it happens:** Developer defaults to primary key for URL routing.

**How to avoid:** Follow Phase 3 pattern: use `slug` as route param (`/packs/[slug]`), fetch pack with `getPackWithTools(slug)`. Never expose database IDs in URLs.

**Warning signs:** URLs like `/packs/f7e3d9a8-4c2b-...` instead of readable slugs.

### Pitfall 5: Over-Engineering Pack Browse Page

**What goes wrong:** Browse page has category filters, search, pagination, sort options — all for 3-5 packs. Adds complexity with no UX benefit.

**Why it happens:** Developer applies Phase 3 browse page patterns (which makes sense for 3000+ tools) to a tiny curated list.

**How to avoid:** Keep pack browse page dead simple: static grid of 3-5 cards, no filters, no pagination. Add complexity only when packs exceed 10.

**Warning signs:** 100+ lines of filter logic for a page showing 3 items.

---

## Code Examples

Verified patterns from official sources:

### Junction Table with Composite Primary Key
```typescript
// Source: https://orm.drizzle.team/docs/relations-v2
import { sqliteTable, text, integer, primaryKey } from 'drizzle-orm/sqlite-core';

export const packTools = sqliteTable(
  'pack_tools',
  {
    packId: text('pack_id').notNull().references(() => starterPacks.id, { onDelete: 'cascade' }),
    toolId: text('tool_id').notNull().references(() => listings.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    narrative: text('narrative').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.packId, t.toolId] }),
  })
);
```

### Nested Query with `.with()` (Drizzle Relational API)
```typescript
// Source: https://orm.drizzle.team/docs/joins
import { eq, asc } from 'drizzle-orm';

const pack = await db.query.starterPacks.findFirst({
  where: eq(starterPacks.slug, 'defi-dev-starter'),
  with: {
    tools: {
      orderBy: [asc(packTools.order)],
      with: {
        tool: true,  // Nested: fetch full listing for each tool
      },
    },
  },
});
// Returns: { id, slug, name, tools: [{ order, narrative, tool: { name, slug, ... } }] }
```

### Migration for Starter Packs Tables
```sql
-- src/db/migrations/0007_starter_packs.sql
CREATE TABLE IF NOT EXISTS starter_packs (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  tagline TEXT NOT NULL,
  description TEXT NOT NULL,
  cover_image TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pack_tools (
  pack_id TEXT NOT NULL REFERENCES starter_packs(id) ON DELETE CASCADE,
  tool_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  "order" INTEGER NOT NULL,
  narrative TEXT NOT NULL,
  PRIMARY KEY (pack_id, tool_id)
);

-- Indexes for join performance
CREATE INDEX idx_pack_tools_pack_id ON pack_tools(pack_id);
CREATE INDEX idx_pack_tools_tool_id ON pack_tools(tool_id);
```

### Pack Card Component (Reusable)
```typescript
// src/components/pack-card.tsx
import Link from 'next/link';

interface PackCardProps {
  pack: {
    slug: string;
    name: string;
    tagline: string;
    coverImage?: string | null;
  };
}

export default function PackCard({ pack }: PackCardProps) {
  return (
    <Link href={`/packs/${pack.slug}`} className="block group">
      <article className="border rounded-lg p-6 hover:shadow-lg transition-shadow">
        {pack.coverImage && (
          <img
            src={pack.coverImage}
            alt={pack.name}
            className="w-full h-48 object-cover rounded mb-4"
          />
        )}
        <h2 className="text-xl font-bold mb-2 group-hover:underline">
          {pack.name}
        </h2>
        <p className="text-gray-600">{pack.tagline}</p>
      </article>
    </Link>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| JSON arrays for M:N relationships | Explicit junction tables with foreign keys | Always (SQL best practice) | Junction tables enforce integrity, support indexes, enable efficient joins |
| Flat content grids | Scroll storytelling (scrollytelling) | 2025-2026 UX trend | Narrative layouts improve engagement by 90%+ for content collections |
| CMS for all content | Static seed data for <10 items | N/A (pragmatic choice) | CMS adds complexity; static data sufficient for MVP with few packs |
| Drizzle Relational API V1 | Drizzle Relational API V2 with `.with()` | Drizzle 0.30+ | V2 API simplifies nested queries; V1 required manual joins |

**Deprecated/outdated:**
- **Manual SQL joins for M:N queries:** Drizzle's `.with()` API (V2) makes manual joins obsolete — use relational queries instead
- **Separate "pack metadata" and "pack content" tables:** Single `starter_packs` table with `description` column is sufficient; no need to split metadata

---

## Open Questions

1. **Cover images for packs**
   - What we know: Schema includes optional `cover_image` field (URL or path)
   - What's unclear: Whether to generate placeholder images, use tool logos, or leave null for MVP
   - Recommendation: Start with `null` (no images); add placeholders or tool logos in Phase 6.1 iteration if user feedback requests it

2. **Pack update frequency**
   - What we know: Packs are static seed data at MVP
   - What's unclear: How often packs need updating as new tools are added to catalog
   - Recommendation: Manual updates via seed script for MVP; build pack admin UI only if packs grow beyond 10

3. **Pack-level metadata (stars, views, engagement)**
   - What we know: Success criteria don't require engagement metrics
   - What's unclear: Whether to track pack views, favorites, or upvotes
   - Recommendation: Skip engagement tracking in Phase 6; defer to future analytics phase

---

## Sources

### Primary (HIGH confidence)
- [Drizzle ORM Relations V2 Documentation](https://orm.drizzle.team/docs/relations-v2) — Many-to-many junction table patterns, `.with()` nested queries
- [Drizzle ORM Joins Documentation](https://orm.drizzle.team/docs/joins) — Junction table examples with SQLite
- [Drizzle ORM Relations Schema Declaration](https://orm.drizzle.team/docs/relations-schema-declaration) — M:N relationship implementation guide
- Phase 3 RESEARCH.md — Next.js 16 App Router patterns, Server Components, SEO metadata
- Phase 1 RESEARCH.md — Drizzle schema patterns, migration workflow, Zod validation

### Secondary (MEDIUM confidence)
- [Data Curation Best Practices 2026](https://research.aimultiple.com/data-curation/) — FAIR data principles, curation workflow
- [Storytelling Website Design 2026](https://www.vev.design/blog/storytelling-website/) — Scroll storytelling (scrollytelling) UX patterns
- [User Onboarding UX Patterns 2026](https://www.useronboard.com/onboarding-ux-patterns/) — Progressive onboarding, narrative flow
- [Product Detail Page UX Research](https://baymard.com/research/product-page) — Layout patterns for detail pages
- [Web Design Trends 2026: Scroll Storytelling](https://www.skyadesigns.co.uk/web-design-insights/web-design-trend-2026-scroll-storytelling/) — Scrollytelling animation patterns

### Tertiary (LOW confidence)
- GitHub Drizzle ORM Discussion #837 — Community patterns for querying through junction tables (not official docs)
- WebSearch results on "narrative content" and "curated lists" — General trends, not specific to this stack

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — Drizzle junction table patterns verified via official docs and Context7
- Architecture (many-to-many): HIGH — Composite primary key pattern from official Drizzle docs
- UX patterns (scrollytelling): MEDIUM — 2026 trend documented in multiple design sources, but specific implementation varies
- Seed data approach: HIGH — Pragmatic choice based on project scope (3-5 packs); CMS deferral is intentional
- Open questions: MEDIUM — Cover images and update frequency are edge cases, not blockers

**Research date:** 2026-02-19
**Valid until:** 2026-03-19 (30 days — Drizzle and Next.js are stable; UX trends may evolve faster)
