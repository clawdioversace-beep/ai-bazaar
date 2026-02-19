# AI Bazaar

## What This Is

A permissionless discovery platform where AI agents and humans find AI/Agent/Web3 tools. Agents discover tools programmatically via MCP protocol at `/api/mcp`. Humans browse a curated catalog via website with search, filters, and starter packs. Anyone can submit a tool — no account required.

## Core Value

Any agent or human can find the right AI/Web3 tool for their need in under 60 seconds — agents via MCP protocol query, humans via search or curated bundle.

## Current State

**Version:** v1.0 MVP (shipped 2026-02-19)
**Codebase:** 6,103 LOC TypeScript | Next.js 16 + Drizzle ORM + libSQL/Turso
**Status:** Feature-complete, not yet deployed

**What's built:**
- Catalog foundation with SQLite FTS5 search and service layer
- Scraping pipeline (GitHub, npm, HuggingFace) — 200+ entries pre-seeded
- Web frontend with browse, search, filters, listing detail, SEO
- MCP protocol endpoint for agent discovery (3 tools + 1 resource)
- Permissionless submission form + anonymous upvotes + JSON Feed 1.1
- 3 curated starter packs with narrative tool bundles

**Not yet done:**
- Production deployment (Vercel)
- Domain setup (aibazaar.dev or similar)
- Running scrapers with real API tokens (GitHub PAT, HF_TOKEN needed)
- Upvotes migration on production DB
- Telegram bot (deferred to v2)

## Requirements

### Validated

- ✓ CAT-01 through CAT-07: Catalog data model, FTS5 search, tags, categories, dead-link detection — v1.0
- ✓ SCRP-01 through SCRP-07: GitHub/npm/HuggingFace scrapers, normalizers, dedup, pre-seed, cron — v1.0
- ✓ WEB-01 through WEB-08: Homepage, browse, filters, mobile-responsive, SEO, pagination — v1.0
- ✓ MCP-01 through MCP-06: MCP server, search/get/submit tools, resource, pagination — v1.0
- ✓ SUB-01 through SUB-04: Submission form, dedup, upvotes, JSON feed — v1.0
- ✓ PACK-01 through PACK-04: 3 starter packs, browse page, detail page — v1.0

### Active

- [ ] Production deployment to Vercel with CI/CD
- [ ] Custom domain setup
- [ ] API tokens provisioned for scrapers (GitHub PAT, HF_TOKEN)
- [ ] Telegram bot for conversational discovery (TG-01 through TG-04)
- [ ] Semantic/embedding-based search for natural language queries
- [ ] Composite "Bazaar score" quality metric

### Out of Scope

- Instagram presence — deferred past v1, focus web + MCP first
- Building/hosting our own tools — pure aggregator model
- Paid features / monetization — build traffic and catalog first
- Mobile app — web-first, responsive design works well
- User accounts / auth for browsing — frictionless anonymous access
- Full review/comment system — simple upvotes sufficient for now
- ACP/A2A protocol — deferred until spec stabilizes

## Context

- **Founder (Jet)**: Deep crypto/DeFi expertise, strong product instincts, based in Malaysia
- **Infrastructure**: Dedicated build server (MacBook), Telegram bridge bot, OpenClaw agent framework
- **Market timing**: Agent ecosystem exploding — MCP becoming standard, no single directory serves both agents and humans
- **Deployment pending**: Vercel Hobby plan (non-commercial). Upgrade to Pro ($20/mo) if monetization added.

## Constraints

- **Tech stack**: TypeScript/Next.js 16, Drizzle ORM, libSQL/Turso, Tailwind CSS, Bun runtime
- **Budget**: Zero budget — no paid services without Jet's approval
- **Infra**: Single build server — serverless deployment preferred (Vercel)
- **Data**: Only publicly available information for scraping
- **Critical rule**: drizzle-kit push BANNED — destroys FTS5 virtual tables. Use manual migrations only.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scrape-first catalog | Bootstrap supply with existing public data before opening submissions | ✓ Good — 200+ entries pre-seeded |
| MCP protocol endpoint | Agents are the new browsers — protocol-native discovery is the moat | ✓ Good — 3 tools working, verified |
| Skip Instagram for v1 | Focus on web + MCP to ship faster | ✓ Good — shipped in 2 days |
| Aggregator model only | Don't compete with listed products — neutral discovery layer | ✓ Good — clear value prop |
| Curated starter packs | Non-technical users need guided paths, not just a catalog | ✓ Good — 3 packs with narrative |
| Zero-auth browsing | Maximize discovery — no friction for first-time visitors | ✓ Good — all features anonymous |
| drizzle-kit push banned | Silently destroys FTS5 virtual tables not in schema.ts | ✓ Good — prevented data loss |
| Manual SQL migrations | Custom migration runner needed for FTS5 triggers and BEGIN blocks | ✓ Good — 3 migrations clean |
| Server Components default | Data fetching on server, Client Components only for interactivity | ✓ Good — fast pages, good SEO |
| sessionStorage for upvotes | Tab-scoped anonymous tracking, no auth needed | ✓ Good — simple, effective |
| JSON Feed 1.1 | Maximum interoperability with feed readers and agent crawlers | ✓ Good — standard spec |
| Static seed for starter packs | CMS premature for 3-5 packs — seed script sufficient | ✓ Good — no overengineering |

---
*Last updated: 2026-02-19 after v1.0 milestone*
