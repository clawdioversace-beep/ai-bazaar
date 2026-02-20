"""
Product Hunt scraper using Crawl4AI.

Crawls Product Hunt topic pages (AI, Developer Tools) with stealth mode
enabled for Cloudflare bypass. Extracts product data from the rendered
page's markdown output — more reliable than CSS selectors on PH's
frequently-changing React DOM.

Usage:
    python scrapers/scrape_producthunt.py
"""

import asyncio
import re
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode
from common import slugify, categorize_producthunt, write_output

MAX_RESULTS = 100

URLS = [
    "https://www.producthunt.com/topics/artificial-intelligence",
    "https://www.producthunt.com/topics/developer-tools",
]


def parse_review_count(text: str) -> int:
    """Parse review count from text like '1.4K reviews' or '630 reviews'."""
    match = re.search(r'([\d.]+)\s*K?\s*reviews?', text, re.IGNORECASE)
    if not match:
        return 0
    num = match.group(1)
    if 'K' in text[match.start():match.end()].upper():
        return int(float(num) * 1000)
    return int(float(num))


def extract_products_from_markdown(md: str) -> list[dict]:
    """
    Extract products from Product Hunt markdown.

    Product entries appear as links in the format:
    [Name Tagline](https://www.producthunt.com/products/slug)
    or
    [Name](https://www.producthunt.com/products/slug)

    We filter out review links, navigation, and non-product URLs.
    """
    products: dict[str, dict] = {}  # keyed by slug for dedup

    # Find all product links
    pattern = r'\[([^\]]+)\]\((https://www\.producthunt\.com/products/([a-z0-9-]+))(?:/reviews[^\)]*)?\)'
    for match in re.finditer(pattern, md):
        text = match.group(1).strip()
        url = match.group(2)
        slug = match.group(3)

        # Skip review count links, "View all" links, and navigation
        if re.match(r'^[\d.,]+K?\s*reviews?$', text, re.IGNORECASE):
            continue
        if text.lower() in ('view all', 'see all', 'reviews', 'promoted', ''):
            continue
        if len(text) < 2 or len(text) > 200:
            continue

        # If this slug already exists, skip duplicates (keep first)
        if slug in products:
            continue

        # Try to split "Name Tagline" — PH often concatenates them
        # The name is typically 1-3 words, tagline is the rest
        name = text
        tagline = ""

        # Look for known patterns: "Name The/A/An tagline"
        name_split = re.match(r'^([A-Z][^\s]+(?: [A-Z][^\s]+)*)\s+(The |A |An |[A-Z][a-z])', text)
        if name_split:
            split_pos = name_split.end(1)
            name = text[:split_pos].strip()
            tagline = text[split_pos:].strip()

        if not tagline:
            tagline = f"Discovered on Product Hunt: {name}"

        products[slug] = {
            "name": name,
            "tagline": tagline,
            "url": url,
            "slug": slug,
        }

    return list(products.values())


async def scrape() -> list[dict]:
    browser_cfg = BrowserConfig(
        headless=True,
        verbose=False,
        enable_stealth=True,
    )

    seen: set[str] = set()
    entries: list[dict] = []

    # Track topic context from URL for categorization
    url_topics: dict[str, list[str]] = {
        "artificial-intelligence": ["artificial-intelligence", "ai"],
        "developer-tools": ["developer-tools", "developer"],
    }

    async with AsyncWebCrawler(config=browser_cfg) as crawler:
        for url in URLS:
            print(f"[producthunt] Crawling {url}...")

            # Determine topic context from URL
            topic_key = url.rstrip("/").split("/")[-1]
            topics = url_topics.get(topic_key, [])

            run_cfg = CrawlerRunConfig(
                cache_mode=CacheMode.BYPASS,
                page_timeout=30000,
            )

            result = await crawler.arun(url=url, config=run_cfg)

            if not result.success:
                print(f"[producthunt] Failed: {result.error_message}")
                continue

            if not result.markdown:
                print("[producthunt] No markdown content")
                continue

            products = extract_products_from_markdown(result.markdown)
            print(f"[producthunt] Found {len(products)} products from {url}")

            for prod in products:
                if prod["slug"] in seen:
                    continue
                seen.add(prod["slug"])

                category = categorize_producthunt(prod["tagline"], topics)

                entries.append({
                    "slug": prod["slug"],
                    "name": prod["name"],
                    "tagline": prod["tagline"][:160],
                    "description": prod["tagline"] or f"Discovered on Product Hunt: {prod['name']}",
                    "category": category,
                    "tags": topics if topics else ["product-hunt"],
                    "sourceUrl": prod["url"],
                    "stars": 0,
                    "submittedBy": "crawl4ai-producthunt",
                })

                if len(entries) >= MAX_RESULTS:
                    break

            if len(entries) >= MAX_RESULTS:
                break

    print(f"[producthunt] Extracted {len(entries)} unique products")
    return entries


async def main():
    entries = await scrape()
    write_output("producthunt.json", entries)


if __name__ == "__main__":
    asyncio.run(main())
