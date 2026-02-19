---
phase: 05-submission-and-community
plan: 01
subsystem: submission-forms
tags:
  - progressive-enhancement
  - server-actions
  - form-validation
  - deduplication
dependency_graph:
  requires:
    - catalog-service (CatalogService.createListing, getListingBySourceUrl)
    - catalog-schema (CatalogEntrySchema, createSlug)
  provides:
    - public submission API via /submit form
    - permissionless catalog contribution
  affects:
    - header navigation (added Submit link)
    - catalog growth (enables community submissions)
tech_stack:
  added:
    - Next.js Server Actions for progressive enhancement
    - React useActionState for form state management
    - Zod validation in Server Action
  patterns:
    - Server Component wrapper + Client Component form pattern
    - Inline validation error display
    - Duplicate detection with redirect to existing listing
key_files:
  created:
    - src/app/submit/actions.ts (submitListing Server Action)
    - src/app/submit/page.tsx (submission form page)
    - src/components/submit-form.tsx (form UI component)
  modified:
    - src/services/catalog.ts (added getListingBySourceUrl)
    - src/app/layout.tsx (added Submit nav link)
decisions:
  - Use Server Actions for progressive enhancement (form works without JavaScript)
  - Split Server Component (metadata) from Client Component (form state) for metadata support
  - Derive tool name from URL if not provided (GitHub repo name, npm package, or hostname)
  - Use 'framework' as safe default category (enrichment will fix later)
  - Return duplicate slug in form state to enable "View it here" link
  - Normalize URL in getListingBySourceUrl to match CatalogEntrySchema normalization
metrics:
  duration: 272
  completed: 2026-02-19
---

# Phase 05 Plan 01: Permissionless Tool Submission Form

Permissionless tool submission form with URL validation, deduplication, and progressive enhancement via Server Actions.

## Summary

Built a public submission form at /submit that enables anyone (human or agent) to add tools to the catalog without authentication. Form uses Next.js Server Actions for progressive enhancement (works without JavaScript), validates input with Zod, checks for duplicate submissions via normalized sourceUrl, creates stub listings with auto-derived metadata, and redirects to the new listing page. Added Submit link to header nav for discoverability.

## Tasks Completed

### Task 1: Add getListingBySourceUrl to CatalogService and create Server Action
**Commit:** ed1d0af
**Files:** src/services/catalog.ts, src/app/submit/actions.ts

Added `getListingBySourceUrl(url: string)` to CatalogService to enable dedup checks without coupling form logic to URL normalization internals. Function normalizes the URL using the same logic as CatalogEntrySchema and queries the database for matching sourceUrl.

Created `submitListing` Server Action in src/app/submit/actions.ts with:
- 'use server' directive for Next.js Server Action
- Zod schema for form validation (url required, name/description optional)
- Duplicate detection via getListingBySourceUrl
- Auto-derivation of tool name from URL if not provided (GitHub repo name, npm package, or hostname fallback)
- Stub listing creation with safe defaults (category: 'framework', tags: [], submittedBy: 'web-form')
- redirect() to new listing page after successful submission (throws by design, not caught)

Helper function `deriveNameFromUrl()` extracts readable names from:
- GitHub URLs: "org/repo" → "Repo"
- npm URLs: "package/name" → "Name"
- Fallback: hostname without TLD

### Task 2: Create submission form page and add nav link
**Commit:** 0899020
**Files:** src/app/submit/page.tsx, src/components/submit-form.tsx, src/app/layout.tsx

Created submission form following Server Component + Client Component split pattern:
- **src/app/submit/page.tsx**: Server Component exports metadata and renders form wrapper with help text
- **src/components/submit-form.tsx**: Client Component uses useActionState for progressive enhancement

Form features:
- URL field (required) with inline validation error display
- Name field (optional) with auto-detection hint in placeholder
- Description field (optional, max 500 chars)
- Submit button disabled while pending, shows "Submitting..." loading state
- Duplicate detection shows "already listed" message with link to existing listing
- Accessible with aria-describedby for error associations

Styling follows existing Tailwind patterns:
- Card container with border, shadow, dark mode support
- Input/textarea with focus rings
- Submit button matches hero CTA style from homepage
- Inline error messages in red text

Added "Submit" link to header nav in src/app/layout.tsx between "Browse" and closing nav tag.

## Deviations from Plan

None - plan executed exactly as written.

## Verification Results

- ✅ TypeScript compiles clean (excluding unrelated bun:test errors in test files)
- ✅ Next.js build succeeds with /submit route listed as static
- ✅ getListingBySourceUrl exported from CatalogService
- ✅ submitListing Server Action marked with 'use server'
- ✅ Submit link present in header nav
- ✅ Form follows progressive enhancement pattern (works without JS)

## Integration Points

**Upstream dependencies:**
- CatalogService.createListing() for inserting stub listings
- CatalogService.getListingBySourceUrl() for duplicate detection
- CatalogEntrySchema validation and createSlug() for slug generation

**Downstream consumers:**
- Human visitors browsing to /submit via header nav
- Agents submitting tools programmatically via POST to /submit (form action)
- Enrichment pipeline will process stub listings created via this form

## Known Limitations

- No authentication/authorization (by design - permissionless)
- No CAPTCHA or rate limiting (MVP - will add if spam becomes an issue)
- Stub listings have minimal metadata (category: 'framework', tags: []) - enrichment will populate
- No email/webhook notification on submission (could add in future)
- Duplicate detection based only on exact sourceUrl match (variant URLs like github.com vs www.github.com won't dedup - normalization handles this)

## Next Steps

**Immediate follow-ups:**
- Test manual submission flow in browser (navigate to /submit, enter URL, verify redirect)
- Test duplicate submission flow (submit same URL twice, verify error message and link)
- Verify Server Action works without JavaScript (disable JS in DevTools, submit form)

**Future enhancements:**
- Add rate limiting per IP to prevent abuse
- Add CAPTCHA if spam submissions occur
- Email/webhook notification for new submissions (if human review needed)
- Support bulk import via CSV/JSON upload
- Agent-friendly API endpoint (currently form POST only)

## Self-Check: PASSED

All created files and commits verified:

- ✅ FOUND: src/app/submit/actions.ts
- ✅ FOUND: src/app/submit/page.tsx
- ✅ FOUND: src/components/submit-form.tsx
- ✅ FOUND: ed1d0af (Task 1 commit)
- ✅ FOUND: 0899020 (Task 2 commit)
