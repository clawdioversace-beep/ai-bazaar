/**
 * Scrape job scheduler.
 *
 * Enqueues recurring scrape jobs to bunqueue for daily re-indexing
 * of all catalog sources (GitHub, npm, HuggingFace, Crawl4AI) and dead link checks.
 *
 * Schedule:
 * - GitHub scrape: daily at 2 AM UTC (6 jobs, one per topic)
 * - Crawl4AI scrape: daily at 2:30 AM UTC (1 job — runs 3 Python scrapers + ingest)
 * - npm scrape: daily at 3 AM UTC (6 jobs, one per keyword)
 * - HuggingFace scrape: daily at 4 AM UTC (3 jobs, one per tag)
 * - Dead link check: daily at 5 AM UTC (1 job)
 *
 * Usage:
 *   bun run schedule  # Enqueue all recurring jobs
 */

import { Queue } from 'bunqueue/client';

/**
 * Schedule all recurring scrape jobs.
 */
export async function scheduleAllJobs(): Promise<void> {
  console.log('[scheduler] Scheduling recurring scrape jobs...\n');

  // Initialize queues in embedded mode
  const githubQueue = new Queue('scrape-github', { embedded: true });
  const npmQueue = new Queue('scrape-npm', { embedded: true });
  const hfQueue = new Queue('scrape-huggingface', { embedded: true });
  const crawl4aiQueue = new Queue('scrape-crawl4ai', { embedded: true });
  const deadLinkQueue = new Queue('check-dead-links', { embedded: true });

  // GitHub scrape jobs - daily at 2 AM UTC
  const githubTopics = ['mcp-server', 'ai-agent', 'model-context-protocol', 'web3', 'defi', 'kubernetes'];

  console.log('[scheduler] Scheduling GitHub scrapes (daily at 2 AM UTC)...');
  for (const topic of githubTopics) {
    await githubQueue.add(
      `scrape-${topic}`,
      { topic, maxResults: 300 },
      {
        repeat: {
          pattern: '0 2 * * *', // Daily at 2 AM UTC
        },
      }
    );
    console.log(`  - ${topic}: scheduled`);
  }

  // Crawl4AI scrape job - daily at 2:30 AM UTC
  // Runs all 3 Python scrapers (GitHub Trending, Product Hunt, TAAFT) + ingest
  console.log('\n[scheduler] Scheduling Crawl4AI scrape (daily at 2:30 AM UTC)...');
  await crawl4aiQueue.add(
    'scrape-crawl4ai',
    {},
    {
      repeat: {
        pattern: '30 2 * * *', // Daily at 2:30 AM UTC
      },
    }
  );
  console.log('  - crawl4ai (github-trending + producthunt + taaft): scheduled');

  // npm scrape jobs - daily at 3 AM UTC
  const npmKeywords = ['mcp', 'ai-agent', 'web3', 'agent-framework', 'defi', 'docker'];

  console.log('\n[scheduler] Scheduling npm scrapes (daily at 3 AM UTC)...');
  for (const keyword of npmKeywords) {
    await npmQueue.add(
      `scrape-${keyword}`,
      { keyword, maxResults: 250 },
      {
        repeat: {
          pattern: '0 3 * * *', // Daily at 3 AM UTC
        },
      }
    );
    console.log(`  - ${keyword}: scheduled`);
  }

  // HuggingFace scrape jobs - daily at 4 AM UTC
  const hfTags = ['agent', 'web3', 'mcp'];

  console.log('\n[scheduler] Scheduling HuggingFace scrapes (daily at 4 AM UTC)...');
  for (const tag of hfTags) {
    await hfQueue.add(
      `scrape-${tag}`,
      { tag, maxResults: 200 },
      {
        repeat: {
          pattern: '0 4 * * *', // Daily at 4 AM UTC
        },
      }
    );
    console.log(`  - ${tag}: scheduled`);
  }

  // Dead link check job - daily at 5 AM UTC
  console.log('\n[scheduler] Scheduling dead link check (daily at 5 AM UTC)...');
  await deadLinkQueue.add(
    'check-all',
    {},
    {
      repeat: {
        pattern: '0 5 * * *', // Daily at 5 AM UTC
      },
    }
  );
  console.log('  - check-all: scheduled');

  console.log('\n[scheduler] All jobs scheduled successfully.');
  console.log(`  Total recurring jobs: ${githubTopics.length + npmKeywords.length + hfTags.length + 1 + 1}`);
}

// Run scheduler if this file is executed directly
// @ts-ignore - Bun-specific property
if (import.meta.main) {
  await scheduleAllJobs();
  console.log('\n[scheduler] Scheduler complete. Jobs will run at their scheduled times when workers are active.');
}
