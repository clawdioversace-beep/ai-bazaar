"""
GitHub Trending scraper using Crawl4AI.

Crawls the GitHub Trending page for daily and weekly periods,
extracts repository data via CSS selectors, and outputs JSON
for the TypeScript ingest pipeline.

Usage:
    python scrapers/scrape_github_trending.py
"""

import asyncio
import json
import sys
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from crawl4ai import JsonCssExtractionStrategy
from common import slugify, categorize_by_keywords, write_output

MAX_RESULTS = 50

SCHEMA = {
    "name": "TrendingRepos",
    "baseSelector": "article.Box-row",
    "fields": [
        {
            "name": "repo_path",
            "selector": "h2 a",
            "type": "attribute",
            "attribute": "href",
        },
        {
            "name": "description",
            "selector": "p",
            "type": "text",
        },
        {
            "name": "language",
            "selector": "[itemprop='programmingLanguage']",
            "type": "text",
        },
        {
            "name": "stars_text",
            "selector": "a[href$='/stargazers']",
            "type": "text",
        },
    ],
}

URLS = [
    "https://github.com/trending?since=daily",
    "https://github.com/trending?since=weekly",
]


def parse_stars(text: str) -> int:
    """Parse star count from text like ' 1,234 ' or '12.5k'."""
    text = text.strip().replace(",", "")
    if not text:
        return 0
    if text.lower().endswith("k"):
        try:
            return int(float(text[:-1]) * 1000)
        except ValueError:
            return 0
    try:
        return int(text)
    except ValueError:
        return 0


def language_to_runtime(lang: str | None) -> str | None:
    """Map GitHub language to runtime category."""
    if not lang:
        return None
    lang_lower = lang.lower().strip()
    mapping = {
        "typescript": "node", "javascript": "node",
        "python": "python", "rust": "rust", "go": "go",
    }
    return mapping.get(lang_lower, "other")


async def scrape() -> list[dict]:
    browser_cfg = BrowserConfig(headless=True, verbose=False)
    run_cfg = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS,
        extraction_strategy=JsonCssExtractionStrategy(SCHEMA),
        wait_for="css:article.Box-row",
    )

    seen: set[str] = set()
    entries: list[dict] = []

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        for url in URLS:
            print(f"[github-trending] Crawling {url}...")
            result = await crawler.arun(url=url, config=run_cfg)

            if not result.success:
                print(f"[github-trending] Failed: {result.error_message}")
                continue

            if not result.extracted_content:
                print("[github-trending] No extracted content")
                continue

            rows = json.loads(result.extracted_content)
            for row in rows:
                repo_path = (row.get("repo_path") or "").strip()
                if not repo_path or repo_path in seen:
                    continue
                seen.add(repo_path)

                # repo_path is like "/owner/repo"
                full_name = repo_path.lstrip("/")
                desc = (row.get("description") or "").strip()
                lang = (row.get("language") or "").strip() or None
                stars = parse_stars(row.get("stars_text") or "")

                category = categorize_by_keywords(desc, language=lang)

                entries.append({
                    "slug": slugify(full_name),
                    "name": full_name,
                    "tagline": (desc or f"GitHub trending: {full_name}")[:160],
                    "description": desc or f"No description provided for {full_name}",
                    "category": category,
                    "tags": [],
                    "sourceUrl": f"https://github.com/{full_name}",
                    "runtime": language_to_runtime(lang),
                    "stars": stars,
                    "submittedBy": "crawl4ai-github-trending",
                })

                if len(entries) >= MAX_RESULTS:
                    break

            if len(entries) >= MAX_RESULTS:
                break

    print(f"[github-trending] Extracted {len(entries)} unique repos")
    return entries


async def main():
    entries = await scrape()
    write_output("github-trending.json", entries)


if __name__ == "__main__":
    asyncio.run(main())
