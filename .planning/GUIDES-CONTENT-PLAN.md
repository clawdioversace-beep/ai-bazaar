# AI Bazaar Guides — Content Strategy & Implementation Plan

## Context

AI Bazaar (v1.0 MVP, not yet deployed) is a permissionless discovery platform for AI/Agent/Web3 tools. It already has 3 curated starter packs (DeFi Dev, AI Agent Toolbox, Solana Builder Kit) and a Reads section for external links. Jet wants to add original educational content to onboard beginners, drive traffic, and create natural referral opportunities. This plan covers both the **content strategy** (12 guides) and the **technical implementation** (new `/guides` section on the site).

---

## Part 1: Technical Implementation — `/guides` Section

### Approach: MDX files in repo, rendered via Next.js App Router

Guides are stored as `.mdx` files in `ai-bazaar/content/guides/` with YAML frontmatter. No database changes — content lives in the repo (like packs seed data).

### Files to Create

| File | Purpose |
|------|---------|
| `content/guides/*.mdx` | Guide content files (12 total) |
| `src/lib/guides.ts` | Utility to parse frontmatter, list/filter guides |
| `src/app/guides/page.tsx` | Browse page with category tabs + difficulty filter |
| `src/app/guides/[slug]/page.tsx` | Individual guide page (renders MDX) |
| `src/components/guide-card.tsx` | Card component for browse grid |

### Files to Modify

| File | Change |
|------|--------|
| `src/app/layout.tsx` | Add "Guides" to main nav |
| `src/app/page.tsx` | Add featured guides section to homepage |
| `package.json` | Add `next-mdx-remote` or `@next/mdx` for MDX rendering |

### Frontmatter Schema

```yaml
---
slug: "choosing-your-ai-coding-model"
title: "Which AI Should You Code With?"
tagline: "Claude vs GPT vs Gemini — a no-BS comparison for builders"
difficulty: "beginner"        # beginner | intermediate
readingTime: "8 min"
category: "getting-started"   # getting-started | openclaw | ecosystem | meta
tags: ["models", "claude", "gpt"]
relatedPacks: ["ai-agent-toolbox"]
relatedTools: ["anthropic-claude-mcp"]
publishedAt: "2026-02-25"
nextGuide: "terminal-basics-for-ai-users"
---
```

### Browse Page Categories

| Tab | Guides | Count |
|-----|--------|-------|
| Getting Started | 1, 2, 3, 4 | 4 |
| OpenClaw | 5, 6, 7, 8, 9 | 5 |
| Ecosystem & Tools | 10, 11 | 2 |
| Resources | 12 | 1 |

### Pattern to Follow

- Browse page → model after `/reads/page.tsx` (category tabs, server component)
- Detail page → model after `/packs/[slug]/page.tsx` (scrollytelling layout, related tools at bottom)

---

## Part 2: The 12 Guides

### Wave 1: Foundation (no dependencies)

#### Guide 1: "Which AI Should You Code With?"
**Slug:** `choosing-your-ai-coding-model` | **Category:** Getting Started | **~8 min**

Sections:
1. The 3 models that matter (Claude, GPT, Gemini) — one paragraph each
2. Free tiers compared — what $0 actually gets you
3. Paid plans breakdown — Claude Pro vs ChatGPT Plus vs Gemini Advanced ($20/mo each)
4. AI coding tools (the real power) — Claude Code, Cursor, Copilot, Windsurf
5. Decision tree — budget + use case → recommendation
6. Our pick for beginners

**Links to:** AI Agent Toolbox pack, Cursor/Claude Code tool listings
**Referral potential:** Cursor, Windsurf

---

#### Guide 2: "Terminal Basics for AI Users"
**Slug:** `terminal-basics-for-ai-users` | **Category:** Getting Started | **~12 min**

Sections:
1. Why you need the terminal (AI tools live here)
2. Opening your terminal — macOS, Windows, Linux
3. Navigating the filesystem — `pwd`, `ls`, `cd`, `mkdir`
4. Finding files — basic `find` and `grep`
5. Git in 5 commands — clone, status, add, commit, push
6. Package managers — npm, pip, bun explained
7. Environment variables & `.env` files
8. Common gotchas — permissions, PATH, "command not found"

**Links to:** Developer tools in catalog
**Referral potential:** Warp (AI terminal), iTerm2

---

#### Guide 3: "Keeping Your Stuff Safe: Security for AI Builders"
**Slug:** `security-guide-for-ai-builders` | **Category:** Getting Started | **~7 min**

Sections:
1. The one rule — if it grants access to money/accounts, it's secret
2. What MUST be secret — API keys, private keys, seed phrases, DB passwords (with examples of what each looks like)
3. What's safe to share — source code, configs (without secrets), package.json
4. The `.env` file pattern — how it works, `.env.example`, `.gitignore`
5. Git secrets: the #1 mistake — accidentally committing keys, how to check, how to rotate
6. AI tool safety — what Claude Code/Cursor can see, `.claudeignore`, deny rules
7. Crypto-specific security — wallet keypairs, RPC endpoints, never paste private keys in chat

**Links to:** DeFi Dev Starter pack, Solana Builder Kit pack

---

#### Guide 4: "Your First Win: 5 Projects to Build with AI"
**Slug:** `first-projects-with-ai-coding-tools` | **Category:** Getting Started | **~10 min**

Projects:
1. Personal portfolio site — Claude Code + Vercel, 30 min
2. Telegram bot — simple command bot, teaches API keys
3. Price alert script — CoinGecko API, teaches APIs + env vars
4. MCP server for your notes — teaches MCP protocol basics
5. AI content summarizer — URL → LLM → summary, teaches prompt engineering

Each project: what you'll learn, tools needed, link to AI Bazaar tools

**Links to:** All 3 packs, multiple tool listings
**Referral potential:** Vercel, Railway

---

### Wave 2: OpenClaw Deep Dive (sequential)

#### Guide 5: "Installing OpenClaw: Zero to Running Agent"
**Slug:** `openclaw-installation-guide` | **Category:** OpenClaw | **~10 min**

Sections:
1. What is OpenClaw? — local AI agent framework, personality + memory + tools
2. Prerequisites — macOS/Linux, Node.js 18+, Telegram, Moonshot API key (free)
3. Install steps — exact commands
4. First boot — `openclaw setup`, the BOOTSTRAP.md conversation
5. Connect Telegram — BotFather setup, paste token
6. Verify it works — send message, check workspace created
7. Troubleshooting — port conflicts, API key issues, Telegram not responding

**Requires research:** Actual install commands from OpenClaw repo/docs

---

#### Guide 6: "Choosing Models for OpenClaw"
**Slug:** `openclaw-model-selection` | **Category:** OpenClaw | **~6 min**

Sections:
1. How OpenClaw uses models — gateway routes messages to providers
2. Moonshot/Kimi (default) — free tier, model IDs, best for general tasks
3. Other supported providers — Claude API, GPT API, local models (Ollama)
4. Free vs paid tiers — limits and costs
5. Configuring in `openclaw.json` — where config lives, how to add providers
6. Per-agent model assignment — different agents, different models
7. Cost-saving tips — cheap models for heartbeats, expensive for main sessions

---

#### Guide 7: "OpenClaw Skills and Plugins"
**Slug:** `openclaw-skills-and-plugins` | **Category:** OpenClaw | **~8 min**

Sections:
1. Skills vs plugins — skills = agent capabilities, plugins = gateway extensions
2. Installing a skill — step-by-step
3. Installing a plugin — `openclaw.json` config, extensions directory
4. Essential skills to start with — web search, browser, file management
5. The claude-mem plugin — semantic memory, how to search
6. Building your own skill — high-level overview

---

#### Guide 8: "The .md Files That Define Your Agent"
**Slug:** `openclaw-md-files-explained` | **Category:** OpenClaw | **~9 min**

Sections:
1. The big idea — agent wakes fresh each session, these files ARE its memory
2. **IDENTITY.md** — name, creature type, vibe, emoji
3. **SOUL.md** — core philosophy, behavior rules, boundaries
4. **USER.md** — info about the human, auto-filled over time
5. **AGENTS.md** — workspace instructions, operator mindset
6. **MEMORY.md** — long-term curated memory vs daily notes
7. **TOOLS.md** — local environment notes
8. **HEARTBEAT.md** — periodic check-in config
9. **BOOTSTRAP.md** — first-run conversation script
10. Customizing tips — what to change first, what to leave

---

#### Guide 9: "OpenClaw + Claude Code: Commands Cheat Sheet"
**Slug:** `openclaw-claude-code-shortcuts` | **Category:** OpenClaw | **~6 min**

Sections:
1. OpenClaw CLI — `setup`, `start`, `stop`, `agent`, `config`, `cron`, `plugins`
2. Claude Code slash commands — `/help`, `/clear`, `/compact`, `/model`, `/cost`, `/init`
3. CLAUDE.md power tips — project-level vs user-level, the `.claude/` directory
4. GSD workflow commands — `/gsd:new-project`, `/gsd:quick`, `/gsd:execute-phase`
5. Keyboard shortcuts — submit, cancel, history navigation
6. Combining both — Claude Code as CTO, OpenClaw for autonomous tasks

---

### Wave 3: Ecosystem & Referrals

#### Guide 10: "20 GitHub Repos Every AI Builder Should Star"
**Slug:** `essential-github-repos-ai-builders` | **Category:** Ecosystem | **~8 min**

Categories (4-5 repos each):
1. **MCP Servers** — github-mcp, filesystem-mcp, playwright-mcp, postgres-mcp, brave-search-mcp
2. **Agent Frameworks** — LangGraph, CrewAI, AutoGen, Claude Flow, GPT Researcher
3. **Learning Resources** — MCP-for-beginners (Microsoft), WTF Solidity, Awesome MCP Servers
4. **Developer Tools** — cursor-rules, awesome-claude-code, ai-coding-templates
5. **Web3 + AI** — solana-ai-agent, multi-chain-agent-sdk, defi-hack-labs

Each repo: 1-2 sentence description + link to AI Bazaar listing

**Links to:** All 3 packs, full catalog

---

#### Guide 11: "The AI Builder's App Stack"
**Slug:** `recommended-apps-ai-builders` | **Category:** Ecosystem | **~7 min**

Categories:
1. **Code editors** — VS Code (free), Cursor (freemium), Windsurf
2. **Terminal** — iTerm2, Windows Terminal, Warp
3. **API testing** — Bruno (open source), Postman
4. **Deployment** — Vercel, Railway, Fly.io
5. **Database** — Turso, Supabase, PlanetScale
6. **AI assistants** — Claude Pro, ChatGPT Plus, Perplexity Pro
7. **Communication** — Telegram, Discord
8. **Notes & project management** — Notion, Obsidian, Linear

---

#### Guide 12: "Our Favorite Tools (With Referral Links)"
**Slug:** `recommended-tools-with-referrals` | **Category:** Resources | **~5 min**

Transparent referral page — "we earn a commission, we only list tools we actually use."

**Known referral programs to research & include:**

| Tool | Category | Referral Program | Notes |
|------|----------|-----------------|-------|
| Cursor | Code editor | Yes (confirmed) | AI-native editor, popular |
| Windsurf | Code editor | Research needed | Codeium's editor |
| Vercel | Deployment | Yes (confirmed) | Free tier is generous |
| Railway | Deployment | Yes (confirmed) | Simple deploy |
| Supabase | Database | Yes (confirmed) | Postgres + auth |
| Turso | Database | Research needed | SQLite edge |
| Claude Pro | AI assistant | Research needed | Anthropic subscription |
| ChatGPT Plus | AI assistant | Research needed | OpenAI subscription |
| Perplexity Pro | AI search | Research needed | AI research tool |
| Helius | Solana RPC | Research needed | Web3 infra |
| Alchemy | Multi-chain | Research needed | Web3 infra |
| Warp | Terminal | Research needed | AI-native terminal |
| Notion | Notes | Yes (confirmed) | Workspace tool |
| Linear | PM | Research needed | Project management |
| Brave Search API | API | Research needed | For agent web search |

**Referral integration across all guides:** When a guide naturally recommends a tool that has a referral program, the link routes through AI Bazaar's existing `/go/[slug]` redirect system (uses `affiliateUrl` column on `listings` table + `clicks` table for tracking).

---

## Part 3: Creation Order

| Wave | Guides | Why First |
|------|--------|-----------|
| **1 — Foundation** | 1 (Models), 2 (Terminal), 3 (Security), 4 (First Projects) | Entry points, no dependencies, highest search volume |
| **2 — OpenClaw** | 5 (Install), 6 (Models), 8 (.md Files), 7 (Skills), 9 (Shortcuts) | Sequential learning path, depends on Wave 1 |
| **3 — Ecosystem** | 10 (GitHub repos), 11 (App stack), 12 (Referrals) | References tools from all other guides, monetization layer |

---

## Part 4: Implementation Phases

### Phase A: Technical setup
- Add MDX support to AI Bazaar (`next-mdx-remote` or `@next/mdx`)
- Create `content/guides/` directory structure
- Build `src/lib/guides.ts` utility (parse frontmatter, list/filter)
- Build `/guides` browse page and `/guides/[slug]` detail page
- Add "Guides" to nav and homepage section

### Phase B: Write Wave 1 content (4 guides)
- Write guides 1-4 as MDX files
- Add related pack/tool links
- Test rendering and navigation

### Phase C: Write Wave 2 content (5 guides)
- Research OpenClaw installation flow
- Write guides 5-9
- Add cross-references between OpenClaw guides

### Phase D: Write Wave 3 content (3 guides)
- Research referral programs for all tools in the list
- Write guides 10-12
- Set up affiliate URLs in listings table for referral tools

### Phase E: Polish & ship
- SEO metadata (generateMetadata for each guide)
- Open Graph images for social sharing
- Content calendar integration (guide promotion tweets)

---

## Verification

- All 12 guides render correctly at `/guides/[slug]`
- Browse page filters by category and difficulty
- Related packs/tools link correctly to existing pages
- Guide navigation (prev/next) works across the sequence
- Mobile responsive
- SEO metadata generates correctly
- Referral links route through `/go/[slug]` with click tracking
