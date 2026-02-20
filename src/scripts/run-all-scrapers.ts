/**
 * Run-all-scrapers orchestrator.
 *
 * Runs all catalog scraper sources:
 * 1. GitHub (by topic) — TypeScript / Octokit
 * 2. npm (by keyword) — TypeScript / registry API
 * 3. HuggingFace (by tag) — TypeScript / HF API
 * 4. Crawl4AI scrapers (GitHub Trending, Product Hunt, TAAFT) — Python subprocesses
 * 5. Crawl4AI ingest — reads Python JSON output into the catalog
 *
 * Each source is run directly (not via bunqueue workers) so this script
 * can be called from the command line without a running worker process.
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/scripts/run-all-scrapers.ts
 *
 * Via package.json:
 *   bun run scrape:all        # local dev.db
 *   bun run scrape:all:prod   # production (requires TURSO_DATABASE_URL + TURSO_AUTH_TOKEN)
 */

import { join } from 'node:path';
import { scrapeGitHub } from '../scrapers/github-scraper';
import { scrapeNpm } from '../scrapers/npm-scraper';
import { scrapeHuggingFace } from '../scrapers/huggingface-scraper';

const START_TIME = Date.now();
// @ts-ignore - Bun-specific property
const SCRAPERS_DIR = join(import.meta.dir, '../../scrapers');
const VENV_PYTHON = join(SCRAPERS_DIR, '.venv/bin/python');

function elapsed(): string {
  return `${((Date.now() - START_TIME) / 1000).toFixed(1)}s`;
}

/**
 * Run a Python scraper script as a subprocess.
 * Returns true on success, false on failure. Non-blocking on errors.
 */
async function runPythonScraper(scriptName: string): Promise<boolean> {
  const scriptPath = join(SCRAPERS_DIR, scriptName);
  console.log(`[crawl4ai] Running ${scriptName}...`);

  try {
    // @ts-ignore - Bun global
    const proc = Bun.spawn([VENV_PYTHON, scriptPath], {
      cwd: SCRAPERS_DIR,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const exitCode = await proc.exited;
    const stdout = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();

    if (stdout) console.log(stdout.trim());

    if (exitCode !== 0) {
      console.error(`[crawl4ai] ${scriptName} exited with code ${exitCode}`);
      if (stderr) console.error(stderr.trim());
      return false;
    }
    return true;
  } catch (err) {
    console.error(`[crawl4ai] ${scriptName} failed to spawn: ${err}`);
    return false;
  }
}

async function main() {
  console.log('=== AI Bazaar: Run All Scrapers ===\n');

  const totals = {
    processed: 0,
    errors: 0,
  };

  // 1. GitHub topic scrapes
  console.log('--- 1. GitHub Topic Scraper ---');
  const githubTopics = [
    'mcp-server',
    'ai-agent',
    'model-context-protocol',
    'web3',
    'defi',
  ];
  let githubProcessed = 0;
  let githubErrors = 0;
  const githubStart = Date.now();
  for (const topic of githubTopics) {
    try {
      const result = await scrapeGitHub(topic, 100);
      githubProcessed += result.processed;
      githubErrors += result.errors;
    } catch (err) {
      console.error(`[run-all] GitHub topic=${topic} failed: ${err}`);
      githubErrors++;
    }
  }
  const githubDuration = ((Date.now() - githubStart) / 1000).toFixed(1);
  console.log(`GitHub: ${githubProcessed} processed, ${githubErrors} errors in ${githubDuration}s\n`);
  totals.processed += githubProcessed;
  totals.errors += githubErrors;

  // 2. npm keyword scrapes
  console.log('--- 2. npm Keyword Scraper ---');
  const npmKeywords = ['mcp', 'ai-agent', 'web3', 'agent-framework', 'defi'];
  let npmProcessed = 0;
  let npmErrors = 0;
  const npmStart = Date.now();
  for (const keyword of npmKeywords) {
    try {
      const result = await scrapeNpm(keyword, 100);
      npmProcessed += result.processed;
      npmErrors += result.errors;
    } catch (err) {
      console.error(`[run-all] npm keyword=${keyword} failed: ${err}`);
      npmErrors++;
    }
  }
  const npmDuration = ((Date.now() - npmStart) / 1000).toFixed(1);
  console.log(`npm: ${npmProcessed} processed, ${npmErrors} errors in ${npmDuration}s\n`);
  totals.processed += npmProcessed;
  totals.errors += npmErrors;

  // 3. HuggingFace tag scrapes
  console.log('--- 3. HuggingFace Tag Scraper ---');
  const hfTags = ['agent', 'web3', 'mcp'];
  let hfProcessed = 0;
  let hfErrors = 0;
  const hfStart = Date.now();
  for (const tag of hfTags) {
    try {
      const result = await scrapeHuggingFace(tag, 100);
      hfProcessed += result.processed;
      hfErrors += result.errors;
    } catch (err) {
      console.error(`[run-all] HuggingFace tag=${tag} failed: ${err}`);
      hfErrors++;
    }
  }
  const hfDuration = ((Date.now() - hfStart) / 1000).toFixed(1);
  console.log(`HuggingFace: ${hfProcessed} processed, ${hfErrors} errors in ${hfDuration}s\n`);
  totals.processed += hfProcessed;
  totals.errors += hfErrors;

  // 4. Crawl4AI Python scrapers (run in parallel)
  console.log('--- 4. Crawl4AI Scrapers (Python) ---');
  const crawl4aiStart = Date.now();
  const pythonScripts = [
    'scrape_github_trending.py',
    'scrape_producthunt.py',
    'scrape_taaft.py',
  ];

  const results = await Promise.all(pythonScripts.map(s => runPythonScraper(s)));
  const succeeded = results.filter(Boolean).length;
  const failed = results.length - succeeded;
  const crawl4aiDuration = ((Date.now() - crawl4aiStart) / 1000).toFixed(1);
  console.log(`Crawl4AI: ${succeeded}/${results.length} scrapers succeeded in ${crawl4aiDuration}s\n`);

  if (failed > 0) {
    console.log(`[crawl4ai] ${failed} scraper(s) failed — continuing with available output\n`);
  }

  // 5. Ingest Crawl4AI output
  console.log('--- 5. Crawl4AI Ingest ---');
  const ingestStart = Date.now();
  try {
    // @ts-ignore - Bun global
    const ingestProc = Bun.spawn(
      // @ts-ignore - Bun-specific property
      ['bun', join(import.meta.dir, 'ingest-crawl4ai.ts')],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        env: { ...process.env },
      }
    );
    const ingestExit = await ingestProc.exited;
    const ingestOut = await new Response(ingestProc.stdout).text();
    if (ingestOut) console.log(ingestOut.trim());
    if (ingestExit !== 0) {
      const ingestErr = await new Response(ingestProc.stderr).text();
      console.error(`[run-all] Ingest exited with code ${ingestExit}`);
      if (ingestErr) console.error(ingestErr.trim());
      totals.errors++;
    }
  } catch (err) {
    console.error(`[run-all] Ingest failed: ${err}`);
    totals.errors++;
  }
  const ingestDuration = ((Date.now() - ingestStart) / 1000).toFixed(1);
  console.log(`Ingest completed in ${ingestDuration}s\n`);

  // Summary
  console.log('=== Run Complete ===');
  console.log(`Total processed: ${totals.processed} (API scrapers only — Crawl4AI counted in ingest)`);
  console.log(`Total errors:    ${totals.errors}`);
  console.log(`Total time:      ${elapsed()}`);
}

main().catch((err) => {
  console.error('[run-all] Fatal error:', err);
  process.exit(1);
});
