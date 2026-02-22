/**
 * Content Performance Tracker for AI Bazaar Content Engine.
 *
 * CLI tool to log and analyze tweet performance metrics.
 * Feeds data back into the Claude content prompt: "My best performing content type is X".
 *
 * Commands:
 *   bun run track add <tweet-url> <impressions> <clicks> [content-type]
 *   bun run track report                    # weekly summary
 *   bun run track report --all              # all-time summary
 *   bun run track list                      # list recent entries
 *
 * Data stored in: data/tweet-performance.json
 *
 * Content types: hot-tool-drop | quick-take | web3-ai | top-5-thread | vs-comparison | recap-thread
 */

const DATA_DIR = new URL('../../data/', import.meta.url).pathname;
const DATA_FILE = `${DATA_DIR}tweet-performance.json`;

const VALID_CONTENT_TYPES = [
  'hot-tool-drop',
  'quick-take',
  'web3-ai',
  'top-5-thread',
  'vs-comparison',
  'recap-thread',
] as const;

type ContentType = typeof VALID_CONTENT_TYPES[number];

interface TweetEntry {
  id: string;
  url: string;
  contentType: ContentType;
  impressions: number;
  clicks: number;
  likes: number;
  replies: number;
  retweets: number;
  profileVisits: number;
  date: string; // YYYY-MM-DD
  addedAt: string; // ISO timestamp
  notes?: string;
}

interface PerformanceData {
  entries: TweetEntry[];
  metadata: {
    firstEntry: string;
    lastUpdated: string;
    totalEntries: number;
  };
}

async function loadData(): Promise<PerformanceData> {
  const file = Bun.file(DATA_FILE);
  if (await file.exists()) {
    return file.json();
  }
  return {
    entries: [],
    metadata: {
      firstEntry: '',
      lastUpdated: '',
      totalEntries: 0,
    },
  };
}

async function saveData(data: PerformanceData): Promise<void> {
  data.metadata.lastUpdated = new Date().toISOString();
  data.metadata.totalEntries = data.entries.length;
  if (data.entries.length > 0 && !data.metadata.firstEntry) {
    data.metadata.firstEntry = data.entries[0].date;
  }
  await Bun.write(DATA_FILE, JSON.stringify(data, null, 2));
}

function guessContentType(url: string): ContentType | null {
  // Can't reliably guess from URL alone
  return null;
}

async function handleAdd(args: string[]): Promise<void> {
  if (args.length < 3) {
    console.error('Usage: bun run track add <tweet-url> <impressions> <clicks> [content-type]');
    console.error('');
    console.error('Optional extended format:');
    console.error('  bun run track add <url> <impressions> <clicks> <content-type> [likes] [replies] [retweets] [profile-visits]');
    console.error('');
    console.error(`Content types: ${VALID_CONTENT_TYPES.join(', ')}`);
    process.exit(1);
  }

  const [url, impressionsStr, clicksStr, contentTypeArg, likesStr, repliesStr, retweetsStr, profileVisitsStr] = args;

  const impressions = parseInt(impressionsStr, 10);
  const clicks = parseInt(clicksStr, 10);

  if (isNaN(impressions) || isNaN(clicks)) {
    console.error('Error: impressions and clicks must be numbers');
    process.exit(1);
  }

  let contentType: ContentType = 'hot-tool-drop';
  if (contentTypeArg) {
    if (!VALID_CONTENT_TYPES.includes(contentTypeArg as ContentType)) {
      console.error(`Error: invalid content type "${contentTypeArg}"`);
      console.error(`Valid types: ${VALID_CONTENT_TYPES.join(', ')}`);
      process.exit(1);
    }
    contentType = contentTypeArg as ContentType;
  }

  const data = await loadData();

  const entry: TweetEntry = {
    id: crypto.randomUUID(),
    url,
    contentType,
    impressions,
    clicks,
    likes: parseInt(likesStr || '0', 10) || 0,
    replies: parseInt(repliesStr || '0', 10) || 0,
    retweets: parseInt(retweetsStr || '0', 10) || 0,
    profileVisits: parseInt(profileVisitsStr || '0', 10) || 0,
    date: new Date().toISOString().split('T')[0],
    addedAt: new Date().toISOString(),
  };

  data.entries.push(entry);
  await saveData(data);

  console.log(`Added tweet performance entry:`);
  console.log(`  URL: ${url}`);
  console.log(`  Type: ${contentType}`);
  console.log(`  Impressions: ${impressions.toLocaleString()}`);
  console.log(`  Clicks: ${clicks.toLocaleString()}`);
  console.log(`  CTR: ${impressions > 0 ? ((clicks / impressions) * 100).toFixed(1) : 0}%`);
  console.log(`  Total entries: ${data.entries.length}`);
}

async function handleList(): Promise<void> {
  const data = await loadData();

  if (data.entries.length === 0) {
    console.log('No entries yet. Use `bun run track add` to log your first tweet.');
    return;
  }

  const recent = data.entries.slice(-10).reverse();
  console.log(`Recent entries (${data.entries.length} total):\n`);

  for (const e of recent) {
    const ctr = e.impressions > 0 ? ((e.clicks / e.impressions) * 100).toFixed(1) : '0';
    console.log(`  ${e.date} | ${e.contentType.padEnd(16)} | ${e.impressions.toLocaleString().padStart(6)} imp | ${e.clicks.toLocaleString().padStart(4)} clicks | ${ctr}% CTR`);
    console.log(`           ${e.url}`);
  }
}

async function handleReport(allTime: boolean): Promise<void> {
  const data = await loadData();

  if (data.entries.length === 0) {
    console.log('No entries yet. Use `bun run track add` to log your first tweet.');
    return;
  }

  let entries = data.entries;
  let periodLabel = 'All-Time';

  if (!allTime) {
    // Last 7 days
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    entries = data.entries.filter(e => e.date >= weekAgoStr);
    periodLabel = `Week of ${weekAgoStr}`;

    if (entries.length === 0) {
      console.log(`No entries in the last 7 days. Use --all for all-time report.`);
      return;
    }
  }

  // Aggregate by content type
  const byType = new Map<string, {
    count: number;
    totalImpressions: number;
    totalClicks: number;
    totalLikes: number;
    totalReplies: number;
    totalRetweets: number;
    totalProfileVisits: number;
  }>();

  for (const e of entries) {
    const agg = byType.get(e.contentType) || {
      count: 0,
      totalImpressions: 0,
      totalClicks: 0,
      totalLikes: 0,
      totalReplies: 0,
      totalRetweets: 0,
      totalProfileVisits: 0,
    };
    agg.count++;
    agg.totalImpressions += e.impressions;
    agg.totalClicks += e.clicks;
    agg.totalLikes += e.likes;
    agg.totalReplies += e.replies;
    agg.totalRetweets += e.retweets;
    agg.totalProfileVisits += e.profileVisits;
    byType.set(e.contentType, agg);
  }

  // Overall stats
  const totalImpressions = entries.reduce((s, e) => s + e.impressions, 0);
  const totalClicks = entries.reduce((s, e) => s + e.clicks, 0);
  const totalLikes = entries.reduce((s, e) => s + e.likes, 0);
  const overallCtr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(1) : '0';

  console.log(`\n=== AI Bazaar Content Performance Report ===`);
  console.log(`Period: ${periodLabel}`);
  console.log(`Entries: ${entries.length}`);
  console.log(`\n--- Overall ---`);
  console.log(`  Total impressions:  ${totalImpressions.toLocaleString()}`);
  console.log(`  Total clicks:       ${totalClicks.toLocaleString()}`);
  console.log(`  Total likes:        ${totalLikes.toLocaleString()}`);
  console.log(`  Overall CTR:        ${overallCtr}%`);
  console.log(`  Avg imp/tweet:      ${Math.round(totalImpressions / entries.length).toLocaleString()}`);

  // By content type — sorted by avg impressions
  const sorted = [...byType.entries()].sort(
    (a, b) => (b[1].totalImpressions / b[1].count) - (a[1].totalImpressions / a[1].count)
  );

  console.log(`\n--- By Content Type (best → worst) ---\n`);
  for (const [type, agg] of sorted) {
    const avgImp = Math.round(agg.totalImpressions / agg.count);
    const avgClicks = Math.round(agg.totalClicks / agg.count);
    const ctr = agg.totalImpressions > 0
      ? ((agg.totalClicks / agg.totalImpressions) * 100).toFixed(1)
      : '0';

    console.log(`  ${type}`);
    console.log(`    Posts: ${agg.count} | Avg imp: ${avgImp.toLocaleString()} | Avg clicks: ${avgClicks} | CTR: ${ctr}%`);
  }

  // Best and worst tweets
  const sortedByImp = [...entries].sort((a, b) => b.impressions - a.impressions);

  console.log(`\n--- Best Performing ---`);
  const best = sortedByImp[0];
  if (best) {
    console.log(`  ${best.contentType}: ${best.impressions.toLocaleString()} imp, ${best.clicks} clicks`);
    console.log(`  ${best.url}`);
  }

  console.log(`\n--- Worst Performing ---`);
  const worst = sortedByImp[sortedByImp.length - 1];
  if (worst && worst !== best) {
    console.log(`  ${worst.contentType}: ${worst.impressions.toLocaleString()} imp, ${worst.clicks} clicks`);
    console.log(`  ${worst.url}`);
  }

  // Recommendation for Claude prompt
  if (sorted.length >= 2) {
    console.log(`\n--- Claude Prompt Update ---`);
    console.log(`Add this to your Claude content prompt:`);
    console.log(`"My best performing content type is ${sorted[0][0]} (avg ${Math.round(sorted[0][1].totalImpressions / sorted[0][1].count).toLocaleString()} impressions). Lean into this format."`);
  }

  console.log('');
}

// --- CLI Router ---
const [, , command, ...args] = process.argv;

switch (command) {
  case 'add':
    await handleAdd(args);
    break;
  case 'list':
    await handleList();
    break;
  case 'report':
    await handleReport(args.includes('--all'));
    break;
  default:
    console.log('AI Bazaar Content Performance Tracker\n');
    console.log('Usage:');
    console.log('  bun run track add <tweet-url> <impressions> <clicks> [content-type]');
    console.log('  bun run track list');
    console.log('  bun run track report           # last 7 days');
    console.log('  bun run track report --all      # all-time');
    console.log('');
    console.log(`Content types: ${VALID_CONTENT_TYPES.join(', ')}`);
    break;
}
