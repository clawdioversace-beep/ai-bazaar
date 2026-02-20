/**
 * Product Hunt scraper.
 *
 * Scrapes Product Hunt topic pages (AI, Developer Tools) by fetching HTML
 * and extracting post data from the __NEXT_DATA__ JSON embedded in the page.
 *
 * Strategy:
 * 1. Fetch /topics/artificial-intelligence and /topics/developer-tools
 * 2. Extract __NEXT_DATA__ JSON from <script> tag
 * 3. Parse post list from the JSON structure
 * 4. Fall back to regex extraction if JSON structure changes
 *
 * Non-blocking: returns {processed: 0, errors: 0} on fatal errors
 * so it doesn't crash the run-all pipeline.
 *
 * @module producthunt-scraper
 */

import { fetchWithRetry } from '../lib/fetch-with-retry';
import { normalizeProductHuntPost, type ProductHuntPost } from './normalizers/producthunt-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

const PH_TOPICS = [
  'https://www.producthunt.com/topics/artificial-intelligence',
  'https://www.producthunt.com/topics/developer-tools',
];

/**
 * Extract posts from __NEXT_DATA__ JSON embedded in Product Hunt HTML.
 *
 * Product Hunt is a Next.js app and embeds its initial data as:
 * <script id="__NEXT_DATA__" type="application/json">...</script>
 *
 * @param html - Raw HTML content from a Product Hunt page
 * @returns Array of extracted posts, or empty array if parsing fails
 */
function extractPostsFromNextData(html: string): ProductHuntPost[] {
  const posts: ProductHuntPost[] = [];

  try {
    // Match the __NEXT_DATA__ script tag content
    const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    if (!match || !match[1]) {
      return [];
    }

    const nextData = JSON.parse(match[1]);

    // Navigate the Next.js data structure to find posts
    // PH typically has posts under props.pageProps.topic.posts.edges
    const pageProps = nextData?.props?.pageProps;
    if (!pageProps) return [];

    // Try various known data paths
    const postsData =
      pageProps?.topic?.posts?.edges ||
      pageProps?.posts?.edges ||
      pageProps?.collection?.posts?.edges ||
      [];

    for (const edge of postsData) {
      const post = edge?.node || edge;
      if (!post?.name) continue;

      const postUrl = post.slug
        ? `https://www.producthunt.com/posts/${post.slug}`
        : post.url || '';

      if (!postUrl) continue;

      const topics: string[] = [];
      if (Array.isArray(post.topics?.edges)) {
        for (const topicEdge of post.topics.edges) {
          const topicName = topicEdge?.node?.slug || topicEdge?.node?.name;
          if (topicName) topics.push(topicName.toLowerCase());
        }
      }

      posts.push({
        name: post.name,
        tagline: post.tagline || '',
        url: postUrl,
        votesCount: post.votesCount || 0,
        topics,
      });
    }
  } catch {
    // JSON parse or traversal failed — return whatever we have
  }

  return posts;
}

/**
 * Fallback: extract post names and links via regex from HTML.
 *
 * Used when __NEXT_DATA__ parsing fails (e.g. PH changes their structure).
 * Less accurate but better than nothing.
 *
 * @param html - Raw HTML content
 * @param topicUrl - Base URL for building post URLs
 * @returns Array of minimal post objects
 */
function extractPostsFallback(html: string, topicUrl: string): ProductHuntPost[] {
  const posts: ProductHuntPost[] = [];
  const seen = new Set<string>();

  // Match links to product posts: /posts/some-product-name
  const postLinkRegex = /href="(\/posts\/[a-z0-9-]+)"/g;
  let match: RegExpExecArray | null;

  while ((match = postLinkRegex.exec(html)) !== null) {
    const path = match[1];
    if (seen.has(path)) continue;
    seen.add(path);

    // Derive a readable name from the slug
    const slug = path.replace('/posts/', '');
    const name = slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    posts.push({
      name,
      tagline: `Discovered on Product Hunt`,
      url: `https://www.producthunt.com${path}`,
      votesCount: 0,
      topics: [],
    });
  }

  return posts;
}

/**
 * Scrape Product Hunt topic pages and upsert tools into catalog.
 *
 * @param maxResults - Maximum number of posts to process across all topics (default 100)
 * @returns Object with processed count and error count
 */
export async function scrapeProductHunt(
  maxResults = 100
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    for (const topicUrl of PH_TOPICS) {
      if (processed + errors >= maxResults) break;

      console.log(`[producthunt-scraper] Fetching ${topicUrl}...`);

      let response: Response;
      try {
        response = await fetchWithRetry(
          topicUrl,
          {
            headers: {
              // Mimic a real browser to reduce bot detection
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.5',
            },
          },
          { maxAttempts: 2, baseDelay: 2000, timeout: 20000 }
        );
      } catch (fetchErr) {
        console.warn(`[producthunt-scraper] Failed to fetch ${topicUrl}: ${fetchErr}`);
        continue;
      }

      if (!response.ok) {
        console.warn(`[producthunt-scraper] Got ${response.status} from ${topicUrl} — skipping`);
        continue;
      }

      const html = await response.text();

      // Try __NEXT_DATA__ extraction first, fall back to regex
      let posts = extractPostsFromNextData(html);
      if (posts.length === 0) {
        console.log('[producthunt-scraper] __NEXT_DATA__ yielded 0 posts, trying fallback...');
        posts = extractPostsFallback(html, topicUrl);
      }

      console.log(`[producthunt-scraper] Found ${posts.length} posts from ${topicUrl}`);

      for (const post of posts) {
        if (processed + errors >= maxResults) break;

        try {
          const entry = normalizeProductHuntPost(post);
          await upsertBySourceUrl(entry);
          processed++;
        } catch (err) {
          console.error(`[producthunt-scraper] Failed: ${post.name}: ${err}`);
          errors++;
        }
      }
    }

    console.log(`[producthunt-scraper] ${processed} processed, ${errors} errors`);
  } catch (err) {
    // Non-blocking fatal error — log and return zeros so pipeline continues
    console.error(`[producthunt-scraper] Fatal error: ${err}`);
    return { processed: 0, errors: 0 };
  }

  return { processed, errors };
}
