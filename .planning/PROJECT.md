# AI Bazaar

## What This Is

A permissionless discovery platform where AI agents and humans find tools, APIs, and products at the AI/Agent/Web3 intersection. Agents discover new skills and services programmatically via MCP/ACP protocols. Humans browse a curated catalog via website and Telegram bot, with starter packs that get non-technical users from zero to running their first agent. Think Product Hunt meets an agent tool registry — but machine-readable and crypto-native.

## Core Value

Any agent or human can find the right AI/Web3 tool for their need in under 60 seconds — agents via protocol query, humans via search or curated bundle.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] Scraped & curated catalog of AI/Agent/Web3 tools from GitHub, npm, HuggingFace, and similar sources
- [ ] Browsable website with search, categories, and structured product pages
- [ ] MCP/ACP-native discovery protocol so agents can query the catalog programmatically
- [ ] Telegram bot for conversational product discovery and recommendations
- [ ] Permissionless product submission — anyone can list their tool
- [ ] Curated "starter pack" bundles for common use cases (e.g. "automate your DeFi", "launch an AI agent", "build a Telegram bot")
- [ ] Structured metadata per listing (capabilities, pricing, chain support, language, license, API format)
- [ ] Low barrier onboarding for non-technical humans who've never used an agent

### Out of Scope

- Instagram presence — deferred past v1, focus web + Telegram first
- Building/hosting our own tools — pure aggregator model
- Paid features / monetization — build traffic and catalog first, monetize later
- Mobile app — web-first
- User accounts / auth for browsing — frictionless anonymous access initially
- Rating/review system — defer to v2, need traffic first

## Context

- **Founder (Jet)**: Deep crypto/DeFi expertise, strong product instincts, based in Malaysia
- **Existing infrastructure**: Telegram bridge bot (two-way Claude Code chat), OpenClaw agent framework, multi-chain wallets (Solana + EVM), x402 payment protocol familiarity
- **Market timing**: Agent ecosystem is exploding (MCP servers, AI APIs, agent frameworks) but discovery is fragmented — no single directory serves both agents and humans
- **Supply strategy**: Seed catalog by scraping existing directories and repositories, then open permissionless submissions to bootstrap supply side
- **Comparable products**: Product Hunt (human-only, not machine-readable), Awesome lists on GitHub (static, not searchable), MCP server directories (narrow scope), DeFi Llama (data-focused, not discovery-focused)
- **Agent protocol landscape**: MCP (Model Context Protocol) by Anthropic for tool discovery, ACP (Agent Communication Protocol) for agent-to-agent coordination — both emerging standards

## Constraints

- **Tech stack**: TypeScript/Next.js preferred (team's primary stack), Bun runtime
- **Budget**: Zero budget — no paid services without explicit approval. Use free tiers and self-hosted solutions
- **Infra**: Single build server (MacBook) — serverless/managed deployment preferred
- **Data**: No proprietary data sources — only publicly available information for scraping
- **Legal**: Must respect source licenses and terms of service when scraping/aggregating

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Scrape-first catalog | Faster to build supply than waiting for submissions. Bootstrap with existing public data | — Pending |
| MCP/ACP native protocol | Agents are the new browsers — being protocol-native is the moat | — Pending |
| Skip Instagram for v1 | Focus on two surfaces (web + Telegram) to ship faster | — Pending |
| Aggregator model only | Don't compete with listed products — be the neutral discovery layer | — Pending |
| Curated bundles for onboarding | Non-technical users need guided paths, not just a catalog | — Pending |
| Zero-auth browsing | Maximize discovery — no friction for first-time visitors | — Pending |

---
*Last updated: 2026-02-18 after initialization*
