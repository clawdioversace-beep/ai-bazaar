/**
 * Sync Style Examples — Fetches Twitter threads from Google Sheet
 * and compiles them into a .md file for the content engine.
 *
 * The Google Sheet has columns: Date | Category | Source URL | Title | Summary | Tags | Status
 * This script filters for Twitter/X URLs, fetches full thread content,
 * and generates content-engine/style-examples.md.
 *
 * Usage:
 *   bun run sync-styles          # sync new threads
 *   bun run sync-styles --force  # re-fetch all threads (ignore processed state)
 */

import { google } from 'googleapis';

// ── Load .env.local explicitly (Bun auto-load can conflict with parent envs) ──
const envPath = new URL('../../.env.local', import.meta.url).pathname;
const envFile = Bun.file(envPath);
if (await envFile.exists()) {
  const envText = await envFile.text();
  for (const line of envText.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.substring(0, eqIdx);
    const val = trimmed.substring(eqIdx + 1);
    process.env[key] = val;
  }
}

// ── Config ──────────────────────────────────────────────────────────────

const PROCESSED_FILE = new URL('../../data/processed-threads.json', import.meta.url).pathname;
const OUTPUT_FILE = new URL('../../content-engine/style-examples.md', import.meta.url).pathname;
const forceRefetch = process.argv.includes('--force');

// ── Types ───────────────────────────────────────────────────────────────

interface SheetRow {
  date: string;
  category: string;
  sourceUrl: string;
  title: string;
  summary: string;
  tags: string;
  status: string;
}

interface ProcessedEntry {
  fetchedAt: string;
  author: string;
  text: string;
}

interface ProcessedState {
  [sourceUrl: string]: ProcessedEntry;
}

interface ThreadContent {
  author: string;
  text: string;
  sourceUrl: string;
  tags: string;
  dateCaptured: string;
  hookLine: string;
}

// ── Google Sheets ───────────────────────────────────────────────────────

async function readSheet(): Promise<SheetRow[]> {
  const serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!serviceAccountJson) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON not set');

  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error('GOOGLE_SHEET_ID not set');

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: sheetId,
    range: 'Sheet1!A:G',
  });

  const rows = res.data.values;
  if (!rows || rows.length < 2) return [];

  return rows.slice(1).map((row) => ({
    date: row[0] || '',
    category: row[1] || '',
    sourceUrl: row[2] || '',
    title: row[3] || '',
    summary: row[4] || '',
    tags: row[5] || '',
    status: row[6] || '',
  }));
}

function filterTwitterRows(rows: SheetRow[]): SheetRow[] {
  return rows.filter((r) =>
    /(?:twitter\.com|x\.com)\/\w+\/status\/\d+/i.test(r.sourceUrl)
  );
}

// ── Processed State ─────────────────────────────────────────────────────

async function loadProcessed(): Promise<ProcessedState> {
  try {
    const file = Bun.file(PROCESSED_FILE);
    if (await file.exists()) {
      return await file.json();
    }
  } catch { /* first run */ }
  return {};
}

async function saveProcessed(state: ProcessedState): Promise<void> {
  await Bun.write(PROCESSED_FILE, JSON.stringify(state, null, 2));
}

// ── Tweet URL Parsing ───────────────────────────────────────────────────

function parseTweetUrl(url: string): { screenName: string; tweetId: string } | null {
  const match = url.match(/(?:twitter\.com|x\.com)\/([^/]+)\/status\/(\d+)/i);
  if (!match) return null;
  return { screenName: match[1]!, tweetId: match[2]! };
}

// ── X API v2 ────────────────────────────────────────────────────────────

interface TwitterAPIResponse {
  data?: {
    text: string;
    author_id: string;
    conversation_id?: string;
    entities?: {
      urls?: Array<{ url: string; expanded_url: string; unwound_url?: string }>;
    };
  };
  includes?: { users?: Array<{ id: string; username: string; name: string }> };
  errors?: Array<{ message: string }>;
}

async function fetchViaXAPI(
  tweetId: string,
  bearerToken: string
): Promise<{ author: string; text: string } | null> {
  const apiUrl = `https://api.x.com/2/tweets/${tweetId}?tweet.fields=text,author_id,conversation_id,created_at,entities&expansions=author_id&user.fields=username,name`;

  const response = await fetch(apiUrl, {
    headers: { Authorization: `Bearer ${bearerToken}` },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as TwitterAPIResponse;
  if (data.errors || !data.data?.text) return null;

  const username = data.includes?.users?.[0]?.username || 'unknown';
  let text = data.data.text;

  // Replace t.co links with expanded URLs
  const urls = data.data.entities?.urls || [];
  for (const u of urls) {
    const expanded = u.unwound_url || u.expanded_url;
    if (expanded && !(/twitter\.com|x\.com/i.test(expanded))) {
      text = text.replace(u.url, expanded);
    } else {
      text = text.replace(u.url, '').trim();
    }
  }

  return { author: username, text };
}

// ── FxTwitter API ───────────────────────────────────────────────────────

interface FxArticleBlock {
  text: string;
  type: string;
}

interface FxTweetResponse {
  code: number;
  tweet?: {
    text: string;
    author: { name: string; screen_name: string };
    quote?: { text: string; author: { name: string; screen_name: string } };
    article?: {
      title: string;
      preview_text?: string;
      content?: {
        blocks?: FxArticleBlock[];
      };
    };
  };
}

/** Extract full article text from FxTwitter's content blocks */
function parseArticleBlocks(blocks: FxArticleBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === 'header-one') return `# ${b.text}`;
      if (b.type === 'header-two') return `## ${b.text}`;
      if (b.type === 'header-three') return `### ${b.text}`;
      if (b.type === 'blockquote') return `> ${b.text}`;
      return b.text;
    })
    .filter((line) => line.length > 0)
    .join('\n\n');
}

async function fetchViaFxTwitter(
  parsed: { screenName: string; tweetId: string }
): Promise<{ author: string; text: string } | null> {
  const apiUrl = `https://api.fxtwitter.com/${parsed.screenName}/status/${parsed.tweetId}`;
  const response = await fetch(apiUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StyleSync/1.0)' },
  });

  if (!response.ok) return null;

  const data = (await response.json()) as FxTweetResponse;
  if (data.code !== 200 || !data.tweet) return null;

  const author = data.tweet.author.screen_name;

  // Handle Twitter Articles (long-form posts)
  if (data.tweet.article) {
    const article = data.tweet.article;
    let text = '';

    // Try full content blocks first
    if (article.content?.blocks?.length) {
      text = parseArticleBlocks(article.content.blocks);
    } else if (article.preview_text) {
      text = article.preview_text;
    }

    if (text) {
      // Prepend article title
      if (article.title) {
        text = `# ${article.title}\n\n${text}`;
      }
      return { author, text };
    }
  }

  // Regular tweet
  if (!data.tweet.text) return null;

  let text = data.tweet.text;
  if (data.tweet.quote?.text) {
    text += `\n\n> Quoted @${data.tweet.quote.author.screen_name}: ${data.tweet.quote.text}`;
  }

  return { author, text };
}

// ── Fetch Thread Content ────────────────────────────────────────────────

async function fetchThread(
  url: string
): Promise<{ author: string; text: string } | null> {
  const parsed = parseTweetUrl(url);
  if (!parsed) return null;

  // Strategy 1: X API v2
  let bearer = process.env.X_BEARER_TOKEN;
  // Decode URL-encoded bearer tokens (some .env files have %2B, %3D etc.)
  if (bearer && bearer.includes('%')) {
    try { bearer = decodeURIComponent(bearer); } catch { /* keep as-is */ }
  }
  if (bearer && !bearer.startsWith('your_')) {
    try {
      const result = await fetchViaXAPI(parsed.tweetId, bearer);
      if (result) return result;
    } catch (err) {
      console.warn(`  X API failed for ${url}: ${err}`);
    }
  }

  // Strategy 2: FxTwitter
  try {
    const result = await fetchViaFxTwitter(parsed);
    if (result) return result;
  } catch (err) {
    console.warn(`  FxTwitter failed for ${url}: ${err}`);
  }

  return null;
}

// ── Markdown Generation ─────────────────────────────────────────────────

function getHookLine(text: string): string {
  const firstLine = text.split('\n')[0]?.trim() || '';
  if (firstLine.length > 80) return firstLine.substring(0, 77) + '...';
  return firstLine;
}

function generateMarkdown(threads: ThreadContent[]): string {
  const now = new Date().toISOString().split('T')[0];

  let md = `# Thread Style Examples Library\n\n`;
  md += `> Auto-generated by sync-style-examples.ts. Last synced: ${now}. Total: ${threads.length} threads.\n`;
  md += `> Use these as reference for writing hooks, structure, tone, and engagement patterns.\n\n`;
  md += `---\n\n`;

  for (let i = 0; i < threads.length; i++) {
    const t = threads[i];
    md += `### ${i + 1}. @${t.author} — "${t.hookLine}"\n\n`;
    md += `**URL:** ${t.sourceUrl} | **Tags:** ${t.tags || 'none'} | **Date captured:** ${t.dateCaptured}\n\n`;
    md += `${t.text}\n\n`;
    md += `---\n\n`;
  }

  return md;
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Sync Style Examples ===');
  const startTime = Date.now();

  // 1. Read sheet
  console.log('Reading Google Sheet...');
  const allRows = await readSheet();
  console.log(`  ${allRows.length} total rows`);

  // 2. Filter for Twitter URLs
  const twitterRows = filterTwitterRows(allRows);
  console.log(`  ${twitterRows.length} Twitter/X thread rows`);

  if (twitterRows.length === 0) {
    console.log('No Twitter threads found in sheet. Done.');
    return;
  }

  // 3. Load processed state (stores fetched content)
  const processed = forceRefetch ? {} as ProcessedState : await loadProcessed();
  const unprocessed = twitterRows.filter((r) => !processed[r.sourceUrl]);
  console.log(`  ${unprocessed.length} new threads to fetch${forceRefetch ? ' (force mode)' : ''}`);

  // 4. Fetch new thread content
  let fetched = 0;
  let failed = 0;

  for (let i = 0; i < unprocessed.length; i++) {
    const row = unprocessed[i];
    const result = await fetchThread(row.sourceUrl);

    if (result) {
      processed[row.sourceUrl] = {
        fetchedAt: new Date().toISOString(),
        author: result.author,
        text: result.text,
      };
      fetched++;
      console.log(`  ✓ @${result.author} — ${getHookLine(result.text)}`);
    } else {
      // Store with summary as fallback text
      const parsed = parseTweetUrl(row.sourceUrl);
      processed[row.sourceUrl] = {
        fetchedAt: new Date().toISOString(),
        author: parsed?.screenName || 'unknown',
        text: row.summary || '(Content could not be fetched — try --force later)',
      };
      failed++;
      console.log(`  ✗ Failed: ${row.sourceUrl} (using summary as fallback)`);
    }

    // Rate limit between fetches
    if (i < unprocessed.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\nFetched: ${fetched} | Failed: ${failed} | Already cached: ${twitterRows.length - unprocessed.length}`);

  // 5. Build thread list from cached content + sheet metadata
  const allThreads: ThreadContent[] = twitterRows
    .filter((row) => processed[row.sourceUrl])
    .map((row) => {
      const entry = processed[row.sourceUrl];
      return {
        author: entry.author,
        text: entry.text,
        sourceUrl: row.sourceUrl,
        tags: row.tags,
        dateCaptured: row.date ? row.date.split('T')[0] : 'unknown',
        hookLine: getHookLine(entry.text),
      };
    });

  // 6. Generate and save markdown
  const markdown = generateMarkdown(allThreads);
  await Bun.write(OUTPUT_FILE, markdown);
  console.log(`Wrote ${allThreads.length} threads to content-engine/style-examples.md`);

  // 7. Save processed state (with full content cached)
  await saveProcessed(processed);
  console.log(`Updated processed state: ${Object.keys(processed).length} entries`);

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n=== Done (${duration}s) ===`);
}

main().catch((err) => {
  console.error('[sync-style-examples] Fatal error:', err);
  process.exit(1);
});
