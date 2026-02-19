---
phase: 03-web-frontend
plan: 01
subsystem: web-ui
tags: [next.js, server-components, tailwind, homepage, layout]

dependency_graph:
  requires: [02-03]
  provides: [root-layout, listing-card, category-nav, homepage]
  affects: [03-02, 03-03]

tech_stack:
  added:
    - Next.js 16 App Router (Server Components)
    - Tailwind CSS utility classes
  patterns:
    - Server-side data fetching (async Server Components)
    - Component composition (ListingCard, CategoryNav reused across pages)
    - Service layer pattern (SearchService provides data, page renders)

key_files:
  created:
    - src/components/listing-card.tsx
    - src/components/category-nav.tsx
  modified:
    - src/app/layout.tsx
    - src/app/page.tsx
    - src/app/globals.css
    - src/services/search.ts

decisions:
  - decision: Add getFeaturedListings and getNewThisWeek to SearchService rather than querying db directly in page.tsx
    rationale: Maintains service-only DB access pattern from Phase 1. Pages never import db client.
    alternatives: Direct db import in page, but violates architecture pattern
  - decision: Server Components only (no 'use client' directive)
    rationale: All data is fetched server-side. No client-side state or interactivity needed for homepage.
  - decision: Responsive grid with 1/2/3 columns
    rationale: Mobile-first design. Single column on mobile, 2 on tablet, 3 on desktop for optimal card layout.

metrics:
  duration_minutes: 4
  tasks_completed: 2
  files_created: 2
  files_modified: 4
  commits: 2
  completed_at: 2026-02-19T03:29:35Z
---

# Phase 03 Plan 01: Homepage & Root Layout Summary

**Built homepage with featured listings, new-this-week section, and category navigation using Next.js 16 Server Components with real catalog data (3,259 listings)**

## What Was Built

### Root Layout (src/app/layout.tsx)
- Responsive header with "AI Bazaar" branding and navigation (Home, Browse)
- Footer with copyright year
- Proper metadata: title "AI Bazaar - Discover AI, Agent & Web3 Tools"
- Geist Sans/Mono fonts configured
- Max-width container (max-w-7xl) for main content
- Dark mode support via Tailwind

### Reusable Components

**ListingCard (src/components/listing-card.tsx)**
- Displays: name (linked to /tools/{slug}), tagline (truncated to 2 lines), category badge, stars with icon
- Optional fields: runtime badge, chain support badges, first 3 tags as pills
- Responsive: full width on mobile, adapts to grid on desktop
- JSON parsing for tags and chainSupport arrays
- Null safety for stars field
- Server Component (no client-side JS)

**CategoryNav (src/components/category-nav.tsx)**
- Horizontal scrollable on mobile, wrapping grid on desktop
- Each category shows label + count badge
- Links to /tools?category={slug}
- Server Component

### Homepage (src/app/page.tsx)
- Hero section: headline, subtitle, "Browse All Tools" CTA
- Featured listings: top 6 by stars in 1/2/3 column responsive grid
- New this week: listings from last 7 days, max 12, with empty state message
- Category navigation: all 6 categories with counts
- All data fetched server-side via SearchService functions
- No client-side JavaScript for data fetching

### Service Layer Extensions (src/services/search.ts)
- Added `getFeaturedListings(limit = 6)`: returns top listings by stars, deadLink=false
- Added `getNewThisWeek(limit = 12)`: returns listings created in last 7 days, sorted by createdAt desc

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All must-haves verified:

1. **Build passes**: `bun run build` completes with no type errors
2. **AI Bazaar branding**: Metadata title and header/footer contain "AI Bazaar"
3. **Component exports**: ListingCard and CategoryNav exported correctly
4. **Service layer usage**: Homepage imports getFeaturedListings, getNewThisWeek, countByCategory
5. **Real data**: Tested with 3,259 catalog entries (featured shows top by stars, new shows last 7 days)
6. **Server Components**: No 'use client' directive in any file
7. **Responsive design**: Tailwind classes for 1/2/3 column grids on mobile/tablet/desktop
8. **Category navigation**: Links point to /tools?category={slug} with CATEGORY_LABELS

## Testing

Manual verification:
- Featured listings query: returns n8n-io/n8n (175,208 stars), kubernetes/kubernetes (120,610 stars), google-gemini/gemini-cli (94,825 stars)
- New this week query: returns 3 listings created on 2026-02-19
- Category counts: mcp-server (898), framework (619), infra (526), defi-tool (510), web3-tool (356), ai-agent (350)

## Next Steps

Plan 03-02 will build the browse page (/tools) with:
- Category filtering via searchParams.category
- Pagination support
- Reuses ListingCard and CategoryNav components from this plan

## Self-Check: PASSED

**Created files verification:**
- FOUND: src/components/listing-card.tsx
- FOUND: src/components/category-nav.tsx

**Modified files verification:**
- FOUND: src/app/layout.tsx
- FOUND: src/app/page.tsx
- FOUND: src/app/globals.css
- FOUND: src/services/search.ts

**Commits verification:**
- FOUND: b71b375 (feat(03-01): add root layout with header/footer and reusable listing components)
- FOUND: 5b803cf (feat(03-01): implement homepage with featured listings and new-this-week)

All claims verified. No missing files or commits.
