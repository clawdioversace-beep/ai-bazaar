/**
 * Unit tests for fetchWithRetry HTTP retry utility.
 *
 * Tests verify retry behavior for different HTTP status codes:
 * - 429 (rate limit) and 5xx (server errors) trigger retry with exponential backoff
 * - 4xx (non-429) errors return immediately without retry
 * - Retry-After header is respected on 429 responses
 * - maxAttempts limit is enforced
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test';

describe('fetchWithRetry', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test('successful response returns immediately without retry', async () => {
    const { fetchWithRetry } = await import('../fetch-with-retry');

    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount++;
      return new Response('success', { status: 200 });
    }) as any;

    const response = await fetchWithRetry('https://example.com');

    expect(response.status).toBe(200);
    expect(callCount).toBe(1);
  });

  test('429 response triggers retry', async () => {
    const { fetchWithRetry } = await import('../fetch-with-retry');

    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('rate limited', { status: 429 });
      }
      return new Response('success', { status: 200 });
    }) as any;

    const response = await fetchWithRetry('https://example.com', {}, { baseDelay: 1 });

    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
  });

  test('5xx response triggers retry', async () => {
    const { fetchWithRetry } = await import('../fetch-with-retry');

    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount++;
      if (callCount === 1) {
        return new Response('service unavailable', { status: 503 });
      }
      return new Response('success', { status: 200 });
    }) as any;

    const response = await fetchWithRetry('https://example.com', {}, { baseDelay: 1 });

    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
  });

  test('4xx (non-429) response returns immediately without retry', async () => {
    const { fetchWithRetry } = await import('../fetch-with-retry');

    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount++;
      return new Response('not found', { status: 404 });
    }) as any;

    const response = await fetchWithRetry('https://example.com');

    expect(response.status).toBe(404);
    expect(callCount).toBe(1);
  });

  test('maxAttempts is respected', async () => {
    const { fetchWithRetry } = await import('../fetch-with-retry');

    let callCount = 0;
    globalThis.fetch = mock(async () => {
      callCount++;
      return new Response('server error', { status: 500 });
    }) as any;

    try {
      await fetchWithRetry('https://example.com', {}, { maxAttempts: 3, baseDelay: 1 });
      expect(true).toBe(false); // Should not reach here
    } catch (error) {
      expect(callCount).toBe(3);
    }
  });

  test('Retry-After header is respected', async () => {
    const { fetchWithRetry } = await import('../fetch-with-retry');

    let callCount = 0;
    const startTime = Date.now();

    globalThis.fetch = mock(async () => {
      callCount++;
      if (callCount === 1) {
        // Return 429 with Retry-After: 1 second
        return new Response('rate limited', {
          status: 429,
          headers: { 'Retry-After': '1' }
        });
      }
      return new Response('success', { status: 200 });
    }) as any;

    const response = await fetchWithRetry('https://example.com', {}, { baseDelay: 1 });
    const elapsed = Date.now() - startTime;

    expect(response.status).toBe(200);
    expect(callCount).toBe(2);
    // Should wait at least 1000ms (1 second from Retry-After header)
    expect(elapsed).toBeGreaterThanOrEqual(1000);
  });
});
