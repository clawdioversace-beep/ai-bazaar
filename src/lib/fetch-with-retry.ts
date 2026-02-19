/**
 * HTTP fetch wrapper with exponential backoff retry logic.
 *
 * Retries on transient failures (429 rate limit, 5xx server errors) but
 * immediately returns non-retryable errors (4xx client errors except 429).
 *
 * Uses manual AbortController for timeout (not AbortSignal.timeout) to work
 * around Bun timeout handling bugs documented in Phase 2 research.
 *
 * @module fetch-with-retry
 */

export interface RetryOptions {
  /** Maximum number of attempts (including initial request). Default: 3 */
  maxAttempts?: number;
  /** Base delay in milliseconds before first retry. Default: 1000 */
  baseDelay?: number;
  /** Maximum delay cap in milliseconds. Default: 30000 */
  maxDelay?: number;
  /** Request timeout in milliseconds. Default: 10000 */
  timeout?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  baseDelay: 1000,
  maxDelay: 30000,
  timeout: 10000,
};

/**
 * Fetch with automatic retry on transient failures.
 *
 * Retry logic:
 * - Retries on HTTP 429 (rate limit) and 5xx (server errors)
 * - Does NOT retry on 4xx (client errors) except 429
 * - Exponential backoff with jitter: baseDelay * 2^(attempt-1) + random jitter
 * - Respects Retry-After header on 429 responses
 * - Manual AbortController timeout (Bun-compatible)
 *
 * @param url - URL to fetch
 * @param options - Standard fetch RequestInit options
 * @param retryOptions - Retry behavior configuration
 * @returns Response object from fetch
 * @throws Last error after all retries exhausted, or timeout error
 *
 * @example
 * ```ts
 * const response = await fetchWithRetry('https://api.github.com/repos/owner/repo', {
 *   headers: { Authorization: `Bearer ${token}` }
 * }, {
 *   maxAttempts: 5,
 *   baseDelay: 2000
 * });
 * ```
 */
export async function fetchWithRetry(
  url: string,
  options?: RequestInit,
  retryOptions?: RetryOptions
): Promise<Response> {
  const opts = { ...DEFAULT_OPTIONS, ...retryOptions };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    // Create manual AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), opts.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      // Clear timeout on successful fetch
      clearTimeout(timeoutId);

      // Check if response is retryable
      const isRetryable = response.status === 429 || response.status >= 500;

      // Non-retryable error (4xx except 429) — return immediately
      if (!isRetryable && response.status >= 400) {
        return response;
      }

      // Success (2xx or 3xx) — return immediately
      if (response.ok || response.status < 400) {
        return response;
      }

      // Retryable error — check if we have more attempts
      if (attempt === opts.maxAttempts) {
        // Last attempt failed — return the error response
        return response;
      }

      // Calculate delay for next retry
      let delay: number;

      if (response.status === 429) {
        // Check for Retry-After header
        const retryAfter = response.headers.get('Retry-After');
        if (retryAfter) {
          // Retry-After is in seconds — convert to milliseconds
          const retryAfterMs = parseInt(retryAfter, 10) * 1000;
          delay = Math.min(retryAfterMs, opts.maxDelay);
        } else {
          // No Retry-After — use exponential backoff
          delay = calculateBackoff(attempt, opts.baseDelay, opts.maxDelay);
        }
      } else {
        // 5xx error — use exponential backoff
        delay = calculateBackoff(attempt, opts.baseDelay, opts.maxDelay);
      }

      // Wait before retrying
      await Bun.sleep(delay);
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);

      // Save error for potential re-throw
      lastError = error instanceof Error ? error : new Error(String(error));

      // If this was the last attempt, throw the error
      if (attempt === opts.maxAttempts) {
        throw lastError;
      }

      // Calculate backoff and retry
      const delay = calculateBackoff(attempt, opts.baseDelay, opts.maxDelay);
      await Bun.sleep(delay);
    }
  }

  // Should never reach here, but TypeScript needs a return
  throw lastError || new Error('fetchWithRetry: max attempts exhausted');
}

/**
 * Calculate exponential backoff delay with jitter.
 *
 * Formula: baseDelay * 2^(attempt-1) + random jitter
 * Jitter range: 0 to exponentialDelay (100% jitter)
 *
 * @param attempt - Current attempt number (1-indexed)
 * @param baseDelay - Base delay in milliseconds
 * @param maxDelay - Maximum delay cap in milliseconds
 * @returns Delay in milliseconds
 */
function calculateBackoff(attempt: number, baseDelay: number, maxDelay: number): number {
  // Exponential: baseDelay * 2^(attempt-1)
  const exponential = baseDelay * Math.pow(2, attempt - 1);

  // Add jitter (0 to exponential)
  const jitter = Math.random() * exponential;

  // Cap at maxDelay
  return Math.min(exponential + jitter, maxDelay);
}
