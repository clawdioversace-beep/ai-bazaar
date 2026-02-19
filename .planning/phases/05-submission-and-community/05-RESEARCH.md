# Phase 5: Submission and Community - Research

**Researched:** 2026-02-19
**Domain:** Form submission, anonymous voting, background jobs, JSON feeds
**Confidence:** HIGH

## Summary

Phase 5 adds permissionless community engagement to the catalog: web-based submission forms, anonymous upvotes, and a machine-readable JSON feed. The technical foundation is already strong — bunqueue is installed for async jobs, CatalogService has upsertBySourceUrl for deduplication, and the schema includes an upvotes field. The primary challenges are (1) progressive enhancement for forms (working without JavaScript), (2) anonymous upvote tracking without authentication (sessionStorage + server state), and (3) implementing JSON Feed 1.1 for agent crawlers.

**Primary recommendation:** Use Next.js 16 Server Actions for form submission (progressive enhancement built-in), React 19's useOptimistic for instant upvote UI feedback, sessionStorage for client-side vote tracking, bunqueue embedded mode for async enrichment jobs, and Route Handlers for the JSON Feed endpoint.

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js | 16.1.6 | Form handling via Server Actions | App Router Server Actions support progressive enhancement natively — forms submit without JavaScript |
| React | 19 | useOptimistic hook for optimistic updates | React 19's useOptimistic provides instant UI feedback for upvotes while server action is in-flight |
| bunqueue | 2.4.6 | Background job processing | Already installed (Phase 2), zero-dependency SQLite-backed queue perfect for single-server MVP |
| Zod | 3.24+ | Form validation and URL normalization | Already in stack, CatalogEntrySchema already validates and normalizes URLs |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Web Storage API | Native | sessionStorage for upvote tracking | Track which listings user upvoted in current session without authentication |
| JSON Feed | 1.1 | Machine-readable syndication format | Simpler than RSS/Atom, native JSON parsing for agent crawlers |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Server Actions | API Routes | Server Actions are simpler for internal mutations, have built-in progressive enhancement, and provide end-to-end type safety |
| bunqueue | BullMQ | BullMQ requires Redis infrastructure; bunqueue's SQLite backend fits the no-external-deps constraint |
| sessionStorage | localStorage | sessionStorage clears on tab close (desired for anonymous upvotes); localStorage persists indefinitely |
| JSON Feed | RSS/Atom | RSS/Atom require XML parsing; JSON Feed is simpler for agents and browsers to consume |

**Installation:**
```bash
# All dependencies already installed
bun add zod bunqueue  # Already in package.json
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   ├── submit/
│   │   ├── page.tsx           # Submission form page
│   │   └── actions.ts          # Server Actions for form submission
│   ├── api/
│   │   └── feed/
│   │       └── route.ts        # JSON Feed endpoint (Route Handler)
│   └── tools/
│       └── [slug]/
│           └── UpvoteButton.tsx  # Client Component for upvotes
├── services/
│   ├── catalog.ts              # Existing (already has upsertBySourceUrl)
│   └── enrichment.ts           # NEW: Scrape metadata from submitted URLs
├── jobs/
│   └── enrichment-worker.ts    # NEW: bunqueue worker for async enrichment
└── lib/
    └── upvote-tracker.ts       # NEW: sessionStorage utilities
```

### Pattern 1: Progressive Enhancement Form with Server Actions
**What:** HTML form that works without JavaScript, enhanced with useActionState for validation errors
**When to use:** All form submissions in Next.js 16 App Router
**Example:**
```typescript
// Source: https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/forms.mdx
'use server'
import { z } from 'zod'

const schema = z.object({
  url: z.string().url(),
  description: z.string().optional(),
})

export async function submitListing(prevState: unknown, formData: FormData) {
  const validatedFields = schema.safeParse({
    url: formData.get('url'),
    description: formData.get('description'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  // Enqueue enrichment job or create immediately
  // Return success state
  return { success: true }
}
```

Client Component with useActionState:
```typescript
'use client'
import { useActionState } from 'react'
import { submitListing } from './actions'

export function SubmitForm() {
  const [state, action, pending] = useActionState(submitListing, undefined)

  return (
    <form action={action}>
      <input name="url" type="url" required />
      {state?.errors?.url && <p>{state.errors.url}</p>}
      <button disabled={pending}>Submit</button>
    </form>
  )
}
```

### Pattern 2: Optimistic Upvote with sessionStorage + Server Action
**What:** Instant UI feedback on upvote click, with server state sync and session-based duplicate prevention
**When to use:** Anonymous voting without authentication
**Example:**
```typescript
// Source: https://react.dev/reference/react/useOptimistic
'use client'
import { useOptimistic, useTransition } from 'react'
import { upvoteListing } from './actions'

export function UpvoteButton({ listingId, initialUpvotes }: Props) {
  const [isPending, startTransition] = useTransition()
  const [optimisticUpvotes, addOptimisticUpvote] = useOptimistic(
    initialUpvotes,
    (state) => state + 1
  )

  // Check sessionStorage for prior upvote
  const hasUpvoted = sessionStorage.getItem(`upvote_${listingId}`) === 'true'

  async function handleUpvote() {
    if (hasUpvoted) return

    // Optimistic UI update
    startTransition(async () => {
      addOptimisticUpvote(null)
      sessionStorage.setItem(`upvote_${listingId}`, 'true')
      await upvoteListing(listingId)
    })
  }

  return (
    <button onClick={handleUpvote} disabled={hasUpvoted || isPending}>
      {optimisticUpvotes} upvotes
    </button>
  )
}
```

Server Action:
```typescript
'use server'
import { db } from '@/db/client'
import { listings } from '@/db/schema'
import { eq, sql } from 'drizzle-orm'

export async function upvoteListing(id: string) {
  await db.update(listings)
    .set({ upvotes: sql`${listings.upvotes} + 1`, updatedAt: new Date() })
    .where(eq(listings.id, id))
  revalidatePath('/tools')
}
```

### Pattern 3: bunqueue Embedded Mode for Async Enrichment
**What:** Enqueue background jobs in the same process without external dependencies
**When to use:** Async scraping/enrichment of submitted URLs
**Example:**
```typescript
// Source: https://github.com/egeominotti/bunqueue README
import { Queue, Worker } from 'bunqueue/client'

// Initialize queue in embedded mode
const enrichmentQueue = new Queue('enrichment', { embedded: true })

// Define worker
const worker = new Worker(
  'enrichment',
  async (job) => {
    const { url } = job.data
    // Scrape metadata, enrich listing
    const metadata = await scrapeMetadata(url)
    await updateListingMetadata(job.data.listingId, metadata)
    return { enriched: true }
  },
  { embedded: true }
)

// Enqueue job from Server Action
await enrichmentQueue.add('scrape', { url, listingId })
```

### Pattern 4: JSON Feed Route Handler
**What:** Route Handler serving JSON Feed 1.1 format at stable URL
**When to use:** Machine-readable feeds for agents and crawlers
**Example:**
```typescript
// src/app/api/feed/route.ts
import { NextResponse } from 'next/server'
import { getAllListings } from '@/services/catalog'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  const listings = await getAllListings(limit, offset)

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'AI Bazaar - New Listings',
    home_page_url: 'https://aibazaar.dev',
    feed_url: 'https://aibazaar.dev/api/feed',
    description: 'Latest AI/Agent/Web3 tools submitted to AI Bazaar',
    items: listings.map(l => ({
      id: l.id,
      url: `https://aibazaar.dev/tools/${l.slug}`,
      title: l.name,
      content_text: l.description,
      summary: l.tagline,
      date_published: l.createdAt.toISOString(),
      tags: JSON.parse(l.tags),
    })),
  }

  return NextResponse.json(feed, {
    headers: {
      'Content-Type': 'application/feed+json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
```

### Pattern 5: URL Normalization for Deduplication
**What:** Normalize submitted URLs to match CatalogEntrySchema's transform
**When to use:** Before checking if URL already exists in catalog
**Example:**
```typescript
// Already implemented in src/lib/catalog-schema.ts
function normalizeSourceUrl(url: string): string {
  const parsed = new URL(url)
  const normalized = `${parsed.protocol}//${parsed.hostname}${parsed.pathname}`
  return normalized.replace(/\/$/, '') || normalized
}

// Usage in submission flow
const normalizedUrl = normalizeSourceUrl(formData.get('url'))
const existing = await db.query.listings.findFirst({
  where: (l, { eq }) => eq(l.sourceUrl, normalizedUrl),
})
if (existing) {
  return { error: 'This tool is already in the catalog', existingSlug: existing.slug }
}
```

### Anti-Patterns to Avoid
- **Don't use cookies for anonymous upvote tracking** — sessionStorage is simpler and clears on tab close (desired behavior)
- **Don't block form submission on enrichment** — enqueue async job and show success immediately
- **Don't normalize URLs differently in submission vs catalog service** — use CatalogEntrySchema's transform consistently
- **Don't skip progressive enhancement** — form must submit via POST even if JS fails to load
- **Don't expose user IPs or fingerprints in upvote logic** — anonymous means anonymous

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Form validation | Custom validators | Zod (already in stack) | Schema composition, type inference, built-in transforms |
| Background jobs | setTimeout + DB polling | bunqueue (already installed) | Persistence, retries, cron, DLQ — all SQLite-backed |
| Optimistic updates | Manual state sync | React 19 useOptimistic | Built-in rollback, automatic state reconciliation |
| URL normalization | Regex-based parsing | URL() constructor + CatalogEntrySchema | Handles edge cases (punycode, IPv6, ports, etc.) |
| JSON Feed generation | Manual JSON building | Structured schema following jsonfeed.org/version/1.1 | Standard spec, discoverable by feed readers |

**Key insight:** Every problem in this phase already has a production-ready solution — Server Actions for forms, useOptimistic for upvotes, bunqueue for jobs, JSON Feed spec for feeds. Custom solutions add maintenance burden without providing value.

## Common Pitfalls

### Pitfall 1: sessionStorage Not Persisting Across Page Loads
**What goes wrong:** Developer expects sessionStorage to work like localStorage (persists indefinitely), but it clears on tab close
**Why it happens:** sessionStorage is scoped to tab lifetime, not site lifetime
**How to avoid:** This is the desired behavior for anonymous upvotes — users should be able to upvote again in a new session
**Warning signs:** Users complaining they "lost" their upvotes after closing browser

### Pitfall 2: Server Action Called Without JavaScript
**What goes wrong:** Form submits via native POST, but no redirect happens because developer only handled JavaScript case
**Why it happens:** Server Actions work without JS, but redirect() must be called explicitly
**How to avoid:** Always return redirect('/success') from Server Action, or use revalidatePath() + return state for in-page feedback
**Warning signs:** Form submits successfully but user sees blank page or stale data

### Pitfall 3: URL Normalization Mismatch Causes Duplicates
**What goes wrong:** Submitted URL "https://github.com/org/repo/" doesn't match stored "https://github.com/org/repo" (trailing slash difference)
**Why it happens:** Different normalization logic in submission form vs catalog service
**How to avoid:** Use CatalogEntrySchema.parse() in Server Action — let Zod's transform handle normalization consistently
**Warning signs:** Same tool appearing twice with slightly different URLs

### Pitfall 4: Upvotes Counted Multiple Times from Same User
**What goes wrong:** User upvotes, refreshes page, upvotes again — count increments twice
**Why it happens:** sessionStorage is client-side only; server has no record of who voted
**How to avoid:** Check sessionStorage before calling server action, disable button if `upvote_${id}` key exists
**Warning signs:** Suspiciously high upvote counts relative to view counts

### Pitfall 5: JSON Feed Missing Required Fields
**What goes wrong:** Feed readers reject the feed or display broken items
**Why it happens:** Developer missed required fields (version, title, items) or item.id
**How to avoid:** Follow JSON Feed 1.1 spec exactly — version URL must be `https://jsonfeed.org/version/1.1`, every item MUST have unique id
**Warning signs:** Feed validation tools report errors, agent crawlers skip the feed

### Pitfall 6: Enrichment Job Fails Silently
**What goes wrong:** User submits URL, enrichment job throws error, listing never gets metadata
**Why it happens:** No error handling in bunqueue worker
**How to avoid:** Wrap job logic in try/catch, log errors, implement retry strategy with max attempts
**Warning signs:** Listings in catalog with missing fields (stars, description, etc.)

### Pitfall 7: Race Condition on Concurrent Upvotes
**What goes wrong:** Two users upvote simultaneously, counter only increments once
**Why it happens:** Read-modify-write race (fetch current count, add 1, write back)
**How to avoid:** Use SQL atomic increment: `SET upvotes = upvotes + 1` (already in Pattern 2 example)
**Warning signs:** Upvote count grows slower than click events in logs

## Code Examples

Verified patterns from official sources:

### Form Submission with Validation Errors
```typescript
// Source: https://github.com/vercel/next.js/blob/v16.1.6/docs/01-app/02-guides/forms.mdx
'use server'
import { z } from 'zod'
import { redirect } from 'next/navigation'

const SubmissionSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  description: z.string().max(500).optional(),
})

export async function submitListing(prevState: unknown, formData: FormData) {
  const validatedFields = SubmissionSchema.safeParse({
    url: formData.get('url'),
    description: formData.get('description'),
  })

  if (!validatedFields.success) {
    return {
      errors: validatedFields.error.flatten().fieldErrors,
    }
  }

  const { url, description } = validatedFields.data

  // Check for duplicate
  const normalized = normalizeSourceUrl(url)
  const existing = await checkExisting(normalized)
  if (existing) {
    return { errors: { url: [`This tool is already listed at /tools/${existing.slug}`] } }
  }

  // Create listing stub, enqueue enrichment
  const listing = await createListing({ sourceUrl: url, description })
  await enrichmentQueue.add('scrape', { listingId: listing.id, url })

  redirect(`/tools/${listing.slug}`)
}
```

### sessionStorage Utilities
```typescript
// src/lib/upvote-tracker.ts
export function hasUpvoted(listingId: string): boolean {
  if (typeof window === 'undefined') return false
  return sessionStorage.getItem(`upvote_${listingId}`) === 'true'
}

export function markUpvoted(listingId: string): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(`upvote_${listingId}`, 'true')
}

export function clearUpvotes(): void {
  if (typeof window === 'undefined') return
  Object.keys(sessionStorage)
    .filter(key => key.startsWith('upvote_'))
    .forEach(key => sessionStorage.removeItem(key))
}
```

### bunqueue Worker with Error Handling
```typescript
// src/jobs/enrichment-worker.ts
import { Worker } from 'bunqueue/client'
import { scrapeMetadata } from '@/services/enrichment'
import { updateListing } from '@/services/catalog'

const worker = new Worker(
  'enrichment',
  async (job) => {
    const { listingId, url } = job.data

    try {
      const metadata = await scrapeMetadata(url)
      await updateListing(listingId, metadata)
      return { success: true, enriched: Object.keys(metadata).length }
    } catch (error) {
      console.error(`Enrichment failed for ${url}:`, error)
      // Job will be retried based on Worker config
      throw error
    }
  },
  {
    embedded: true,
    connection: undefined,
    autorun: true,
    concurrency: 3,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 50 },
  }
)

export default worker
```

### JSON Feed with Pagination
```typescript
// src/app/api/feed/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getAllListings } from '@/services/catalog'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100)
  const offset = parseInt(searchParams.get('offset') || '0')

  const listings = await getAllListings(limit + 1, offset)
  const hasMore = listings.length > limit
  const items = listings.slice(0, limit)

  const feed = {
    version: 'https://jsonfeed.org/version/1.1',
    title: 'AI Bazaar - New Listings',
    home_page_url: process.env.NEXT_PUBLIC_BASE_URL || 'https://aibazaar.dev',
    feed_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/feed`,
    description: 'Latest AI/Agent/Web3 tools submitted to AI Bazaar',
    items: items.map(l => ({
      id: l.id,
      url: `${process.env.NEXT_PUBLIC_BASE_URL}/tools/${l.slug}`,
      title: l.name,
      content_text: l.description,
      summary: l.tagline,
      date_published: l.createdAt.toISOString(),
      tags: JSON.parse(l.tags),
      _upvotes: l.upvotes, // Custom extension field
    })),
    ...(hasMore && {
      next_url: `${process.env.NEXT_PUBLIC_BASE_URL}/api/feed?limit=${limit}&offset=${offset + limit}`,
    }),
  }

  return NextResponse.json(feed, {
    headers: {
      'Content-Type': 'application/feed+json',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| API Routes for mutations | Server Actions | Next.js 13 (2022) | Built-in progressive enhancement, type safety, simpler DX |
| Manual optimistic state | useOptimistic hook | React 19 (2024) | Automatic rollback, cleaner component code |
| Custom job queues | bunqueue/BullMQ | 2023-2024 | Production-ready persistence, retries, monitoring |
| RSS/Atom feeds | JSON Feed | v1.0 (2017), v1.1 (2020) | Simpler parsing for modern apps, native JSON |
| localStorage for votes | sessionStorage | N/A (both stable) | Session-scoped is better UX for anonymous voting |

**Deprecated/outdated:**
- Pages Router API Routes: Still supported but App Router Server Actions are preferred for new apps
- Custom polling-based job systems: bunqueue and BullMQ provide production-grade features out of the box
- XML-based feeds for new implementations: JSON Feed is simpler unless you need RSS reader compatibility

## Open Questions

1. **Should enrichment be synchronous or async?**
   - What we know: Async via bunqueue allows instant user feedback (form success → redirect to listing)
   - What's unclear: Should we show a "pending enrichment" state in the UI?
   - Recommendation: Async with UI indicator — "⏳ Enriching metadata..." badge on listing page, removed after job completes

2. **How to handle upvote spam prevention beyond sessionStorage?**
   - What we know: sessionStorage prevents double-voting in same session
   - What's unclear: Should we implement server-side rate limiting (e.g., max 10 upvotes per IP per hour)?
   - Recommendation: Start with sessionStorage only for MVP; add server-side limits if abuse detected in metrics

3. **Should JSON Feed include all fields or just essential metadata?**
   - What we know: JSON Feed spec says "Under 100K is ideal, 250K is fine"
   - What's unclear: Do agents need full listing detail or just summary?
   - Recommendation: Include summary fields (name, tagline, tags, URL) — agents can fetch full detail via MCP or web scrape

## Sources

### Primary (HIGH confidence)
- **Next.js 16 Official Docs** - [Server Actions](https://nextjs.org/docs/app/getting-started/updating-data), [Forms Guide](https://nextjs.org/docs/app/guides/forms), [Route Handlers](https://nextjs.org/docs/app/getting-started/route-handlers)
- **React 19 Official Docs** - [useOptimistic Hook](https://react.dev/reference/react/useOptimistic)
- **bunqueue GitHub** - [README](https://github.com/egeominotti/bunqueue), [Documentation](https://bunqueue.dev/)
- **JSON Feed Spec** - [Version 1.1](https://www.jsonfeed.org/version/1.1/)
- **Zod Official Docs** - [URL Validation](https://github.com/colinhacks/zod/blob/main/packages/docs/content/api.mdx), [Refinements](https://context7.com/colinhacks/zod/llms.txt)

### Secondary (MEDIUM confidence)
- **MDN Web Docs** - [sessionStorage](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
- **Medium Articles** - [Next.js App Router Advanced Patterns 2026](https://medium.com/@beenakumawat002/next-js-app-router-advanced-patterns-for-2026-server-actions-ppr-streaming-edge-first-b76b1b3dcac7)
- **Jishu Labs** - [Next.js 15 & 16 Features Migration Guide 2026](https://jishulabs.com/blog/nextjs-15-16-features-migration-guide-2026)

### Tertiary (LOW confidence)
- WebSearch results for optimistic UI patterns (multiple sources agree on useOptimistic best practices)
- WebSearch results for bunqueue vs BullMQ tradeoffs (verified with official docs)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All libraries officially documented, verified in Context7 and official repos
- Architecture: HIGH - Patterns extracted from Next.js 16 official examples and React 19 docs
- Pitfalls: MEDIUM-HIGH - Based on common issues in Next.js/React communities + official warnings

**Research date:** 2026-02-19
**Valid until:** 2026-04-19 (60 days — Next.js and React are stable, JSON Feed spec unchanged since 2020)
