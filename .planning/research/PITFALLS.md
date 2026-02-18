# Pitfalls Research

**Domain:** Discovery platform / directory / marketplace — AI/Agent/Web3 intersection
**Researched:** 2026-02-18
**Confidence:** MEDIUM-HIGH (web search + official docs verified; protocol-specific claims at LOW where standards are still evolving)

---

## Critical Pitfalls

### Pitfall 1: Chicken-and-Egg Bootstrapping — Catalog Before Community

**What goes wrong:**
The platform launches with zero or near-zero catalog entries, so early visitors find nothing useful and bounce immediately. Without user traffic there is no engagement signal to attract builders who would self-submit. Without self-submissions the catalog stays empty. The cycle stagnates before it starts.

**Why it happens:**
Discovery platforms assume that "if we build the index, they will come." In reality both supply (listed tools/agents) and demand (searchers/browsers) must be seeded simultaneously, or one side collapses. Most teams focus on building the submission form and wait for organic submissions — which don't arrive because there is no reason for a builder to submit to an empty platform.

**How to avoid:**
- Pre-seed the catalog with scraped/synthesized data before launch. Target 200–500 entries in key categories before the first public link goes live.
- Identify 10–20 "anchor" projects (high-profile MCP servers, popular HF Spaces, known Web3 agent frameworks) and feature them prominently. Reach out for voluntary inclusion if possible.
- Pick one tight niche first (e.g., "MCP servers for coding tools") and dominate it before expanding. Narrow niches are easier to fill and signal clarity to early users.
- Build the Telegram discovery bot simultaneously with the web catalog. The bot provides utility even with a small catalog because it is interactive — breadth matters less when the user is getting a direct answer.

**Warning signs:**
- Launch day bounce rate >80% on catalog pages
- Zero organic self-submissions in the first two weeks post-launch
- Average session time < 30 seconds on catalog browse pages
- No return visitors within 7 days

**Phase to address:** Phase 1 (Catalog Foundation) — must be solved before any public launch.

---

### Pitfall 2: Scraping ToS Violations — GitHub, npm, HuggingFace

**What goes wrong:**
The platform relies on scraped data from GitHub, npm, and HuggingFace as its primary catalog source. One or more of those platforms sends a cease-and-desist, rate-bans the scraper's IP block, or blocks the data pipeline. The catalog goes stale or empties. If the aggregation violates ToS and this becomes public, it damages platform credibility.

**Why it happens:**
Developers build scrapers quickly during MVP without reading platform ToS. GitHub's ToS prohibits bulk scraping of public pages; their REST API (5,000 req/hr authenticated, 60 req/hr unauthenticated) is the approved access path. HuggingFace enforces 1,000 API calls per 5-minute window for free users and 100 page requests per 5-minute window — anonymous scraping gets blocked quickly. npm has a public registry API but aggressive scraping of the web UI violates their ToS.

**How to avoid:**
- Use official APIs exclusively, never the web UI: GitHub REST API (authenticated), HuggingFace Hub API with `HF_TOKEN`, npm Registry API (`registry.npmjs.org`).
- Implement exponential backoff and respect `Retry-After` headers. Never hammer an endpoint.
- Cache aggressively: a 24-hour TTL on metadata is sufficient for a discovery catalog; real-time freshness is not needed.
- Do not store raw content (README bodies, model weights, code) — store only metadata (name, description, URL, stars, last update). This is the clearest "public index" use case.
- Check `robots.txt` on every target domain before any scraping. HuggingFace's `robots.txt` as of 2025 allows API access but restricts aggressive crawling of web pages.
- Add a `User-Agent` header identifying your platform (e.g., `AI-Bazaar-Indexer/1.0 (https://aibazaar.dev)`). Anonymous scrapers get banned faster.

**Warning signs:**
- HTTP 429 responses increasing in indexer logs
- IP block notices from target platforms
- Sudden gap in catalog freshness (entries stop updating)
- Legal notices via domain registration contact

**Phase to address:** Phase 1 (Catalog Foundation) — API-only access must be enforced from day one, not retrofitted.

---

### Pitfall 3: Data Freshness Decay — The Stale Catalog Problem

**What goes wrong:**
At launch the catalog is reasonably fresh. Six months later, 30–40% of entries point to dead repos, renamed projects, or deprecated tools. Users discover this when they click through to a project and find a 404 or an archived GitHub repo. Trust collapses. The platform gets associated with dead links rather than discovery.

**Why it happens:**
The indexer runs on a schedule optimized for initial ingestion. After MVP launch, the re-indexing cadence is deprioritized in favor of new features. The AI/agent ecosystem has particularly high churn — many projects go from active to archived within 6–12 months. MCP servers in particular are early-stage and many are experimental.

**How to avoid:**
- Build freshness as a first-class data field, not an afterthought. Every catalog entry stores `last_verified_at`, `last_updated_at` (from the upstream source), and a `health_status` (active/stale/dead).
- Implement a tiered re-indexing schedule: popular entries (top 10% by views/clicks) re-indexed daily, long-tail entries weekly, everything else monthly.
- Surface staleness to users: show "Last verified: 3 days ago" on each entry. Transparency is better than hiding freshness issues.
- Dead-link detection: run weekly HEAD requests against all registered URLs. Auto-flag entries returning 404/410/5xx for manual review or auto-archival.
- Allow and incentivize builders to claim their entry and push updates. Owner-claimed entries are self-maintaining.

**Warning signs:**
- Outbound click-through rate dropping over time (users learn that links don't work)
- Support messages about "project no longer exists"
- GitHub API returning `archived: true` on indexed repos
- Average `last_updated_at` age in catalog exceeds 90 days

**Phase to address:** Phase 1 (Catalog Foundation) for data model; Phase 2 (Indexing Pipeline) for implementation.

---

### Pitfall 4: Protocol Standards Drift — MCP and ACP Are Moving Targets

**What goes wrong:**
The platform categorizes, tags, and generates structured metadata around MCP servers and ACP agents using the spec as understood at build time. In 2025–2026, both protocols are actively evolving: MCP specs updated in June 2025, ACP merged with Google's A2A protocol in September 2025. The platform's taxonomy becomes incorrect or misleading. Worse, hardcoded schema fields become invalid, breaking catalog entries.

**Why it happens:**
MCP was introduced by Anthropic in November 2024 — it is less than 18 months old at time of writing. ACP is even newer. Builders naturally build against these specs; the platform records spec-version-dependent metadata without versioning it. When Anthropic or the Linux Foundation (which now stewards ACP/A2A) publishes breaking changes, the catalog's structured data is wrong.

**How to avoid:**
- Store protocol metadata loosely: use free-text tags and a `protocol_version` field rather than strict enum validation. Do not enforce rigid schema on immature protocol attributes.
- Abstract protocol-specific fields behind a generic `capabilities[]` array. Specific protocol versions can be nested under `metadata.raw`.
- Monitor official changelogs: subscribe to the Anthropic MCP GitHub repo and the Linux Foundation ACP repo for release notifications.
- Design the schema with explicit versioning (`schema_version: "1"`) so migrations can be scripted when protocols solidify.
- Do not build protocol validation logic (e.g., "this server is a valid MCP server") — that is the protocol's job. The catalog is a directory, not a validator.

**Warning signs:**
- Protocol maintainers announce breaking spec changes
- Community reports that catalog "capabilities" tags are incorrect
- New MCP/ACP projects are impossible to categorize under current schema
- Official protocol registry (if one emerges) contradicts the platform's metadata

**Phase to address:** Phase 1 (Catalog Foundation) for schema design; Phase 3 (Protocol Integration) for ongoing monitoring.

---

### Pitfall 5: SEO vs. Programmatic Discovery Tension — Thin Content Deindexing

**What goes wrong:**
The platform generates thousands of catalog pages programmatically (one page per tool, one per tag, one per category). Google treats them as thin content because each page has the same structure with only a name and description changing. Google deindexes 80–95% of the pages within 3 months, destroying organic discovery before it begins. Real example: a travel site created 50,000 "hotels in [city]" pages with only the city name changing — Google deindexed 98% within 3 months.

**Why it happens:**
Aggregators conflate having content with providing value. A catalog entry that mirrors GitHub's own README adds no unique value that Google cannot find at the source. The threshold for indexing is whether a page provides a meaningfully different answer than pages already indexed — replicated metadata does not clear this bar.

**How to avoid:**
- Each catalog page must provide unique value unavailable at the source. Examples: normalized comparison data, cross-protocol compatibility notes, community ratings, usage instructions for Telegram discovery, tags that cut across multiple source platforms.
- Do not create auto-generated tag/category pages until they have at least 10–15 entries with substantive per-entry descriptions. Empty category pages are immediate deindexing targets.
- Prioritize long-tail, intent-specific search terms: "MCP servers for code review" outperforms "MCP servers" as a page target because intent is specific.
- Implement canonical URLs carefully. The Telegram bot and web UI may render the same entry — canonicalize to the web URL to avoid self-competition.
- The Zapier pattern works: thousands of "connect X with Y" pages succeed because each page serves a unique, specific query with real integration instructions. Apply the same logic — catalog pages that answer "how do I use X with Claude?" provide unique value.

**Warning signs:**
- Google Search Console showing low crawl budget usage
- High "Discovered but not indexed" count in Search Console
- Organic traffic flat or declining despite growing catalog
- Google's "Page quality" signals showing "thin content" issues

**Phase to address:** Phase 2 (Public Web Interface) — SEO architecture must be baked in before launch, not added after deindexing happens.

---

### Pitfall 6: The "Graveyard of Directories" — Zero Differentiation

**What goes wrong:**
There are already dozens of AI tools directories (Futurepedia, There's An AI For That, OpenTools, Dang.ai, etc.) and several AI-agent-specific directories. Without differentiation, AI Bazaar becomes one more static list that nobody has a reason to choose over the others. It gets a product hunt launch, a spike of 500 visitors, then dies.

**Why it happens:**
Founders see a gap ("there's no good MCP directory") and build the listing feature without asking "why would someone choose this over just searching GitHub?" The data is the same; the structure is similar; the update cadence is similar. The platform has no defensible advantage.

**How to avoid:**
- The Telegram discovery bot is the primary differentiator — no existing directory offers conversational, contextual discovery inside Telegram where crypto/agent communities already live. Lead with this.
- Web3/permissionless angle is the second differentiator — owner-claimed entries without gatekeeping, on-chain attestations, and community voting are not offered by existing directories.
- MCP + ACP protocol focus (not "all AI tools") is a positioning differentiator. Narrower scope means deeper coverage and more relevant metadata.
- Surface data unavailable elsewhere: protocol compatibility matrices, cross-chain deployment data, community-generated quality signals.
- Never compete on quantity with existing directories. Compete on specificity, freshness, and the Telegram UX.

**Warning signs:**
- Users describe the platform as "like [competitor] but for MCP"
- Zero return visitors after first session
- No clear answer when asked "why this over GitHub search?"
- Self-submissions of generic AI tools (not protocol-specific agents) dominating intake

**Phase to address:** Phase 0 (Positioning/MVP Scope) — differentiation must be locked in before a single line of catalog code is written.

---

### Pitfall 7: Telegram Bot UX Mismatch — Web-Browse Patterns in Chat

**What goes wrong:**
The Telegram bot is designed like a web interface: it lists 10 results with text descriptions, requires users to scroll and read, and uses complex multi-step menus. Telegram users are used to quick, contextual answers. Long message threads, too many inline keyboard buttons, and multi-page results cause drop-off immediately.

**Why it happens:**
Developers build the bot by replicating the web search UX in chat form. Web browsing is exploratory; Telegram messaging is transactional. A user asking "what MCP servers handle file systems?" wants one recommendation with a link, not a paginated catalog.

**How to avoid:**
- Default to 3–5 results maximum per query, not paginated lists. Offer a "show more" only if the user asks.
- Each result message should be self-contained: name, one-line description, protocol, and one link. No walls of text.
- Inline buttons for actions: [Open], [Similar], [Add to list] — not menus with 8 options.
- The bot must handle natural language, not slash-command menus. `/search mcp file system` is friction; "find me an MCP server for file management" is the right UX target.
- Respect Telegram rate limits: 30 messages/second per bot token globally. Do not batch-send results in rapid succession — use `sendMediaGroup` carefully (each item in an album still decrements rate limit).
- Do not store conversation state beyond one exchange in the bot itself. Stateless is faster and avoids memory/session management complexity at zero budget.

**Warning signs:**
- High rate of conversation abandonment after the first bot response
- Users sending "?" or "help" repeatedly — they don't understand the interface
- Telegram API returning 429 errors during peak usage
- Users complaining bot is "slow" (>3 second response latency)

**Phase to address:** Phase 3 (Telegram Bot MVP) — design principles must be defined before bot is built, not iterated post-launch.

---

### Pitfall 8: Web3 Wallet-Gating Killing Discovery

**What goes wrong:**
In an effort to add Web3 credibility, the platform requires wallet connection to browse the catalog, submit entries, or vote on tools. This immediately eliminates the majority of potential users who are developers interested in MCP/agents but not crypto-native. The catalog traffic collapses to a tiny crypto-native audience.

**Why it happens:**
Web3 founders over-index on token/wallet mechanics because it feels native to the ecosystem. The discovery use case does not require a wallet; the curation/reputation use case might. Conflating the two at launch kills user acquisition.

**How to avoid:**
- Wallet is optional, never required, for browsing and searching. The core discovery loop must work anonymously.
- Web3 features (on-chain attestations, token-gated community features, reputation staking) are additive, not gatekeeping.
- Introduce wallet connection only at the point where it provides real user value: "Connect wallet to claim your project listing" or "Connect wallet to see your personalized watchlist."
- Keep the Telegram bot completely wallet-agnostic. Do not require `/start` to include a wallet address.

**Warning signs:**
- Wallet connection prompt appearing on the landing page or catalog browse
- Analytics showing >90% of users abandoning at wallet connect prompt
- GitHub/Reddit/HN community feedback calling the platform "another Web3 cash grab"
- Non-crypto developers refusing to test the product

**Phase to address:** Phase 1 (Catalog Foundation) and Phase 3 (Telegram Bot) — must be enforced as a constraint. Web3 features come in Phase 4+.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Scrape web pages instead of using official APIs | Faster initial data collection | IP bans, ToS violations, pipeline fragility | Never — use official APIs from day one |
| Store full README/description blobs from source | Richer catalog entries | Copyright exposure, storage costs, staleness of large blobs | Never — store metadata pointers only |
| Hard-code MCP/ACP schema fields | Faster catalog build | Schema migration required when protocols update | MVP only, with explicit TODO to abstract |
| Skip dead-link detection | Simpler pipeline | Catalog becomes a graveyard of 404s within 6 months | Never — basic health checks are low cost |
| Single re-index cadence for all entries | Simpler scheduler | Popular entries go stale; rare entries waste quota | Never — tiered re-index is a Phase 1 requirement |
| No `last_verified_at` field | Simpler data model | Impossible to surface freshness to users retroactively | Never — add this field from day one |
| Build Telegram bot as stateful session | Richer multi-step UX | Memory/session management complexity, crash recovery | Never for MVP — stateless by default |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| GitHub API | Using unauthenticated requests (60/hr limit exhausted in minutes) | Always authenticate with a GitHub App or PAT. Use GraphQL for complex queries to reduce request count. |
| HuggingFace Hub | Scraping `huggingface.co` pages (100 page requests / 5 min for free users) | Use Hub API endpoints with `HF_TOKEN`. Free tier: 1,000 API calls / 5 min window. |
| npm Registry | Hitting `npmjs.com` web UI | Use `registry.npmjs.org` directly — it is a public, undocumented-but-stable API with no rate limits documented. |
| Telegram Bot API | Ignoring 429 responses on button callbacks | Acknowledge button callbacks within 15s or users see loading spinner. Always call `answerCallbackQuery` even if you return no data. |
| MCP server discovery | Assuming a central registry exists | No official MCP registry exists as of early 2026. Discovery is GitHub-topic-based (`mcp-server`, `model-context-protocol`) or community list–based. |
| ACP/A2A discovery | Building against IBM's original ACP spec | ACP merged with Google's A2A in September 2025. Target the unified Linux Foundation spec, not the IBM-only draft. |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Fetching all catalog metadata on every Telegram query | Bot response latency >5 seconds | Pre-index all metadata to a local database; bot queries DB, not upstream APIs | At 100 concurrent users |
| No search index (full-text scan on every query) | Catalog search degrades linearly with catalog size | Use SQLite FTS5 (zero infra cost) or Postgres full-text search from day one | At ~5,000 catalog entries |
| Re-indexing all sources synchronously in one job | Indexer job times out; partial updates silently dropped | Break indexer into per-source queued jobs with checkpointing | At ~1,000 entries per source |
| Serving catalog pages server-side on every request | Infrastructure cost, slow renders | Static generation (Next.js SSG or Astro) with ISR for popular pages | At ~10,000 monthly visitors without caching |
| Storing raw GitHub README content | Storage costs, copyright, staleness | Store only: name, description (first 500 chars), URL, stars, last_commit_at, topics | At ~10,000 entries the storage/egress cost becomes visible |

---

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Exposing GitHub PAT or HF_TOKEN in client-side code or repo | Token abuse, API quota exhaustion, account compromise | Store all tokens in server-side env vars only. Never expose in frontend bundles. |
| No rate limiting on catalog self-submission endpoint | Spam flooding, SEO link injection attacks | Add CAPTCHA or proof-of-work on submission. Rate limit by IP. Require GitHub OAuth for submission. |
| Accepting user-submitted URLs without sanitization | Open redirect, SSRF attacks if you preview/fetch submitted URLs server-side | Validate URL format and domain allowlist before any server-side fetch. Never follow redirects blindly. |
| MCP server "test" feature executing user-provided tool calls | Prompt injection, arbitrary code execution risk | If building any "test this MCP server" feature, sandbox execution and never run in the same process as the catalog server. |
| Wallet signature verification without nonce | Replay attacks on wallet-authenticated actions | Always use server-generated nonces in wallet signature challenges. Never verify signature without checking nonce is unused. |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Category pages with <5 entries | Users conclude the catalog is empty; bounce immediately | Hide category pages below the fold or in navigation until they have 10+ entries |
| Search returning zero results with no fallback | Dead-end experience, users leave | Always show "similar searches" or "try broader terms" on zero results |
| Telegram bot requiring users to learn slash commands | High abandonment rate; commands are not discoverable | Support natural language first; slash commands as power-user shortcuts only |
| Hiding protocol version information | Developers cannot assess compatibility | Surface protocol/version as a prominent tag, not buried in metadata |
| No clear "how to submit your project" CTA | Builders don't know they can add their project | Persistent banner: "Built an MCP server? Add it here →" |
| Wallet connect as the first CTA on landing | Non-crypto developers bounce immediately | Landing page leads with search/discovery. Wallet is a secondary feature below the fold. |
| Pagination-heavy catalog browsing | Users don't scroll past page 1 | Infinite scroll with lazy loading; show category summaries first |

---

## "Looks Done But Isn't" Checklist

- [ ] **Catalog Freshness:** Index exists with entries — verify `last_verified_at` is populated AND a scheduled re-index job is actually running in production
- [ ] **Dead Link Detection:** Links appear to work — verify HEAD-request health checks are scheduled and auto-flagging stale entries, not just running in dev
- [ ] **Rate Limit Compliance:** Indexer runs in dev without hitting limits — verify authenticated API tokens are set in production environment and not falling back to anonymous
- [ ] **Telegram Bot Rate Limits:** Bot responds in testing — verify `answerCallbackQuery` is called on ALL button presses, not just ones with data to return
- [ ] **SEO Canonicalization:** Pages are crawlable — verify canonical tags are set and point to the right URL, especially for Telegram bot deep-link landing pages
- [ ] **Self-Submission Flow:** Form exists — verify submissions are actually stored, deduplicated, and appear in catalog after approval (end-to-end test required)
- [ ] **Web3 Optional:** Wallet connect button exists — verify the catalog browse, search, and detail pages all function without wallet connected

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Scraping ban from GitHub/HuggingFace | MEDIUM | Switch to authenticated API immediately. Request ban lift via official support. Implement rate limiting in indexer before re-enabling. |
| Google deindexing catalog pages | HIGH | Submit reconsideration request. Audit all thin pages — add unique value or consolidate/remove. Recovery takes 2–4 months minimum. |
| Protocol schema becomes invalid after MCP/ACP spec change | MEDIUM | Run migration script to set old fields to deprecated. Add new fields with null defaults. Re-index all affected entries. Surface "schema update" notice on affected catalog pages. |
| Telegram bot rate limited (429) under load | LOW | Implement exponential backoff with jitter. Queue outbound messages. Consider secondary bot token for high-volume periods. |
| Catalog goes stale (>30% dead links) | HIGH | Emergency re-index of all entries. Auto-archive entries returning 404 for 30+ days. Add "Report broken link" button to all catalog entries immediately. |
| Zero traction / graveyard outcome | HIGH | This is a product pivot decision, not a technical fix. The earlier the signal (week 2–4 post-launch), the lower the cost to pivot to a different niche or UX. |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Chicken-and-egg bootstrapping | Phase 1: Pre-seed 200+ entries before launch | Catalog has ≥200 entries across ≥5 categories before first public URL shared |
| Scraping ToS violations | Phase 1: API-only indexer | Zero web-UI scraping in indexer codebase; all sources use official API clients |
| Data freshness decay | Phase 1 (data model) + Phase 2 (scheduler) | `last_verified_at` field present; dead-link job running on schedule in production |
| Protocol standards drift | Phase 1: loose schema design | No hard enum validation on protocol-specific fields; `protocol_version` field stored |
| SEO thin content | Phase 2: web interface architecture | Google Search Console showing >50% of catalog pages indexed within 60 days of launch |
| Zero differentiation / graveyard | Phase 0: positioning locked before build | Team can answer "why this over GitHub search?" in one sentence before Phase 1 starts |
| Telegram UX mismatch | Phase 3: bot design principles | Bot returns ≤5 results by default; response latency <3s; no multi-step slash command menus |
| Web3 wallet-gating | Phase 1–3 constraint | Catalog browse + Telegram search both functional without wallet connected |

---

## Sources

- [The #1 Reason Marketplace Startups Fail (Chicken-and-Egg)](https://webmobtech.com/blog/marketplace-startups-fail-chicken-egg/) — MEDIUM confidence (WebSearch)
- [19 Tactics to Solve the Chicken-or-Egg Problem — NFX](https://www.nfx.com/post/19-marketplace-tactics-for-overcoming-the-chicken-or-egg-problem) — MEDIUM confidence (WebSearch)
- [HuggingFace Hub Rate Limits (Official)](https://huggingface.co/docs/hub/en/rate-limits) — HIGH confidence (official docs, September 2025 data)
- [GitHub REST API Rate Limits (Official)](https://docs.github.com/en/rest/using-the-rest-api/rate-limits-for-the-rest-api) — HIGH confidence (official docs)
- [Is Web Scraping Legal in 2025? — Browserless](https://www.browserless.io/blog/is-web-scraping-legal) — MEDIUM confidence (WebSearch)
- [MCP: Model Context Pitfalls — HiddenLayer](https://hiddenlayer.com/innovation-hub/mcp-model-context-pitfalls-in-an-agentic-world/) — MEDIUM confidence (WebSearch)
- [MCP Spec Updates June 2025 — Auth0](https://auth0.com/blog/mcp-specs-update-all-about-auth/) — MEDIUM confidence (WebSearch)
- [ACP Survey — IBM/Linux Foundation](https://arxiv.org/html/2505.02279v1) — MEDIUM confidence (academic, WebSearch)
- [ACP+A2A Merge announcement — September 2025](https://agentcommunicationprotocol.dev/) — LOW confidence (WebSearch, verify with official announcements)
- [Programmatic SEO Traffic Cliff Guide — GetPassionFruit](https://www.getpassionfruit.com/blog/programmatic-seo-traffic-cliff-guide) — MEDIUM confidence (WebSearch)
- [Programmatic SEO Best Practices — SEOmatic](https://seomatic.ai/blog/programmatic-seo-best-practices) — MEDIUM confidence (WebSearch)
- [AI Graveyard — Dang.ai](https://dang.ai/ai-graveyard) — HIGH confidence (primary source, observed phenomenon)
- [Marketplaces in the Age of AI — a16z](https://a16z.com/marketplaces-in-the-age-of-ai-take-two-graveyard-to-greenfield/) — MEDIUM confidence (WebSearch)
- [Telegram Bot API Rate Limits — Official](https://core.telegram.org/bots) — HIGH confidence (official docs)
- [Telegram Limits Reference](https://limits.tginfo.me/en) — MEDIUM confidence (community-maintained)
- [Data Freshness Best Practices — Elementary Data](https://www.elementary-data.com/post/data-freshness-best-practices-and-key-metrics-to-measure-success) — MEDIUM confidence (WebSearch)

---
*Pitfalls research for: AI Bazaar — permissionless AI/Agent/Web3 discovery platform*
*Researched: 2026-02-18*
