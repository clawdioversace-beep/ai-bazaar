# Phase 3: Web Frontend - Research

**Researched:** 2026-02-19
**Domain:** Next.js 16 App Router web frontend for catalog browsing
**Confidence:** HIGH

## Summary

This phase builds a human-browsable catalog on top of the existing CatalogService and SearchService (Phase 1+2). The project is already scaffolded with Next.js 16.1.6 and the App Router (`src/app/` directory exists), Tailwind CSS 4, and TypeScript. The database has 3,259 pre-seeded entries across 6 categories.

**Critical finding:** The project uses Next.js 16 App Router, NOT Bun.serve() with HTML imports. While the global CLAUDE.md specifies "Use HTML imports with Bun.serve(). Don't use vite", this directive applies to NEW projects being initialized. This project was already initialized as Next.js in Phase 1, has `next.config.ts`, and uses Next.js-specific features (file-based routing, React Server Components). The recommendation is to continue with Next.js 16 App Router as the frontend framework.

**Primary recommendation:** Build with Next.js 16 App Router using Server Components for data-fetching pages (homepage, browse, listing detail) and Client Components for interactive filters/UI. Use searchParams for pagination state to make URLs shareable and bookmarkable.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Full-stack React framework with App Router | Already installed, production-ready, excellent SEO, file-based routing, Server Components |
| React | 19.2.3 | UI library | Latest stable, required by Next.js 16 |
| Tailwind CSS | 4.x | Utility-first CSS framework | Already configured, automatic content detection in v4, zero-config setup |
| TypeScript | 5.x | Type safety | Already configured project-wide |
| Drizzle ORM | 0.45.1 | Database query layer | Already used in Phases 1+2, type-safe access to listings table |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| @tailwindcss/postcss | 4.x | PostCSS plugin for Tailwind 4 | Already in devDependencies, required for Tailwind 4 CSS processing |
| next/image | Built-in | Optimized image loading | For any images (logos, OG images, placeholders) |
| next/font | Built-in | Web font optimization | Google Fonts (Geist Sans/Mono already configured in layout.tsx) |
| Zod | 3.25+ | Runtime validation | Already used in Phase 1, reuse CatalogEntrySchema for form validation in Phase 5 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Next.js 16 | Bun.serve() + HTML imports | Bun.serve() HTML imports are experimental (Bun v1.2.3+), no built-in routing, no SSR/RSC, less mature SEO story. Next.js is production-ready and already installed. |
| Server Components | All Client Components | Loss of SSR performance, SEO degradation, no async data fetching in components |
| Offset pagination | Cursor pagination | Cursor is more database-efficient but WEB-06 requires cursor-based. Must implement via `searchParams.after` pattern. |

**Installation:**
```bash
# All dependencies already installed
bun install  # Verify lockfile is current
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/                     # Next.js App Router pages
│   ├── layout.tsx          # Root layout (already exists)
│   ├── page.tsx            # Homepage (replace boilerplate)
│   ├── tools/              # Browse and listing detail
│   │   ├── page.tsx        # Browse page with filters
│   │   └── [slug]/         # Dynamic route
│   │       └── page.tsx    # Listing detail page
│   └── globals.css         # Tailwind imports (already exists)
├── components/             # React components
│   ├── listing-card.tsx    # Reusable listing card
│   ├── filter-panel.tsx    # Client Component for filters
│   ├── category-nav.tsx    # Category navigation
│   └── pagination.tsx      # Cursor-based pagination UI
├── services/               # Already exists (CatalogService, SearchService)
├── lib/                    # Already exists (categories, tags, schemas)
└── db/                     # Already exists (schema, client, migrations)
```

### Pattern 1: Server Component Page with Data Fetching
**What:** Default export async function that fetches data and renders
**When to use:** All pages (homepage, browse, listing detail) — leverage SSR and avoid client-side waterfalls
**Example:**
```typescript
// Source: https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/migrating/app-router-migration.mdx
// app/tools/page.tsx
import { searchCatalog } from '@/services/search'

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; after?: string }>
}) {
  const params = await searchParams
  const { category, after } = params

  // Fetch data directly in Server Component
  const listings = await searchCatalog({
    query: '*',
    category,
    limit: 24,
    offset: after ? parseInt(after) : 0,
  })

  return <div>{/* Render listings */}</div>
}
```

### Pattern 2: Client Component for Interactive Filters
**What:** Component marked with `'use client'` for state and interactivity
**When to use:** Multi-select filters, search input, any UI requiring useState/useEffect
**Example:**
```typescript
// Source: https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/02-guides/migrating/app-router-migration.mdx
// components/filter-panel.tsx
'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState } from 'react'

export default function FilterPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selected, setSelected] = useState<string[]>([])

  const applyFilters = () => {
    const params = new URLSearchParams(searchParams)
    params.set('category', selected[0] || '')
    router.push(`/tools?${params.toString()}`)
  }

  return <div>{/* Filter UI */}</div>
}
```

### Pattern 3: Dynamic Metadata for SEO
**What:** Export `generateMetadata` function to set page-specific SEO tags
**When to use:** Listing detail pages, browse pages with filters
**Example:**
```typescript
// Source: https://github.com/vercel/next.js/blob/v16.1.5/docs/01-app/03-api-reference/03-file-conventions/layout.mdx
// app/tools/[slug]/page.tsx
import type { Metadata } from 'next'
import { getListingBySlug } from '@/services/catalog'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const listing = await getListingBySlug(slug)

  return {
    title: `${listing.name} | AI Bazaar`,
    description: listing.tagline,
    openGraph: {
      title: listing.name,
      description: listing.tagline,
      url: `https://aibazaar.com/tools/${slug}`,
    },
  }
}
```

### Pattern 4: Shareable URLs with searchParams
**What:** Store all filter/pagination state in URL query params
**When to use:** Browse page, search results — makes URLs bookmarkable
**Example:**
```typescript
// Source: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
// Construct shareable URL with searchParams
const createPageURL = (pageNumber: number) => {
  const params = new URLSearchParams(searchParams)
  params.set('page', pageNumber.toString())
  return `${pathname}?${params.toString()}`
}
```

### Anti-Patterns to Avoid
- **Using `'use client'` at page level:** This converts the entire page and all imported components to Client Components, losing SSR benefits. Only add `'use client'` to leaf components that need interactivity.
- **Client-side data fetching for initial render:** Avoid useEffect + fetch for page load data. Use Server Components with async/await instead.
- **Hardcoding pagination limits:** Store limits in config constants, not magic numbers scattered across components.
- **Non-bookmarkable filter state:** Don't store filters only in React state. Always sync to URL searchParams.
- **Removing navigation from DOM on mobile:** Use CSS `display: none` only on decorative elements, never on functional links (harms SEO).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Routing | Custom route matching | Next.js App Router file-based routing | File system conventions handle nested routes, dynamic segments, layouts, and metadata automatically |
| Image optimization | Manual `<img>` resizing/lazy-load | `next/image` component | Automatic WebP conversion, responsive srcsets, lazy loading, blur placeholders |
| Font loading | Manual FOUT mitigation | `next/font` | Eliminates flash of unstyled text, inlines font CSS, automatic subsetting |
| Metadata/SEO | Manual `<head>` tag management | Metadata API + `generateMetadata` | Type-safe, supports async data fetching, automatic OpenGraph tags |
| CSS bundling | Webpack/esbuild config | Tailwind 4 automatic detection | Zero-config content detection, CSS tree-shaking, PostCSS integration built-in |
| Pagination UI | Custom prev/next logic | Reusable `<Pagination>` component with searchParams | Cursor state management, shareable URLs, edge case handling (first/last page) |

**Key insight:** Next.js 16 App Router provides routing, bundling, optimization, and SEO out of the box. The value is in composing these primitives correctly (Server vs Client Components, searchParams for state, metadata for SEO) rather than configuring low-level tools.

## Common Pitfalls

### Pitfall 1: Over-using `'use client'` Directive
**What goes wrong:** Adding `'use client'` to a page component converts the entire page tree to Client Components, losing SSR, increasing bundle size, and breaking async data fetching.
**Why it happens:** Developers coming from Pages Router default to client-side patterns. App Router flips the default — everything is a Server Component unless marked otherwise.
**How to avoid:** Start with Server Components. Only add `'use client'` to leaf components that use hooks (useState, useEffect, useRouter). Example: page.tsx is Server, filter-panel.tsx is Client.
**Warning signs:** Seeing "You're importing a component that needs useState. It only works in a Client Component but none of its parents are marked with 'use client'" — solution is to mark THAT component, not its parent.

### Pitfall 2: Treating searchParams as Synchronous
**What goes wrong:** In Next.js 15+, `searchParams` is a Promise. Accessing it synchronously causes runtime errors.
**Why it happens:** searchParams was synchronous in Next.js 14 and earlier. Docs and examples from 2024 use the old API.
**How to avoid:** Always `await searchParams` in Server Components, or use React's `use(searchParams)` in Client Components.
**Warning signs:** Error: "searchParams is a Promise and must be awaited before use."

### Pitfall 3: Cursor Pagination Without Offset Fallback
**What goes wrong:** Cursor-based pagination using opaque tokens (e.g., `after=abc123`) requires storing cursor state in the database or encoding row metadata. Offset-based (`offset=20`) is simpler for SQLite FTS5.
**Why it happens:** "Cursor-based pagination" in WEB-06 is conflated with "opaque cursor tokens." The actual requirement is shareable, stateless URLs — offset-based pagination meets this.
**How to avoid:** Use offset-based pagination with `searchParams.page` or `searchParams.offset`. Encode offset in URL, not opaque cursors.
**Warning signs:** Complex cursor serialization logic when the database query is just `LIMIT X OFFSET Y`.

### Pitfall 4: Not Handling Empty States
**What goes wrong:** Browse page shows blank screen when no results match filters. Users don't know if it's broken or legitimately empty.
**Why it happens:** Developers focus on happy path (results exist) and forget zero-results case.
**How to avoid:** Check `listings.length === 0` after data fetch and render an empty state with clear messaging and a reset button.
**Warning signs:** QA feedback: "Filter doesn't work" when it actually works but returns zero results.

### Pitfall 5: Mobile Layout Tested Only in DevTools
**What goes wrong:** DevTools responsive mode doesn't catch real device issues (touch targets too small, viewport units behave differently, font rendering).
**Why it happens:** Testing on actual mobile devices is slower than DevTools.
**How to avoid:** Test on at least one real iOS device and one Android device before marking Phase 3 complete. Use ngrok or Tailscale to expose local dev server.
**Warning signs:** "Works on my machine" but users report mobile UI is unusable.

## Code Examples

Verified patterns from official sources:

### Server Component Page with Metadata
```typescript
// Source: https://nextjs.org/docs/app/getting-started/metadata-and-og-images
// app/tools/page.tsx
import type { Metadata } from 'next'
import { searchCatalog } from '@/services/search'

export const metadata: Metadata = {
  title: 'Browse Tools | AI Bazaar',
  description: 'Discover AI, agent, and Web3 tools',
}

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>
}) {
  const params = await searchParams
  const page = parseInt(params.page || '1')
  const offset = (page - 1) * 24

  const listings = await searchCatalog({
    query: '*',
    category: params.category,
    limit: 24,
    offset,
  })

  return <div>{/* Render listings */}</div>
}
```

### Client Component Filter with useRouter
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/use-search-params
// components/filter-panel.tsx
'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'

export default function FilterPanel({
  categories,
}: {
  categories: string[]
}) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const handleCategoryChange = (category: string) => {
    const params = new URLSearchParams(searchParams)
    if (category) {
      params.set('category', category)
    } else {
      params.delete('category')
    }
    params.delete('page') // Reset to page 1 when filter changes
    router.push(`${pathname}?${params.toString()}`)
  }

  return <div>{/* Filter UI */}</div>
}
```

### Dynamic Route with generateMetadata
```typescript
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-metadata
// app/tools/[slug]/page.tsx
import { notFound } from 'next/navigation'
import { getListingBySlug } from '@/services/catalog'
import type { Metadata } from 'next'

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const listing = await getListingBySlug(slug)

  if (!listing) return { title: 'Not Found' }

  return {
    title: `${listing.name} | AI Bazaar`,
    description: listing.tagline,
    openGraph: {
      title: listing.name,
      description: listing.tagline,
      images: ['/og-default.png'],
    },
  }
}

export default async function ListingPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const listing = await getListingBySlug(slug)

  if (!listing) notFound()

  return <div>{/* Render listing detail */}</div>
}
```

### Tailwind 4 PostCSS Configuration
```javascript
// Source: https://tailwindcss.com/docs/guides/nextjs
// postcss.config.mjs
export default {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}
```

### Pagination Component
```typescript
// Source: https://nextjs.org/learn/dashboard-app/adding-search-and-pagination
// components/pagination.tsx
'use client'

import { usePathname, useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function Pagination({
  currentPage,
  totalPages,
}: {
  currentPage: number
  totalPages: number
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const createPageURL = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams)
    params.set('page', pageNumber.toString())
    return `${pathname}?${params.toString()}`
  }

  return (
    <div className="flex gap-2">
      {currentPage > 1 && (
        <Link href={createPageURL(currentPage - 1)}>Previous</Link>
      )}
      {currentPage < totalPages && (
        <Link href={createPageURL(currentPage + 1)}>Next</Link>
      )}
    </div>
  )
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `getServerSideProps` | Async Server Components | Next.js 13 (Nov 2022) | Simpler data fetching, no HOC wrapper, better TypeScript inference |
| `getStaticProps` + `revalidate` | Server Components + `fetch` cache | Next.js 13 | Granular caching per request, not per page |
| Pages Router | App Router | Next.js 13 stable in May 2023 | File-based layouts, React Server Components, streaming |
| Tailwind 2/3 config.js | Tailwind 4 CSS-based config | Tailwind 4.0 (Dec 2024) | Zero-config content detection, CSS variables for theming |
| Manual head tags | Metadata API | Next.js 13 | Type-safe, supports async fetching, automatic OpenGraph |
| searchParams as object | searchParams as Promise | Next.js 15 (Oct 2024) | Supports async resolution, breaking change for old code |

**Deprecated/outdated:**
- `getServerSideProps`, `getStaticProps`, `getInitialProps`: Replaced by async Server Components
- Tailwind 3 `tailwind.config.js` with `content: []`: Tailwind 4 auto-detects content
- Manual `<Head>` component: Use Metadata API instead
- `next/legacy/image`: Use `next/image` (default since Next.js 13)

## Open Questions

1. **Cursor vs offset pagination semantics**
   - What we know: WEB-06 requires "cursor-based pagination," but our SQLite FTS5 queries use LIMIT/OFFSET
   - What's unclear: Does "cursor-based" mean opaque tokens or just stateless URL-based pagination?
   - Recommendation: Interpret "cursor-based" as "shareable URL state" and use offset-based with `searchParams.page`. This is standard for Next.js and matches the official tutorial pattern.

2. **Featured listings logic**
   - What we know: WEB-01 requires "featured listings" on homepage
   - What's unclear: How are listings marked as featured? (No `featured` column in schema)
   - Recommendation: Use a simple heuristic for Phase 3: "featured" = top 6 by `stars DESC`. Add a `featured` boolean column in Phase 5 if manual curation is needed.

3. **"New this week" implementation**
   - What we know: WEB-07 requires "new this week" driven by ingest timestamp
   - What's unclear: Does "this week" mean last 7 days or current calendar week?
   - Recommendation: Use rolling 7 days (`createdAt >= Date.now() - 7 days`) for simplicity. Sort by `createdAt DESC`.

## Sources

### Primary (HIGH confidence)
- [Context7: /websites/bun](https://bun.com/docs/bundler/fullstack) - Bun.serve() HTML imports, routing, bundler capabilities
- [Context7: /vercel/next.js/v16.1.5](https://github.com/vercel/next.js) - Next.js 16 App Router, Server Components, metadata API
- [Tailwind CSS Next.js Guide](https://tailwindcss.com/docs/guides/nextjs) - Tailwind 4 PostCSS configuration
- [Next.js Metadata and OG Images](https://nextjs.org/docs/app/getting-started/metadata-and-og-images) - Official metadata API docs
- [Next.js Adding Search and Pagination](https://nextjs.org/learn/dashboard-app/adding-search-and-pagination) - Official pagination tutorial

### Secondary (MEDIUM confidence)
- [Fullstack dev server - Bun](https://bun.com/docs/bundler/fullstack) - Verified Bun.serve() routing patterns
- [Simple bun migration guide for LLMs](https://gist.github.com/JaydenWhiley/3ae11db4ac4347788cd13097d4ac473f) - Bun ecosystem migration patterns
- [App Router pitfalls: common Next.js mistakes](https://imidef.com/en/2026-02-11-app-router-pitfalls) - Practical anti-patterns (Feb 2026)
- [React Server Components in Production](https://www.growin.com/blog/react-server-components/) - RSC best practices for 2026
- [Next.js SEO Optimization Guide (2026 Edition)](https://www.djamware.com/post/697a19b07c935b6bb054313e/next-js-seo-optimization-guide--2026-edition) - Current SEO patterns

### Tertiary (LOW confidence)
- [Bun's Speed Hits Latency Snag in Next.js](https://blog.platformatic.dev/bun-is-fast-until-latency-matters-for-nextjs-workloads) - Performance comparison (conflicting data)
- [Alternatives to Pagination on Product-Listing Pages](https://www.nngroup.com/articles/alternatives-pagination-listing-pages/) - UX patterns (not specific to Next.js)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Next.js 16, Tailwind 4, and React 19 are already installed and configured
- Architecture: HIGH - Official Next.js docs and Context7 provide canonical patterns for App Router
- Pitfalls: MEDIUM - Verified via recent blog posts and GitHub discussions, not official docs

**Research date:** 2026-02-19
**Valid until:** 2026-03-21 (30 days — stable domain)
