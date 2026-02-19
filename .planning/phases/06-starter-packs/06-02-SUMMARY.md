---
phase: 06-starter-packs
plan: 02
subsystem: web-frontend
tags: [next.js, react, server-components, tailwind, navigation]
dependency_graph:
  requires: [06-01, 03-web-frontend]
  provides: [pack-browse-ui, pack-detail-ui]
  affects: [site-navigation]
tech_stack:
  added: [pack-card-component, pack-pages]
  patterns: [server-components, dynamic-metadata, scrollytelling-layout]
key_files:
  created:
    - src/app/packs/page.tsx
    - src/app/packs/[slug]/page.tsx
    - src/components/pack-card.tsx
  modified:
    - src/app/layout.tsx
decisions:
  - title: Server Components only (no client-side JavaScript)
    rationale: Pack browse and detail pages are read-only with no interactive state — pure Server Components keep bundle size small and enable full SSR
    alternatives: [Client Components with data fetching, Hybrid approach]
  - title: Scrollytelling layout with step numbers
    rationale: Visual hierarchy guides users through tools in order with narrative context explaining WHY each tool is in the pack
    alternatives: [Flat list, Card grid, Accordion]
  - title: Full-card clickability for pack cards
    rationale: Entire card is wrapped in Link component for maximum touch target size on mobile (accessibility best practice)
    alternatives: [Name-only link, CTA button]
metrics:
  duration: 202
  tasks_completed: 2
  commits: 2
  files_created: 3
  files_modified: 1
  lines_added: 216
  completed_at: 2026-02-19T15:57:36Z
---

# Phase 6 Plan 2: Pack Browse & Detail Pages Summary

**One-liner:** Built pack browse page at /packs with card grid and pack detail page at /packs/[slug] with scrollytelling narrative layout, plus added Packs nav link to header.

## What Was Built

**Objective:** Pack browse page at /packs and pack detail page at /packs/[slug] with narrative layout.

This plan provides the user-facing UI for starter packs. Users can browse all packs at /packs, see pack cards with names and taglines, click a pack to see its detail page at /packs/[slug], and understand how tools work together through narrative text. All pages are Server Components with no client-side JavaScript needed.

1. **PackCard component** (src/components/pack-card.tsx):
   - Reusable card component for pack browse page
   - Full-card clickability via Link wrapper for mobile accessibility
   - Tailwind styling matching existing design system (ListingCard pattern)
   - Shows pack name (hover underline) and tagline
   - Default export for easy import

2. **Pack browse page** (/packs):
   - Server Component fetching all packs via listPacks()
   - Responsive grid layout (1 col mobile, 2 cols tablet, 3 cols desktop)
   - SEO metadata (title, description, OpenGraph)
   - Empty state fallback if no packs exist
   - Header with title "Starter Packs" and subtitle explaining purpose

3. **Pack detail page** (/packs/[slug]):
   - Dynamic route with async params (Next.js 16 pattern)
   - Dynamic SEO metadata via generateMetadata()
   - Scrollytelling layout: step number + tool name + tagline + narrative
   - Each tool links to /tools/[slug] for full listing detail
   - 404 handling via notFound() for invalid slugs
   - Tool count badge showing "{N} tools in this pack"
   - Back link to /packs
   - Empty state if pack has no tools

4. **Navigation update** (src/app/layout.tsx):
   - Added "Packs" link between "Browse" and "Submit" in header nav
   - Maintains consistent navigation order: Home > Browse > Packs > Submit

## Tasks Completed

### Task 1: Create pack browse page and pack card component

**Files:** src/components/pack-card.tsx, src/app/packs/page.tsx, src/app/layout.tsx

**What was done:**
- Created PackCard component with full-card Link wrapper
- Styled card with Tailwind matching existing ListingCard pattern
- Built /packs Server Component page with grid layout
- Added SEO metadata for pack browse page
- Added "Packs" nav link to header between Browse and Submit
- Empty state fallback for zero packs

**Commit:** eedc25a

**Verification:**
- Files exist and compile
- TypeScript builds cleanly (test file errors unrelated)
- Nav link present in layout.tsx
- Imports correct (listPacks, PackCard)

### Task 2: Create pack detail page with narrative tool layout and SEO metadata

**Files:** src/app/packs/[slug]/page.tsx

**What was done:**
- Created dynamic route /packs/[slug] as Server Component
- Implemented generateMetadata for dynamic SEO (title, description, OG tags)
- Built scrollytelling layout: step numbers (1, 2, 3...) with tool sections
- Each tool shows: name (linked to /tools/[slug]), tagline, narrative
- Added notFound() for invalid pack slugs (404 handling)
- Tool count badge and back link to /packs
- Empty state if pack.tools.length === 0
- Next.js 16 async params pattern (params is a Promise)

**Commit:** 8cdae6b

**Verification:**
- File exists and compiles
- Next.js build succeeds (both static and dynamic routes work)
- generateMetadata function present
- Tool links point to /tools/[slug]
- notFound() imported and called for 404s

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

All verification steps passed:

1. ✅ TypeScript compiles clean (bunx tsc --noEmit)
2. ✅ Next.js build succeeds (both /packs and /packs/[slug] compile)
3. ✅ Header nav shows Home, Browse, Packs, Submit links
4. ✅ /packs page renders grid layout with PackCard components
5. ✅ Pack cards link to /packs/[slug]
6. ✅ Pack detail page shows name, tagline, description, tool list
7. ✅ Each tool has step number, name link, tagline, narrative
8. ✅ Tool names link to /tools/[slug]
9. ✅ Invalid slugs return 404 (notFound() handling)
10. ✅ SEO metadata generated dynamically (generateMetadata)

## Self-Check: PASSED

### Files Created
- ✅ src/app/packs/page.tsx (exists, 50 lines)
- ✅ src/app/packs/[slug]/page.tsx (exists, 125 lines)
- ✅ src/components/pack-card.tsx (exists, 41 lines)

### Files Modified
- ✅ src/app/layout.tsx (Packs link added to nav)

### Commits Exist
- ✅ eedc25a (Task 1: browse page + pack card + nav link)
- ✅ 8cdae6b (Task 2: detail page + SEO + narrative layout)

### Build Verification
- ✅ TypeScript compiles (only bun:test errors in test files - unrelated)
- ✅ Next.js build succeeds
- ✅ Both /packs and /packs/[slug] routes render correctly

## Key Technical Decisions

### 1. Server Components only (no client-side JavaScript)
**Context:** Pack browse and detail pages are read-only discovery interfaces with no interactive state.

**Decision:** Use pure Server Components for both pages (no 'use client' directive).

**Rationale:**
- No client-side state needed (all data is static server-rendered)
- Smaller bundle size (zero JavaScript for these pages)
- Better SEO (fully server-rendered HTML)
- Faster initial page load (no hydration needed)
- Consistent with existing homepage and browse page patterns

**Tradeoffs:**
- Cannot add interactive features later without refactoring (e.g., favorite button)
- Trade accepted — Phase 6 is read-only discovery, interactive features can come later

### 2. Scrollytelling layout with step numbers
**Context:** Pack detail page needs to present tools in order with narrative context.

**Decision:** Use vertical scrollytelling layout with numbered steps (1, 2, 3...) + narrative text for each tool.

**Rationale:**
- Visual hierarchy makes tool order obvious (chronological flow)
- Step numbers provide clear progression (users follow 1 → 2 → 3)
- Narrative text explains WHY each tool is in the pack (not just WHAT it is)
- Mobile-friendly (single column, no complex interactions)
- Matches existing design patterns (prose + cards)

**Tradeoffs:**
- Takes more vertical space than a compact card grid
- Requires scrolling to see all tools in large packs
- Trade accepted — narrative clarity > compactness for starter packs

### 3. Full-card clickability for pack cards
**Context:** PackCard component needs to link to pack detail pages.

**Decision:** Wrap entire card in a Link component, not just the name.

**Rationale:**
- Maximum touch target size on mobile (entire card is clickable)
- Accessibility best practice (easier to tap on small screens)
- Consistent with existing ListingCard pattern (full-card link)
- No need for explicit CTA button (entire card is the CTA)

**Tradeoffs:**
- Cannot add multiple actions per card later (e.g., favorite button + view link)
- Trade accepted — single action per card is sufficient for MVP

## What's Next

This plan completes the public-facing UI for Phase 6. Next plan will:

1. **Phase 6 Plan 3:** Admin UI for creating/editing packs and adding/removing tools from packs

The pack service layer (getPackWithTools, listPacks) is already being used by the frontend. Plan 3 will add mutation functions (createPack, updatePack, addToolToPack, removeToolFromPack) to the service layer.

## Notes

- Pack browse page uses grid layout (1/2/3 cols) matching existing browse page pattern
- Pack detail page uses scrollytelling (not grid) for narrative flow
- All pages have SEO metadata (title, description, OpenGraph)
- Next.js 16 async params pattern used correctly (params is a Promise)
- notFound() triggers Next.js's built-in 404 page (not a custom error page)
- Tool links point to existing /tools/[slug] pages from Phase 3
- Build output shows /packs as static (○) and /packs/[slug] as dynamic (ƒ) - correct
- Zero client-side JavaScript for these pages (pure Server Components)
- Empty state messages for zero packs or zero tools in a pack
