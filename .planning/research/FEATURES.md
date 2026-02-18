# Feature Research

**Domain:** AI/Agent/Web3 discovery and directory platform (dual-audience: AI agents + humans)
**Researched:** 2026-02-18
**Confidence:** MEDIUM (WebSearch-verified; ecosystem is moving fast, some details LOW confidence)

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete or broken.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Searchable catalog | Every directory since 2010 has search; users arrive with a query in mind | LOW | Full-text across name, description, tags, category |
| Category/tag browsing | npm, HuggingFace, Product Hunt all use it; the mental model is established | LOW | Hierarchical categories + flat tag cloud |
| Listing detail page | Users need enough context to evaluate before clicking through | LOW | Name, description, URL, tags, category, last updated, source repo link |
| Curated "new this week" feed | Product Hunt proved this drives daily active users and return visits | LOW | Automated from ingest pipeline; no manual curation needed at v1 |
| Submission form (permissionless) | Users expect to self-list; gatekeeping is a conversion killer | LOW | URL + minimal metadata; auto-enrichment via scrape |
| Filter by category/chain/protocol | DeFi Llama proves filtered browsing is the primary UX for technical audiences | MEDIUM | Multi-select filters; filter state in URL for shareability |
| Listing metadata: status indicators | HuggingFace shows model downloads/likes; npm shows weekly downloads; users need trust signals | LOW | GitHub stars, last commit date, npm downloads (pulled from source) |
| Sort by recency / popularity | Standard across all comparable platforms | LOW | Recency = ingest timestamp; popularity = upvotes or external metric |
| Basic upvote / reaction | Product Hunt's core mechanic; users expect a way to signal quality | LOW | Simple upvote; no downvote at v1 (reduces complexity and toxicity) |
| Pagination or infinite scroll | Required once catalog exceeds ~50 items | LOW | Cursor-based pagination aligns with MCP Registry spec as well |
| Mobile-responsive web UI | Majority of drive-by traffic is mobile | LOW | Next.js + Tailwind handles this |
| Shareable listing URLs | SEO and word-of-mouth both require stable, clean URLs | LOW | `/tools/[slug]` pattern |
| RSS or JSON feed | Power users and agent crawlers both expect a machine-readable feed of new listings | LOW | JSON feed is easy; doubles as lightweight MCP endpoint |

### Differentiators (Competitive Advantage)

Features that set AI Bazaar apart from Product Hunt clones, generic awesome-lists, and single-protocol MCP registries.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| MCP/ACP native protocol endpoint | AI agents can query the catalog at runtime without scraping; no competitor offers this for the AI/Web3 cross-section | HIGH | REST API + structured schema per MCP registry spec; .well-known metadata URL; cursor pagination |
| Scrape-first catalog auto-population | Permissionless without requiring humans to submit; catalog reaches critical mass instantly | HIGH | Ingest pipeline targeting GitHub topics (mcp-server, ai-agent, web3), npm search, HuggingFace model hub API |
| Dual-audience rendering | Same data served as human-readable HTML and machine-readable JSON/MCP schema; competitors pick one or the other | MEDIUM | Content negotiation (Accept header or /api/ prefix) |
| Curated "starter packs" (bundles) | Non-technical users don't know where to start; bundles lower the activation barrier; no comparable in the space | MEDIUM | Pre-defined thematic bundles: "DeFi dev starter", "AI agent toolbox", "Solana builder kit" — links 5-10 tools with a narrative |
| Telegram bot for conversational discovery | Meets Jet's existing audience (crypto Twitter / Telegram-native users) where they already are; rare among directories | MEDIUM | Natural language query → ranked results → shareable links; Telegram native format |
| On-chain / verifiable metadata layer | Web3 users distrust centralized curation; verified on-chain contract addresses or ENS links on listings add trust | HIGH | Optional field; pull from chain explorers if contract address provided |
| Agent-to-agent discovery (A2A) | Agents finding other agents to delegate subtasks; aligns with Google A2A and AWS Marketplace protocol direction in 2025 | HIGH | Requires agent identity + capability schema; defer past v1 but design schema to accommodate |
| Quality signal aggregation | Aggregate GitHub stars + npm downloads + HuggingFace likes + upvotes into a composite "Bazaar score" | MEDIUM | Weighted formula; avoids single-source gaming; surfaces hidden gems |
| Collection lists (user-curated lists) | Power users want to share their "top 10 MCP servers for X" — drives SEO and community; awesome-list killer | MEDIUM | Public lists with title/description + items; shareable URL |
| Semantic / embedding-based search | Keyword search fails for "find me a tool that does X" queries from both humans and agents | HIGH | pgvector or Pinecone for embedding search; fallback to keyword always available |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create more problems than they solve for AI Bazaar at this stage.

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| User accounts / auth at v1 | "We need to know who submitted" | Auth is an activation killer; adds infra cost; not needed to validate the catalog concept | Anonymous submission with email optional; defer accounts to v1.x when upvotes need attribution |
| Full review/comment system | Product Hunt has it, seems necessary | Requires moderation; spam magnet; detracts focus from the machine-readable catalog angle | Simple upvote + external links (GitHub issues, Discord) for discussion |
| Real-time price feeds / TVL | DeFi audience expects it | DeFi Llama already does this better; we'd be a worse version of something that exists | Link TO DeFi Llama for TVL data; don't replicate |
| Paid listings / promoted placements | Revenue model | Destroys trust signal integrity; makes the "Bazaar score" meaningless; DeFi community is hostile to pay-to-play | Monetize via API access tiers or sponsored starter packs (clearly labeled) instead |
| Manual curation for every listing | "Quality control" | Doesn't scale; bottleneck; kills permissionless promise; scrape-first approach makes it unnecessary | Algorithmic quality signals + community upvotes + reported listings queue for human review |
| Native wallet integration / token gating | "Web3 native" | Adds enormous UX friction for the AI/developer audience; most AI tool builders are not on-chain | Accept wallet as optional identity signal; no gating |
| In-app agent execution / sandboxing | "Try the tool from the UI" | Massive security and infrastructure scope; out of band for a discovery platform | Link to the tool's own demo/playground |
| Dark pattern notification systems | Growth hacking | Alienates developer audience who will immediately unsubscribe or blocklist | Optional digest email (weekly); Telegram bot is the push channel instead |

---

## Feature Dependencies

```
[Scrape-first ingest pipeline]
    └──requires──> [URL normalization + deduplication]
    └──requires──> [Listing schema / data model]
                       └──requires──> [Category taxonomy]

[MCP protocol endpoint]
    └──requires──> [Machine-readable listing schema]
    └──requires──> [REST API with cursor pagination]
    └──enables──> [Telegram bot discovery]
    └──enables──> [A2A agent discovery (v2)]

[Curated starter packs]
    └──requires──> [Listing catalog (sufficient items)]
    └──requires──> [Collection/bundle data model]

[Telegram bot]
    └──requires──> [REST API]
    └──enhances──> [Starter packs] (bot can recommend bundles)

[Composite Bazaar score]
    └──requires──> [External metric ingestion] (GitHub stars, npm downloads, HuggingFace likes)
    └──enhances──> [Search ranking]

[Semantic search]
    └──requires──> [Embedding generation pipeline]
    └──requires──> [Vector store]
    └──enhances──> [MCP endpoint] (natural language queries from agents)

[User-curated lists]
    └──requires──> [User accounts] (defer to v1.x)

[On-chain metadata verification]
    └──requires──> [Chain explorer integration] (Etherscan, Solscan)
    └──enhances──> [Trust signals on listing detail page]

[Anonymous submission]
    └──conflicts──> [Upvote attribution] (votes are anonymous; acceptable at v1)
```

### Dependency Notes

- **MCP endpoint requires listing schema first:** The schema must be designed with agent consumption in mind from day one; retrofitting it later is painful.
- **Starter packs require catalog volume:** Don't build the bundle UI until there are 100+ listings to pull from — the bundles need choice.
- **Semantic search requires embedding pipeline:** This is a meaningful infrastructure addition; design schema to store embeddings but defer the search surface until keyword search is live and validated.
- **User-curated lists conflict with anonymous submissions:** Lists need ownership; this means auth. Defer lists until auth is introduced in v1.x.
- **Telegram bot requires API first:** Bot is a consumer of the same REST API humans use; no separate backend needed.

---

## MVP Definition

### Launch With (v1)

Minimum viable product — validate that people (and agents) want a unified AI/Web3 tool catalog.

- [ ] Scrape-first ingest pipeline (GitHub topics, npm, HuggingFace) — without this, the catalog is empty and nothing else matters
- [ ] Listing schema + data model with category taxonomy — foundational; everything else depends on it
- [ ] Web UI: search, filter, browse, listing detail page — the human-facing product
- [ ] MCP-compatible REST API with cursor pagination — the agent-facing product; differentiator from day one
- [ ] Anonymous permissionless submission form — permissionless is a core promise
- [ ] Basic upvote (no auth) — minimal community signal
- [ ] Composite quality score (GitHub stars + downloads + upvotes) — surfaces quality without manual curation
- [ ] Telegram bot: search and browse commands — meets the audience where they are
- [ ] 3-5 curated starter packs — onboards non-technical users; makes first visit meaningful

### Add After Validation (v1.x)

Add when catalog has traction and user patterns are visible.

- [ ] User accounts + authenticated submissions — trigger: upvote gaming or spam becomes a problem
- [ ] User-curated lists — trigger: power users request it or SEO opportunity identified
- [ ] Semantic / embedding search — trigger: keyword search failing on logs (users searching and getting poor results)
- [ ] On-chain metadata verification — trigger: Web3 community feedback asking for trust signals

### Future Consideration (v2+)

Defer until product-market fit is established.

- [ ] A2A agent discovery layer — requires agent identity standards to mature; Google A2A protocol is still young
- [ ] Federated / self-hosted registry instances — enterprise use case; requires auth, access control, org management
- [ ] Verified publisher badges — requires human review workflow; build after anonymous system is stable

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Scrape-first ingest pipeline | HIGH | HIGH | P1 |
| Listing schema + data model | HIGH | MEDIUM | P1 |
| Web UI: search + browse | HIGH | MEDIUM | P1 |
| MCP REST API | HIGH | MEDIUM | P1 |
| Permissionless submission | HIGH | LOW | P1 |
| Basic upvote | MEDIUM | LOW | P1 |
| Composite quality score | HIGH | MEDIUM | P1 |
| Telegram bot | HIGH | MEDIUM | P1 |
| Starter packs (bundles) | HIGH | LOW | P1 |
| Semantic search | HIGH | HIGH | P2 |
| User-curated lists | MEDIUM | HIGH | P2 |
| User accounts / auth | MEDIUM | HIGH | P2 |
| On-chain metadata verification | MEDIUM | HIGH | P2 |
| A2A discovery layer | HIGH | HIGH | P3 |
| Federated registry | MEDIUM | HIGH | P3 |
| Verified publisher badges | MEDIUM | MEDIUM | P3 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible (post-validation)
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

| Feature | Product Hunt | MCP Registry (official) | DeFi Llama | HuggingFace Hub | Our Approach |
|---------|--------------|------------------------|------------|-----------------|--------------|
| Human browse/search UI | Yes (launch-day leaderboard) | Minimal | Yes (protocol rankings) | Yes (rich filters) | Yes — primary surface |
| Machine-readable API | No | Yes (REST + pagination) | Partial (public API) | Yes (full API) | Yes — first-class, MCP-compliant |
| Scrape/auto-population | No (submission only) | No (publisher-submitted) | Semi-auto (chain data) | Partial (scrapes PyPI/GitHub for cards) | Yes — primary catalog source |
| Permissionless submission | Yes | Yes (GitHub PR) | Partially (requires PR) | Yes | Yes — web form + auto-enrich |
| Curated bundles / starter packs | No | No | No | Partial (task pages) | Yes — key differentiator |
| Conversational Telegram bot | No | No | No | No | Yes |
| Quality score aggregation | Upvotes only | Stars only | TVL (chain-native) | Downloads + likes | Composite multi-source score |
| Dual audience (human + agent) | Human only | Agent only | Human primary | Human primary | Both, same data layer |
| Web3/on-chain context | No | No | Native | No | Optional verified field |
| Category taxonomy | Yes (broad) | Minimal | Yes (DeFi-specific) | Yes (ML tasks) | Broader: AI tools + Web3 tools + agents |

---

## Sources

- [Product Hunt alternatives and feature analysis — startuplist.ing](https://startuplist.ing/blog/product-hunt-alternatives)
- [MCP Registry launch (September 2025) — InfoQ](https://www.infoq.com/news/2025/10/github-mcp-registry/)
- [Introducing the MCP Registry — InfoQ](https://www.infoq.com/news/2025/09/introducing-mcp-registry/)
- [MCP Registry architecture — TrueFoundry](https://www.truefoundry.com/blog/what-is-mcp-registry)
- [MCP Registries: Securing Discovery — Medium](https://medium.com/@dave-patten/mcp-registries-securing-discovery-in-the-age-of-agentic-ai-c6987272b19e)
- [MCP Roadmap — modelcontextprotocol.io](https://modelcontextprotocol.io/development/roadmap)
- [AI Agent Marketplace features — inoru.com](https://www.inoru.com/blog/ai-agent-marketplace-the-complete-guide/)
- [AWS Marketplace AI agents launch 2025 — AWS](https://aws.amazon.com/about-aws/whats-new/2025/07/ai-agents-tools-aws-marketplace/)
- [HuggingFace Hub documentation](https://huggingface.co/docs/hub/en/index)
- [DeFi Llama — defillama.com](https://defillama.com/)
- [Google Discover spam/quality decay — Medium](https://medium.com/@lucwiesman/google-discovers-big-miss-publishers-lost-at-seawhile-ai-spam-expired-domains-and-big-news-cash-0c482258d193)
- [ToolSDK MCP Registry — GitHub](https://github.com/toolsdk-ai/toolsdk-mcp-registry)
- [AI Agents Directory landscape — aiagentsdirectory.com](https://aiagentsdirectory.com/landscape)

---
*Feature research for: AI Bazaar — AI/Agent/Web3 discovery platform*
*Researched: 2026-02-18*
*Confidence: MEDIUM — WebSearch verified across 5+ sources per major claim; MCP spec details HIGH (official docs); anti-feature recommendations LOW-MEDIUM (pattern matching from analogous platforms)*
