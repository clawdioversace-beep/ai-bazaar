"""
There's An AI For That (TAAFT) scraper using Crawl4AI.

Crawls theresanaiforthat.com to discover AI tools. Uses stealth mode
and JS rendering since the site is an SPA. Extracts tool data from
the rendered page's markdown output.

Usage:
    python scrapers/scrape_taaft.py
"""

import asyncio
import re
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from common import slugify, categorize_by_keywords, write_output

MAX_RESULTS = 100

URLS = [
    "https://theresanaiforthat.com/",
    "https://theresanaiforthat.com/s/ai-agents/",
]


def extract_tools_from_markdown(md: str) -> list[dict]:
    """
    Extract AI tools from TAAFT markdown.

    Tool entries appear as groups of links to /ai/SLUG/:
    1. [Tool Name vX.Y](https://theresanaiforthat.com/ai/slug/) — the tool name
    2. [Free + from $X/mo](https://theresanaiforthat.com/ai/slug/) — pricing
    3. [18,458108](https://theresanaiforthat.com/ai/slug/) — stats (saves/views)

    We extract the name from the first link per slug and deduplicate.
    """
    tools: dict[str, dict] = {}  # keyed by slug

    pattern = r'\[([^\]]+)\]\(https://theresanaiforthat\.com/ai/([a-z0-9-]+(?:-\d+)?)/?\)'
    for match in re.finditer(pattern, md):
        text = match.group(1).strip()
        slug = match.group(2)

        # Skip if we already have this slug
        if slug in tools:
            continue

        # Skip non-name entries: pricing, stats, etc.
        if re.match(r'^[\d,.\s]+$', text):  # Pure numbers (stats)
            continue
        if re.match(r'^Free', text, re.IGNORECASE):  # Pricing
            continue
        if re.match(r'^\$', text):  # Price
            continue
        if len(text) < 2 or len(text) > 100:
            continue

        # Clean version suffixes from name: "Tool v1.2.3" -> "Tool"
        name = re.sub(r'\s+v[\d.]+\s*$', '', text).strip()
        if not name:
            continue

        tools[slug] = {
            "name": name,
            "slug": slug,
            "url": f"https://theresanaiforthat.com/ai/{slug}/",
        }

    return list(tools.values())


async def scrape() -> list[dict]:
    browser_cfg = BrowserConfig(
        headless=True,
        verbose=False,
        enable_stealth=True,
    )

    seen: set[str] = set()
    entries: list[dict] = []

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        for url in URLS:
            print(f"[taaft] Crawling {url}...")

            run_cfg = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                page_timeout=30000,
            )

            result = await crawler.arun(url=url, config=run_cfg)

            if not result.success:
                print(f"[taaft] Failed: {result.error_message}")
                continue

            if not result.markdown:
                print("[taaft] No markdown content")
                continue

            tools = extract_tools_from_markdown(result.markdown)
            print(f"[taaft] Found {len(tools)} tools from {url}")

            for tool in tools:
                if tool["slug"] in seen:
                    continue
                seen.add(tool["slug"])

                name = tool["name"]
                # All TAAFT tools are AI tools — categorize with that context
                category = categorize_by_keywords(name)
                if category == "framework":
                    category = "ai-agent"  # TAAFT is an AI tools directory

                entries.append({
                    "slug": slugify(name),
                    "name": name,
                    "tagline": f"AI tool: {name}"[:160],
                    "description": f"Discovered on There's An AI For That: {name}",
                    "category": category,
                    "tags": ["ai"],
                    "sourceUrl": tool["url"],
                    "stars": 0,
                    "submittedBy": "crawl4ai-taaft",
                })

                if len(entries) >= MAX_RESULTS:
                    break

            if len(entries) >= MAX_RESULTS:
                break

    print(f"[taaft] Extracted {len(entries)} unique tools")
    return entries


async def main():
    entries = await scrape()
    write_output("taaft.json", entries)


if __name__ == "__main__":
    asyncio.run(main())
