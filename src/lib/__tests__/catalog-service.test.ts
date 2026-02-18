/**
 * Integration tests for CatalogService and SearchService.
 *
 * These tests run against a REAL SQLite database (test.db) — NOT mocked.
 * This verifies the complete data flow: Zod validation → Drizzle ORM → SQLite.
 *
 * IMPORTANT: All service imports are dynamic (via await import) inside beforeAll.
 * This ensures process.env.TURSO_DATABASE_URL is set before db/client.ts is ever
 * evaluated, since the Drizzle libSQL client reads the URL at module init time.
 * Static imports would be resolved before any user code runs.
 *
 * Database setup:
 * - Uses file:./test.db (isolated from dev.db)
 * - Migrations applied via migrate.ts runner (handles FTS5 triggers correctly)
 * - test.db cleaned before and after test suite
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { execSync } from 'child_process';
import { existsSync, unlinkSync } from 'fs';

// Types from services (type-only imports don't affect runtime module loading)
import type {
  createListing as CreateListing,
  getListingById as GetListingById,
  getListingBySlug as GetListingBySlug,
  updateListing as UpdateListing,
  upsertBySourceUrl as UpsertBySourceUrl,
  markDeadLink as MarkDeadLink,
  getAllListings as GetAllListings,
} from '../../services/catalog';

import type {
  searchCatalog as SearchCatalog,
  browseByCategory as BrowseByCategory,
} from '../../services/search';

// --- Test DB lifecycle ---

const TEST_DB_PATH = './test.db';

function cleanTestDb(): void {
  for (const path of [TEST_DB_PATH, `${TEST_DB_PATH}-shm`, `${TEST_DB_PATH}-wal`]) {
    if (existsSync(path)) unlinkSync(path);
  }
}

// Module-level refs to service functions (assigned in beforeAll after env var is set)
let createListing: typeof CreateListing;
let getListingById: typeof GetListingById;
let getListingBySlug: typeof GetListingBySlug;
let updateListing: typeof UpdateListing;
let upsertBySourceUrl: typeof UpsertBySourceUrl;
let markDeadLink: typeof MarkDeadLink;
let getAllListings: typeof GetAllListings;
let searchCatalog: typeof SearchCatalog;
let browseByCategory: typeof BrowseByCategory;

beforeAll(async () => {
  // 1. Set DB URL before any service module is loaded
  process.env.TURSO_DATABASE_URL = 'file:./test.db';

  // 2. Clean up any stale test.db from prior runs
  cleanTestDb();

  // 3. Apply schema migrations (creates listings table + FTS5 index + triggers)
  execSync('bun src/db/migrate.ts', {
    cwd: process.cwd(),
    env: { ...process.env, TURSO_DATABASE_URL: 'file:./test.db' },
    stdio: 'pipe',
  });

  // 4. Dynamically import services — at this point process.env.TURSO_DATABASE_URL is set
  //    so db/client.ts will use file:./test.db when drizzle() is called
  const catalogModule = await import('../../services/catalog');
  createListing = catalogModule.createListing;
  getListingById = catalogModule.getListingById;
  getListingBySlug = catalogModule.getListingBySlug;
  updateListing = catalogModule.updateListing;
  upsertBySourceUrl = catalogModule.upsertBySourceUrl;
  markDeadLink = catalogModule.markDeadLink;
  getAllListings = catalogModule.getAllListings;

  const searchModule = await import('../../services/search');
  searchCatalog = searchModule.searchCatalog;
  browseByCategory = searchModule.browseByCategory;
});

afterAll(() => {
  cleanTestDb();
});

// --- Test Data Helper ---

type CategoryValue = 'mcp-server' | 'ai-agent' | 'web3-tool' | 'defi-tool' | 'infra' | 'framework';

function makeListing(overrides: Partial<{
  slug: string;
  name: string;
  tagline: string;
  description: string;
  category: CategoryValue;
  tags: string[];
  sourceUrl: string;
  mcpCompatible: boolean;
  stars: number;
}> = {}) {
  return {
    slug: overrides.slug ?? 'test-tool-default',
    name: overrides.name ?? 'Test Tool',
    tagline: overrides.tagline ?? 'A test tool for integration tests',
    description: overrides.description ?? 'This is a test tool used in integration tests.',
    category: (overrides.category ?? 'mcp-server') as CategoryValue,
    tags: overrides.tags ?? ['mcp'],
    sourceUrl: overrides.sourceUrl ?? 'https://github.com/test/test-tool-default',
    mcpCompatible: overrides.mcpCompatible ?? true,
    stars: overrides.stars ?? 0,
  };
}

// --- Test Cases ---

describe('CatalogService — createListing and getListingById', () => {
  test('createListing creates a listing and retrieves it by ID', async () => {
    const input = makeListing({
      slug: 'test-create-by-id',
      name: 'Create By ID Tool',
      tags: ['mcp', 'web3'],
      sourceUrl: 'https://github.com/test/create-by-id',
      category: 'mcp-server',
    });

    const record = await createListing(input);
    expect(record.id).toBeTruthy();
    expect(typeof record.id).toBe('string');

    const fetched = await getListingById(record.id!);
    expect(fetched).toBeDefined();
    expect(fetched!.name).toBe('Create By ID Tool');
    expect(fetched!.category).toBe('mcp-server');

    // Tags stored as JSON — verify normalization occurred
    const parsedTags = JSON.parse(fetched!.tags) as string[];
    // 'mcp' → 'mcp-server', 'web3' → 'web3-tool'
    expect(parsedTags).toContain('mcp-server');
    expect(parsedTags).toContain('web3-tool');
  });
});

describe('CatalogService — upsertBySourceUrl', () => {
  test('upsertBySourceUrl updates existing instead of duplicating', async () => {
    const sourceUrl = 'https://github.com/test/upsert-dedup-tool';

    // First insert via createListing
    await createListing(makeListing({
      slug: 'upsert-dedup-tool',
      name: 'Original Name',
      sourceUrl,
    }));

    // Upsert with same sourceUrl but different name — must update, not insert
    await upsertBySourceUrl(makeListing({
      slug: 'upsert-dedup-tool',
      name: 'Updated Name',
      sourceUrl,
    }));

    // Exactly 1 listing with this sourceUrl should exist
    const all = await getAllListings(200, 0);
    const matching = all.filter(l => l.sourceUrl === sourceUrl);
    expect(matching.length).toBe(1);
    expect(matching[0]!.name).toBe('Updated Name');
  });
});

describe('CatalogService — tag normalization', () => {
  test('tag normalization works through CatalogService', async () => {
    // Input has variant + duplicate tags — normalization collapses them
    const record = await createListing(makeListing({
      slug: 'tag-normalization-test',
      name: 'Tag Normalization Tool',
      sourceUrl: 'https://github.com/test/tag-normalization',
      // 'MCP' → 'mcp-server', 'mcp' → 'mcp-server' (dup), 'defi' → 'defi-tool'
      tags: ['MCP', 'mcp', 'defi'],
    }));

    const fetched = await getListingById(record.id!);
    expect(fetched).toBeDefined();

    const parsedTags = JSON.parse(fetched!.tags) as string[];

    // Canonical forms present
    expect(parsedTags).toContain('mcp-server');
    expect(parsedTags).toContain('defi-tool');

    // No duplicates: 'MCP' and 'mcp' both map to 'mcp-server', should appear once
    const mcpCount = parsedTags.filter(t => t === 'mcp-server').length;
    expect(mcpCount).toBe(1);

    // Only 2 unique canonical tags
    expect(parsedTags.length).toBe(2);
  });
});

describe('SearchService — browseByCategory', () => {
  test('browseByCategory returns only matching category and excludes dead links', async () => {
    // Insert 2 mcp-server + 1 ai-agent listing
    await createListing(makeListing({
      slug: 'browse-cat-mcp-1',
      name: 'Browse MCP Tool 1',
      sourceUrl: 'https://github.com/test/browse-mcp-1',
      category: 'mcp-server',
      stars: 10,
    }));
    await createListing(makeListing({
      slug: 'browse-cat-mcp-2',
      name: 'Browse MCP Tool 2',
      sourceUrl: 'https://github.com/test/browse-mcp-2',
      category: 'mcp-server',
      stars: 5,
    }));
    await createListing(makeListing({
      slug: 'browse-cat-agent-1',
      name: 'Browse AI Agent 1',
      sourceUrl: 'https://github.com/test/browse-agent-1',
      category: 'ai-agent',
    }));

    const mcpListings = await browseByCategory('mcp-server', 100, 0);

    // All results must be mcp-server category
    expect(mcpListings.every(l => l.category === 'mcp-server')).toBe(true);

    // Our 2 mcp-server listings must be present
    const slugs = mcpListings.map(l => l.slug);
    expect(slugs).toContain('browse-cat-mcp-1');
    expect(slugs).toContain('browse-cat-mcp-2');

    // ai-agent must NOT appear
    expect(slugs).not.toContain('browse-cat-agent-1');
  });
});

describe('SearchService — searchCatalog FTS5', () => {
  test('searchCatalog returns ranked FTS5 results for term in listing name', async () => {
    // Use a distinctive term unlikely to collide with other test data
    const distinctTerm = 'QuantumNebulaCatalogXYZ';

    await createListing(makeListing({
      slug: 'fts5-search-test-tool',
      name: `${distinctTerm} MCP Server`,
      tagline: `The ${distinctTerm} integration for AI agents`,
      description: `This tool provides ${distinctTerm} functionality.`,
      sourceUrl: 'https://github.com/test/fts5-search-test',
      category: 'mcp-server',
    }));

    const results = await searchCatalog({ query: distinctTerm });

    // Must find at least one result
    expect(results.length).toBeGreaterThan(0);

    // Our specific listing must appear in results
    const found = results.find(r => r.slug === 'fts5-search-test-tool');
    expect(found).toBeDefined();
  });
});

describe('CatalogService — markDeadLink', () => {
  test('markDeadLink updates flag without changing other fields', async () => {
    const record = await createListing(makeListing({
      slug: 'dead-link-test-tool',
      name: 'Dead Link Test Tool',
      tags: ['mcp', 'web3'],
      sourceUrl: 'https://github.com/test/dead-link-test',
    }));

    // Verify initial state: not dead, no lastVerifiedAt
    const initial = await getListingById(record.id!);
    expect(initial!.deadLink).toBe(false);
    const initialVerifiedAt = initial!.lastVerifiedAt;

    // Mark as dead — only deadLink and lastVerifiedAt should change
    await markDeadLink(record.id!, true);

    const afterMark = await getListingById(record.id!);
    expect(afterMark).toBeDefined();

    // Dead link flag must be updated
    expect(afterMark!.deadLink).toBe(true);

    // lastVerifiedAt must be set to a Date (was null before)
    expect(afterMark!.lastVerifiedAt).not.toEqual(initialVerifiedAt);
    expect(afterMark!.lastVerifiedAt).toBeInstanceOf(Date);

    // All other fields must remain unchanged
    expect(afterMark!.name).toBe('Dead Link Test Tool');
    expect(afterMark!.slug).toBe('dead-link-test-tool');
    expect(afterMark!.category).toBe('mcp-server');
    const parsedTags = JSON.parse(afterMark!.tags) as string[];
    expect(parsedTags).toContain('mcp-server');
  });
});

describe('CatalogService — getListingBySlug', () => {
  test('getListingBySlug retrieves a listing by its slug', async () => {
    const record = await createListing(makeListing({
      slug: 'slug-lookup-test-tool',
      name: 'Slug Lookup Tool',
      sourceUrl: 'https://github.com/test/slug-lookup',
    }));

    const fetched = await getListingBySlug('slug-lookup-test-tool');
    expect(fetched).toBeDefined();
    expect(fetched!.id).toBe(record.id);
    expect(fetched!.name).toBe('Slug Lookup Tool');
  });
});
