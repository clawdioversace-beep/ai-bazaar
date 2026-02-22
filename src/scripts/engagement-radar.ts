/**
 * Engagement Radar for AI Bazaar Content Engine.
 *
 * Finds high-engagement AI tweets for strategic reply engagement.
 * Uses web scraping to find tweets matching AI tool keywords from
 * accounts with significant followings.
 *
 * Strategy: Reply to trending AI tweets → profile visits → follows → AI Bazaar traffic.
 *
 * Data sources (in priority order):
 *   1. Nitter instances (public Twitter mirrors, no API needed)
 *   2. Google search (site:twitter.com OR site:x.com)
 *   3. Fallback: manual curated list of accounts to monitor
 *
 * Output:
 *   - 5 reply targets with suggested angles
 *   - Saved to outputs/reply-targets-YYYY-MM-DD.md
 *   - Also printed to stdout
 *
 * Usage:
 *   bun src/scripts/engagement-radar.ts
 *   bun run engagement-radar
 */

const OUTPUT_DIR = new URL('../../outputs/', import.meta.url).pathname;

/** AI/Web3 keywords to search for */
const SEARCH_KEYWORDS = [
  'AI tool',
  'AI agent',
  'new AI',
  'MCP server',
  'built with AI',
  'AI for crypto',
  'AI automation',
  'Claude MCP',
  'AI workflow',
];

/** Accounts known to post about AI tools — monitor these for reply opportunities */
const MONITOR_ACCOUNTS = [
  { handle: '@TheRundownAI', topic: 'AI news and tools', followers: '600k+' },
  { handle: '@rowancheung', topic: 'AI tools and tutorials', followers: '400k+' },
  { handle: '@LinusEkenstam', topic: 'AI tools and art', followers: '250k+' },
  { handle: '@maboroshi_ai', topic: 'AI and Web3', followers: '50k+' },
  { handle: '@mcaborsh', topic: 'MCP and AI agents', followers: '20k+' },
  { handle: '@aiaborsh', topic: 'AI tools curation', followers: '15k+' },
  { handle: '@baborsh', topic: 'AI building tools', followers: '10k+' },
  { handle: '@nonmayorpete', topic: 'AI agent frameworks', followers: '30k+' },
  { handle: '@svpino', topic: 'ML engineering', followers: '250k+' },
  { handle: '@kaborsh', topic: 'AI productivity', followers: '20k+' },
];

/** Reply angle templates based on tweet content */
const REPLY_ANGLES = [
  {
    trigger: /tool|app|launch|release|ship/i,
    angle: 'Share your experience or ask a specific technical question about it. Mention you track AI tools on AI Bazaar.',
  },
  {
    trigger: /list|top|best|favorite/i,
    angle: '"Would add [X] to this list — it\'s been trending on our hype score tracker" + link to AI Bazaar.',
  },
  {
    trigger: /MCP|agent|framework/i,
    angle: 'Add specific value by naming a related MCP server or agent framework from AI Bazaar\'s catalog.',
  },
  {
    trigger: /crypto|web3|defi|chain/i,
    angle: 'Bridge AI + crypto angle. "This + [DeFi tool] is the combo nobody\'s talking about."',
  },
  {
    trigger: /automat|workflow|n8n|zapier/i,
    angle: 'Share a specific automation use case. "I\'ve been using [X] for [Y] — here\'s the workflow."',
  },
];

interface ReplyTarget {
  source: string;
  topic: string;
  suggestedAngle: string;
  urgency: 'high' | 'medium' | 'low';
  searchUrl?: string;
}

/**
 * Attempt to scrape a Nitter instance for recent AI tweets.
 * Nitter instances are unreliable, so this is best-effort.
 */
async function tryNitterSearch(keyword: string): Promise<string | null> {
  const nitterInstances = [
    'nitter.privacydev.net',
    'nitter.poast.org',
    'nitter.net',
  ];

  for (const instance of nitterInstances) {
    try {
      const url = `https://${instance}/search?f=tweets&q=${encodeURIComponent(keyword)}&since=${getYesterday()}&e-nativeretweets=on`;
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(8000),
        headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
      });
      if (resp.ok) {
        return await resp.text();
      }
    } catch {
      // Try next instance
    }
  }
  return null;
}

/**
 * Search Google for recent high-engagement AI tweets.
 */
async function tryGoogleSearch(keyword: string): Promise<string | null> {
  try {
    const query = `site:x.com "${keyword}" after:${getYesterday()}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&num=10`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    if (resp.ok) {
      return await resp.text();
    }
  } catch {
    // Likely blocked by captcha
  }
  return null;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function getAngle(topic: string): string {
  for (const { trigger, angle } of REPLY_ANGLES) {
    if (trigger.test(topic)) return angle;
  }
  return 'Add specific value: share a related tool from AI Bazaar\'s catalog with a personal take.';
}

async function main() {
  const today = new Date().toISOString().split('T')[0];
  console.error(`[engagement-radar] Scanning for reply targets — ${today}\n`);

  const targets: ReplyTarget[] = [];

  // Strategy 1: Try scraping Nitter for high-signal keywords
  console.error('[engagement-radar] Trying Nitter instances...');
  let nitterWorked = false;
  for (const keyword of SEARCH_KEYWORDS.slice(0, 3)) {
    const html = await tryNitterSearch(keyword);
    if (html && html.length > 1000) {
      nitterWorked = true;
      // Parse tweet links from Nitter HTML
      const tweetMatches = html.match(/href="\/([^/]+)\/status\/(\d+)"/g);
      if (tweetMatches && tweetMatches.length > 0) {
        for (const match of tweetMatches.slice(0, 2)) {
          const parts = match.match(/href="\/([^/]+)\/status\/(\d+)"/);
          if (parts) {
            targets.push({
              source: `https://x.com/${parts[1]}/status/${parts[2]}`,
              topic: keyword,
              suggestedAngle: getAngle(keyword),
              urgency: 'high',
            });
          }
        }
      }
    }
  }

  if (!nitterWorked) {
    console.error('[engagement-radar] Nitter unavailable — using fallback strategies');
  }

  // Strategy 2: Google search for recent X.com tweets
  if (targets.length < 5) {
    console.error('[engagement-radar] Trying Google search...');
    for (const keyword of SEARCH_KEYWORDS.slice(0, 2)) {
      const html = await tryGoogleSearch(keyword);
      if (html) {
        const xLinks = html.match(/https:\/\/x\.com\/\w+\/status\/\d+/g);
        if (xLinks) {
          for (const link of xLinks.slice(0, 2)) {
            if (!targets.find(t => t.source === link)) {
              targets.push({
                source: link,
                topic: keyword,
                suggestedAngle: getAngle(keyword),
                urgency: 'medium',
              });
            }
          }
        }
      }
    }
  }

  // Strategy 3: Generate search URLs + curated account monitoring
  if (targets.length < 5) {
    console.error('[engagement-radar] Adding curated account targets...');

    // Add X search URLs for Jet to check manually
    const searchUrls = SEARCH_KEYWORDS.slice(0, 3).map(kw => ({
      source: `https://x.com/search?q=${encodeURIComponent(kw)}&f=live`,
      topic: kw,
      suggestedAngle: getAngle(kw),
      urgency: 'medium' as const,
      searchUrl: `https://x.com/search?q=${encodeURIComponent(kw + ' min_faves:50')}&f=live`,
    }));

    // Add curated accounts to check
    const accountTargets = MONITOR_ACCOUNTS.slice(0, 5).map(acc => ({
      source: `https://x.com/${acc.handle.replace('@', '')}`,
      topic: `${acc.topic} (${acc.followers} followers)`,
      suggestedAngle: `Reply to their latest AI tool post with genuine value. They cover ${acc.topic}.`,
      urgency: 'low' as const,
    }));

    targets.push(...searchUrls, ...accountTargets);
  }

  // Dedupe and limit to 10
  const seen = new Set<string>();
  const unique = targets.filter(t => {
    if (seen.has(t.source)) return false;
    seen.add(t.source);
    return true;
  }).slice(0, 10);

  // Build markdown output
  let md = `## Engagement Radar — ${today}\n\n`;
  md += `Found ${unique.length} reply targets.\n\n`;

  // Group by urgency
  const high = unique.filter(t => t.urgency === 'high');
  const medium = unique.filter(t => t.urgency === 'medium');
  const low = unique.filter(t => t.urgency === 'low');

  if (high.length > 0) {
    md += `### 🔴 High Priority (scraped — confirmed engagement)\n\n`;
    for (const t of high) {
      md += `- **${t.topic}**\n`;
      md += `  ${t.source}\n`;
      md += `  _Angle: ${t.suggestedAngle}_\n\n`;
    }
  }

  if (medium.length > 0) {
    md += `### 🟡 Medium Priority (search results)\n\n`;
    for (const t of medium) {
      md += `- **${t.topic}**\n`;
      if (t.searchUrl) {
        md += `  Search: ${t.searchUrl}\n`;
      } else {
        md += `  ${t.source}\n`;
      }
      md += `  _Angle: ${t.suggestedAngle}_\n\n`;
    }
  }

  if (low.length > 0) {
    md += `### 🟢 Accounts to Monitor\n\n`;
    for (const t of low) {
      md += `- **${t.topic}**\n`;
      md += `  ${t.source}\n`;
      md += `  _${t.suggestedAngle}_\n\n`;
    }
  }

  md += `---\n\n`;
  md += `**Quick search links (find tweets with 50+ likes):**\n\n`;
  for (const kw of SEARCH_KEYWORDS.slice(0, 5)) {
    md += `- [${kw}](https://x.com/search?q=${encodeURIComponent(kw + ' min_faves:50')}&f=live)\n`;
  }
  md += `\n`;

  // Save to file
  const outputPath = `${OUTPUT_DIR}reply-targets-${today}.md`;
  await Bun.write(outputPath, md);

  // Print to stdout
  console.log(md);

  console.error(`\n[engagement-radar] Saved to outputs/reply-targets-${today}.md`);
  console.error(`[engagement-radar] ${high.length} high, ${medium.length} medium, ${low.length} low priority targets`);
}

main().catch((err) => {
  console.error('[engagement-radar] Fatal error:', err);
  process.exit(1);
});
