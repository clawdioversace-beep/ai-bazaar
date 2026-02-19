/**
 * Unit tests for source-specific normalizers.
 *
 * Tests verify that GitHub, npm, and HuggingFace raw API data transforms
 * correctly into CatalogEntryInput objects that pass CatalogEntrySchema validation.
 *
 * Each normalizer test suite includes:
 * - Valid input with all fields → passes schema validation
 * - Category detection from tags/topics/keywords
 * - Edge cases (null/missing fields, fallbacks)
 */

import { describe, test, expect } from 'bun:test';
import { CatalogEntrySchema } from '../catalog-schema';

describe('GitHub normalizer', () => {
  test('valid repo with all fields passes CatalogEntrySchema', async () => {
    const { normalizeGitHubRepo } = await import('../../scrapers/normalizers/github-normalizer');

    const mockRepo = {
      full_name: 'modelcontextprotocol/servers',
      description: 'Official MCP servers maintained by Anthropic',
      html_url: 'https://github.com/modelcontextprotocol/servers',
      homepage: 'https://modelcontextprotocol.io',
      stargazers_count: 1234,
      topics: ['mcp', 'ai', 'agents'],
      license: { spdx_id: 'MIT' },
      language: 'TypeScript',
    };

    const result = normalizeGitHubRepo(mockRepo);

    // Should pass schema validation
    const validated = CatalogEntrySchema.parse(result);
    expect(validated.slug).toBe('modelcontextprotocol-servers');
    expect(validated.name).toBe('modelcontextprotocol/servers');
    expect(validated.sourceUrl).toBe('https://github.com/modelcontextprotocol/servers');
    expect(validated.docsUrl).toBe('https://modelcontextprotocol.io');
    expect(validated.licenseType).toBe('MIT');
    expect(validated.runtime).toBe('node');
    expect(validated.stars).toBe(1234);
    expect(validated.submittedBy).toBe('github-scraper');
  });

  test('repo with MCP topic has mcp-server category and mcpCompatible=true', async () => {
    const { normalizeGitHubRepo } = await import('../../scrapers/normalizers/github-normalizer');

    const mockRepo = {
      full_name: 'owner/mcp-server-test',
      description: 'Test MCP server',
      html_url: 'https://github.com/owner/mcp-server-test',
      homepage: null,
      stargazers_count: 42,
      topics: ['mcp', 'server'],
      license: null,
      language: 'Python',
    };

    const result = normalizeGitHubRepo(mockRepo);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.category).toBe('mcp-server');
    expect(validated.mcpCompatible).toBe(true);
    expect(validated.runtime).toBe('python');
  });

  test('repo with null description and license uses fallbacks', async () => {
    const { normalizeGitHubRepo } = await import('../../scrapers/normalizers/github-normalizer');

    const mockRepo = {
      full_name: 'owner/minimal-repo',
      description: null,
      html_url: 'https://github.com/owner/minimal-repo',
      homepage: '',
      stargazers_count: 0,
      topics: [],
      license: null,
      language: null,
    };

    const result = normalizeGitHubRepo(mockRepo);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.tagline).toContain('GitHub repository');
    expect(validated.description).toContain('No description provided');
    expect(validated.licenseType).toBeUndefined();
    expect(validated.runtime).toBeUndefined();
    expect(validated.docsUrl).toBeUndefined();
  });
});

describe('npm normalizer', () => {
  test('valid package with repository link prefers repository over npm page', async () => {
    const { normalizeNpmPackage } = await import('../../scrapers/normalizers/npm-normalizer');

    const mockPackage = {
      name: '@anthropic/mcp-client',
      version: '1.0.0',
      description: 'MCP client library for TypeScript',
      keywords: ['mcp', 'client', 'anthropic'],
      links: {
        npm: 'https://www.npmjs.com/package/@anthropic/mcp-client',
        homepage: 'https://modelcontextprotocol.io',
        repository: 'https://github.com/anthropics/mcp-typescript',
      },
      publisher: { username: 'anthropic' },
    };

    const result = normalizeNpmPackage(mockPackage);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.slug).toBe('anthropic-mcp-client');
    expect(validated.name).toBe('@anthropic/mcp-client');
    expect(validated.sourceUrl).toBe('https://github.com/anthropics/mcp-typescript');
    expect(validated.docsUrl).toBe('https://modelcontextprotocol.io');
    expect(validated.runtime).toBe('node');
    expect(validated.submittedBy).toBe('npm-scraper');
  });

  test('package with MCP keyword has mcp-server category', async () => {
    const { normalizeNpmPackage } = await import('../../scrapers/normalizers/npm-normalizer');

    const mockPackage = {
      name: 'mcp-server-example',
      version: '2.0.0',
      description: 'Example MCP server implementation',
      keywords: ['mcp', 'server'],
      links: {
        npm: 'https://www.npmjs.com/package/mcp-server-example',
      },
      publisher: { username: 'testuser' },
    };

    const result = normalizeNpmPackage(mockPackage);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.category).toBe('mcp-server');
  });

  test('package with no keywords and no repository uses npm link', async () => {
    const { normalizeNpmPackage } = await import('../../scrapers/normalizers/npm-normalizer');

    const mockPackage = {
      name: 'simple-package',
      version: '1.0.0',
      description: undefined,
      keywords: undefined,
      links: {
        npm: 'https://www.npmjs.com/package/simple-package',
      },
      publisher: { username: 'dev' },
    };

    const result = normalizeNpmPackage(mockPackage);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.sourceUrl).toBe('https://www.npmjs.com/package/simple-package');
    expect(validated.tags).toEqual([]);
    expect(validated.tagline).toContain('npm package');
  });
});

describe('HuggingFace normalizer', () => {
  test('valid model has correct sourceUrl format', async () => {
    const { normalizeHuggingFaceEntry } = await import('../../scrapers/normalizers/huggingface-normalizer');

    const mockModel = {
      id: 'anthropic/claude-3-sonnet',
      tags: ['llm', 'chatbot', 'anthropic'],
      downloads: 50000,
      likes: 1500,
      private: false,
    };

    const result = normalizeHuggingFaceEntry(mockModel);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.slug).toBe('anthropic-claude-3-sonnet');
    expect(validated.name).toBe('anthropic/claude-3-sonnet');
    expect(validated.sourceUrl).toBe('https://huggingface.co/anthropic/claude-3-sonnet');
    expect(validated.stars).toBe(1500);
    expect(validated.downloads).toBe(50000);
    expect(validated.submittedBy).toBe('huggingface-scraper');
  });

  test('model with agent tag has ai-agent category', async () => {
    const { normalizeHuggingFaceEntry } = await import('../../scrapers/normalizers/huggingface-normalizer');

    const mockModel = {
      id: 'username/agent-model',
      tags: ['agent', 'reasoning', 'planning'],
      downloads: 1000,
      likes: 50,
      private: false,
    };

    const result = normalizeHuggingFaceEntry(mockModel);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.category).toBe('ai-agent');
  });

  test('model with no tags and no downloads uses defaults gracefully', async () => {
    const { normalizeHuggingFaceEntry } = await import('../../scrapers/normalizers/huggingface-normalizer');

    const mockModel = {
      id: 'user/minimal-model',
      tags: undefined,
      downloads: undefined,
      likes: undefined,
      private: undefined,
    };

    const result = normalizeHuggingFaceEntry(mockModel);
    const validated = CatalogEntrySchema.parse(result);

    expect(validated.sourceUrl).toBe('https://huggingface.co/user/minimal-model');
    expect(validated.stars).toBe(0);
    expect(validated.downloads).toBe(0);
    expect(validated.tags).toEqual([]);
    expect(validated.category).toBe('framework'); // Default fallback
  });
});
