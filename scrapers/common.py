"""
Shared utilities for Crawl4AI scrapers.

Provides slugification, keyword-based categorization (ported from the TypeScript
normalizers), and JSON output writing.
"""

import json
import os
import re
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "output"

# --- Slug generation (mirrors catalog-schema.ts createSlug) ---

def slugify(name: str) -> str:
    """Convert a name to a URL-safe slug."""
    slug = name.lower()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    slug = slug.strip("-")
    return slug[:100]


# --- Category assignment (ported from github-trending-normalizer.ts + producthunt-normalizer.ts) ---

VALID_CATEGORIES = [
    "mcp-server", "ai-agent", "web3-tool", "defi-tool",
    "infra", "framework", "saas-tool", "api-service", "developer-tool",
]

def categorize_by_keywords(
    text: str,
    topics: list[str] | None = None,
    language: str | None = None,
) -> str:
    """
    Determine category from description keywords and optional topic/language hints.

    Priority order:
    1. MCP / model context protocol -> mcp-server
    2. AI / agent / LLM -> ai-agent
    3. DeFi (before web3 to avoid false positives) -> defi-tool
    4. Web3 / blockchain -> web3-tool
    5. Infrastructure -> infra
    6. Developer tools -> developer-tool
    7. Default -> framework
    """
    desc = text.lower()
    lang = (language or "").lower()
    topic_set = {t.lower() for t in (topics or [])}

    # 1. MCP
    if "mcp" in desc or "model context protocol" in desc or "mcp" in topic_set:
        return "mcp-server"

    # 2. AI / Agent / LLM
    ai_keywords = {"agent", "llm", "gpt", "claude", "openai", "langchain",
                    "artificial intelligence", "machine-learning", "generative-ai",
                    "chatbot", "natural-language-processing", "automation"}
    if any(kw in desc for kw in ai_keywords) or " ai " in desc or desc.startswith("ai "):
        return "ai-agent"
    if topic_set & {"artificial-intelligence", "ai", "machine-learning", "ml",
                     "chatbot", "gpt", "llm", "generative-ai", "agent"}:
        return "ai-agent"

    # 3. DeFi — MUST come before web3
    defi_keywords = {"defi", "swap", "yield", "liquidity", "amm", "dex ", "lending"}
    if any(kw in desc for kw in defi_keywords):
        return "defi-tool"
    if topic_set & {"defi", "yield", "swap", "amm", "dex", "lending"}:
        return "defi-tool"

    # 4. Web3 / blockchain
    web3_keywords = {"web3", "blockchain", "ethereum", "solana", "smart contract", "nft", "crypto"}
    if any(kw in desc for kw in web3_keywords):
        return "web3-tool"
    if topic_set & {"web3", "blockchain", "ethereum", "solana", "crypto", "nft", "wallet"}:
        return "web3-tool"

    # 5. Infrastructure
    if lang == "dockerfile" or any(kw in desc for kw in
            ("kubernetes", " k8s", "docker", "infrastructure", "monitoring", "observability")):
        return "infra"

    # 6. Developer tools
    if topic_set & {"developer-tools", "developer", "api", "sdk", "open-source", "github"}:
        return "developer-tool"
    if any(kw in desc for kw in ("developer tool", "cli tool", "code editor", "devtool")):
        return "developer-tool"

    # 7. Default
    return "framework"


def categorize_producthunt(tagline: str, topics: list[str]) -> str:
    """Category assignment tuned for Product Hunt products (defaults to saas-tool)."""
    cat = categorize_by_keywords(tagline, topics)
    # PH products without strong signals are more likely SaaS than frameworks
    if cat == "framework":
        return "saas-tool"
    return cat


# --- Output helpers ---

def write_output(filename: str, entries: list[dict]) -> Path:
    """Write scraper results as JSON to the output directory."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / filename
    with open(path, "w") as f:
        json.dump(entries, f, indent=2, default=str)
    print(f"[common] Wrote {len(entries)} entries to {path}")
    return path
