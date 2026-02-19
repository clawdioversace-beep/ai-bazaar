/**
 * Scrape worker process.
 *
 * Background worker that processes scrape jobs from bunqueue queues.
 * Dispatches jobs to the appropriate scraper based on queue name.
 *
 * Queues:
 * - scrape-github: GitHub topic scrape jobs
 * - scrape-npm: npm keyword scrape jobs
 * - scrape-huggingface: HuggingFace tag scrape jobs
 * - check-dead-links: Dead link health check jobs
 *
 * Usage:
 *   bun run worker       # Local dev (file:./dev.db)
 *   bun run worker:prod  # Production (requires TURSO_DATABASE_URL env var)
 */

import { Worker } from 'bunqueue/client';
import { scrapeGitHub } from '../scrapers/github-scraper';
import { scrapeNpm } from '../scrapers/npm-scraper';
import { scrapeHuggingFace } from '../scrapers/huggingface-scraper';
import { checkDeadLink, markDeadLink, getAllListings } from '../services/catalog';

// Track all workers for graceful shutdown
const workers: Worker[] = [];

/**
 * GitHub scrape worker.
 * Processes jobs from the 'scrape-github' queue.
 */
const githubWorker = new Worker(
  'scrape-github',
  async (job) => {
    const { topic, maxResults } = job.data as { topic: string; maxResults?: number };
    console.log(`[github-worker] Processing job: topic=${topic}, maxResults=${maxResults ?? 500}`);
    return scrapeGitHub(topic, maxResults ?? 500);
  },
  {
    embedded: true,
    concurrency: 1, // Serial to respect GitHub rate limits
  }
);

workers.push(githubWorker);

/**
 * npm scrape worker.
 * Processes jobs from the 'scrape-npm' queue.
 */
const npmWorker = new Worker(
  'scrape-npm',
  async (job) => {
    const { keyword, maxResults } = job.data as { keyword: string; maxResults?: number };
    console.log(`[npm-worker] Processing job: keyword=${keyword}, maxResults=${maxResults ?? 250}`);
    return scrapeNpm(keyword, maxResults ?? 250);
  },
  {
    embedded: true,
    concurrency: 1, // Serial to avoid overwhelming npm registry
  }
);

workers.push(npmWorker);

/**
 * HuggingFace scrape worker.
 * Processes jobs from the 'scrape-huggingface' queue.
 */
const hfWorker = new Worker(
  'scrape-huggingface',
  async (job) => {
    const { tag, maxResults } = job.data as { tag: string; maxResults?: number };
    console.log(`[hf-worker] Processing job: tag=${tag}, maxResults=${maxResults ?? 200}`);
    return scrapeHuggingFace(tag, maxResults ?? 200);
  },
  {
    embedded: true,
    concurrency: 1,
  }
);

workers.push(hfWorker);

/**
 * Dead link checker worker.
 * Processes jobs from the 'check-dead-links' queue.
 */
const deadLinkWorker = new Worker(
  'check-dead-links',
  async (job) => {
    console.log('[dead-link-worker] Starting dead link check...');
    const listings = await getAllListings(10000, 0);
    let checked = 0;
    let dead = 0;

    for (const listing of listings) {
      const isDead = await checkDeadLink(listing.sourceUrl);
      if (isDead) {
        await markDeadLink(listing.id, true);
        dead++;
      } else {
        // Also update lastVerifiedAt for live links
        await markDeadLink(listing.id, false);
      }
      checked++;

      // Throttle: max 10 checks/second to avoid overwhelming servers
      if (checked % 10 === 0) {
        await Bun.sleep(1000);
      }

      // Log progress every 100 checks
      if (checked % 100 === 0) {
        console.log(`[dead-link-worker] Progress: ${checked}/${listings.length} checked, ${dead} dead`);
      }
    }

    console.log(`[dead-link-worker] Complete: ${checked} checked, ${dead} dead`);
    return { checked, dead };
  },
  {
    embedded: true,
    concurrency: 1, // Only one dead link check at a time
  }
);

workers.push(deadLinkWorker);

/**
 * Start all workers.
 */
export async function startWorkers(): Promise<void> {
  console.log('[scrape-worker] Starting all workers...');
  // Workers start automatically upon creation in bunqueue embedded mode
  console.log(`[scrape-worker] ${workers.length} workers active`);
}

/**
 * Stop all workers gracefully.
 */
export async function stopWorkers(): Promise<void> {
  console.log('[scrape-worker] Stopping all workers...');
  for (const worker of workers) {
    await worker.close();
  }
  console.log('[scrape-worker] All workers stopped');
}

/**
 * Graceful shutdown handler.
 */
const shutdown = async (signal: string) => {
  console.log(`[scrape-worker] Received ${signal}, shutting down...`);
  await stopWorkers();
  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Start workers if this file is run directly
if (import.meta.main) {
  await startWorkers();
  console.log('[scrape-worker] Workers running. Press Ctrl+C to stop.');

  // Keep the process alive
  await new Promise(() => {});
}
