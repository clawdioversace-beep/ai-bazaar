/**
 * Ingest Crawl4AI scraper output into the catalog.
 *
 * Reads JSON files from scrapers/output/*.json, validates each entry
 * through the CatalogEntrySchema, and upserts via upsertBySourceUrl().
 *
 * Usage:
 *   TURSO_DATABASE_URL=file:./dev.db bun src/scripts/ingest-crawl4ai.ts
 */

import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { CatalogEntrySchema, type CatalogEntryInput } from '../lib/catalog-schema';
import { upsertBySourceUrl } from '../services/catalog';

// @ts-ignore - Bun-specific property
const OUTPUT_DIR = join(import.meta.dir, '../../scrapers/output');

async function main() {
  console.log('=== Crawl4AI Ingest ===\n');

  let files: string[];
  try {
    const allFiles = await readdir(OUTPUT_DIR);
    files = allFiles.filter(f => f.endsWith('.json') && f !== '.gitkeep');
  } catch (err) {
    console.error(`[ingest] Cannot read ${OUTPUT_DIR}: ${err}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.log('[ingest] No JSON files found in scrapers/output/. Run Python scrapers first.');
    return;
  }

  let totalProcessed = 0;
  let totalErrors = 0;

  for (const file of files) {
    const filePath = join(OUTPUT_DIR, file);
    console.log(`--- Ingesting ${file} ---`);

    let entries: unknown[];
    try {
      const content = await readFile(filePath, 'utf-8');
      entries = JSON.parse(content);
      if (!Array.isArray(entries)) {
        console.error(`[ingest] ${file}: expected array, got ${typeof entries}`);
        totalErrors++;
        continue;
      }
    } catch (err) {
      console.error(`[ingest] ${file}: failed to read/parse: ${err}`);
      totalErrors++;
      continue;
    }

    let processed = 0;
    let errors = 0;

    for (const raw of entries) {
      try {
        // Validate through Zod schema — catches bad categories, missing fields, etc.
        const parsed = CatalogEntrySchema.parse(raw);
        await upsertBySourceUrl(parsed as CatalogEntryInput);
        processed++;
      } catch (err) {
        errors++;
        if (errors <= 3) {
          // Log first few errors for debugging, then suppress
          const name = (raw as Record<string, unknown>)?.name ?? 'unknown';
          console.error(`[ingest] ${file}: validation error for "${name}": ${err}`);
        }
      }
    }

    console.log(`${file}: ${processed} processed, ${errors} errors`);
    totalProcessed += processed;
    totalErrors += errors;
  }

  console.log(`\n=== Ingest Complete ===`);
  console.log(`Total processed: ${totalProcessed}`);
  console.log(`Total errors:    ${totalErrors}`);
}

main().catch((err) => {
  console.error('[ingest] Fatal error:', err);
  process.exit(1);
});
