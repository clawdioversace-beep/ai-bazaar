/**
 * HuggingFace Hub scraper.
 *
 * Fetches models and spaces by tag using the HuggingFace Hub SDK with
 * fallback to direct API calls, normalizes each entry through
 * huggingface-normalizer, and upserts into the catalog via CatalogService.
 *
 * Strategy:
 * 1. Try @huggingface/hub SDK first (listModels, listSpaces)
 * 2. If SDK yields 0 results, fall back to direct API fetch
 *
 * Rate limiting:
 * - HuggingFace has no documented rate limits for public API reads
 * - Uses optional HUGGINGFACE_TOKEN for authenticated requests
 *
 * @module huggingface-scraper
 */

import { listModels, listSpaces } from '@huggingface/hub';
import { fetchWithRetry } from '../lib/fetch-with-retry';
import { normalizeHuggingFaceEntry } from './normalizers/huggingface-normalizer';
import { upsertBySourceUrl } from '../services/catalog';

/**
 * Scrape HuggingFace models and spaces by tag and upsert into catalog.
 *
 * @param tag - HuggingFace tag to search for (e.g. 'agent', 'web3')
 * @param maxResults - Maximum number of entries to process (default 200)
 * @returns Object with processed count and error count
 */
export async function scrapeHuggingFace(
  tag: string,
  maxResults = 200
): Promise<{ processed: number; errors: number }> {
  const accessToken = process.env.HUGGINGFACE_TOKEN;
  if (!accessToken) {
    console.warn(
      '[huggingface-scraper] HUGGINGFACE_TOKEN not set — using unauthenticated mode. ' +
      'Set HUGGINGFACE_TOKEN for higher rate limits.'
    );
  }

  let processed = 0;
  let errors = 0;

  try {
    // Try SDK approach first for models
    console.log(`[huggingface-scraper] Fetching models for tag=${tag} via SDK...`);
    const modelsProcessed = await scrapeModelsSDK(tag, maxResults - processed - errors, accessToken);
    processed += modelsProcessed.processed;
    errors += modelsProcessed.errors;

    // If we haven't hit maxResults, try spaces
    if (processed + errors < maxResults) {
      console.log(`[huggingface-scraper] Fetching spaces for tag=${tag} via SDK...`);
      const spacesProcessed = await scrapeSpacesSDK(tag, maxResults - processed - errors, accessToken);
      processed += spacesProcessed.processed;
      errors += spacesProcessed.errors;
    }

    // If SDK yielded 0 results, try fallback direct API
    if (processed === 0 && errors === 0) {
      console.log(`[huggingface-scraper] SDK returned 0 results, trying direct API fallback...`);
      const fallbackProcessed = await scrapeFallbackAPI(tag, maxResults, accessToken);
      processed += fallbackProcessed.processed;
      errors += fallbackProcessed.errors;
    }

    console.log(`[huggingface-scraper] tag=${tag}: ${processed} processed, ${errors} errors`);
  } catch (err) {
    console.error(`[huggingface-scraper] Fatal error for tag=${tag}: ${err}`);
    throw err;
  }

  return { processed, errors };
}

/**
 * Scrape models using @huggingface/hub SDK.
 */
async function scrapeModelsSDK(
  tag: string,
  maxResults: number,
  accessToken?: string
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Use SDK's listModels iterator with search query
    const iterator = listModels({
      search: { query: tag },
      credentials: accessToken ? { accessToken } : undefined,
    });

    for await (const model of iterator) {
      if (processed + errors >= maxResults) {
        break;
      }

      try {
        // Normalize model data to CatalogEntryInput
        const entry = normalizeHuggingFaceEntry(model);

        // Upsert into catalog
        await upsertBySourceUrl(entry);

        processed++;
      } catch (err) {
        console.error(`[huggingface-scraper] Failed model: ${(model as any).id || 'unknown'}: ${err}`);
        errors++;
      }
    }
  } catch (err) {
    console.error(`[huggingface-scraper] SDK listModels error: ${err}`);
    // Don't throw — let fallback handle it
  }

  return { processed, errors };
}

/**
 * Scrape spaces using @huggingface/hub SDK.
 */
async function scrapeSpacesSDK(
  tag: string,
  maxResults: number,
  accessToken?: string
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Use SDK's listSpaces iterator with search query
    const iterator = listSpaces({
      search: { query: tag },
      credentials: accessToken ? { accessToken } : undefined,
    });

    for await (const space of iterator) {
      if (processed + errors >= maxResults) {
        break;
      }

      try {
        // Normalize space data to CatalogEntryInput
        const entry = normalizeHuggingFaceEntry(space);

        // Upsert into catalog
        await upsertBySourceUrl(entry);

        processed++;
      } catch (err) {
        console.error(`[huggingface-scraper] Failed space: ${(space as any).id || 'unknown'}: ${err}`);
        errors++;
      }
    }
  } catch (err) {
    console.error(`[huggingface-scraper] SDK listSpaces error: ${err}`);
    // Don't throw — let fallback handle it
  }

  return { processed, errors };
}

/**
 * Fallback scraper using direct HuggingFace API.
 */
async function scrapeFallbackAPI(
  tag: string,
  maxResults: number,
  accessToken?: string
): Promise<{ processed: number; errors: number }> {
  let processed = 0;
  let errors = 0;

  try {
    // Try models API
    const modelsUrl = `https://huggingface.co/api/models?search=${encodeURIComponent(tag)}&limit=100`;
    const modelsResponse = await fetchWithRetry(
      modelsUrl,
      {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      },
      { maxAttempts: 3, baseDelay: 1000, timeout: 15000 }
    );

    if (modelsResponse.ok) {
      const models = await modelsResponse.json();
      if (Array.isArray(models)) {
        for (const model of models) {
          if (processed + errors >= maxResults) {
            break;
          }

          try {
            const entry = normalizeHuggingFaceEntry(model);
            await upsertBySourceUrl(entry);
            processed++;
          } catch (err) {
            console.error(`[huggingface-scraper] Fallback model failed: ${err}`);
            errors++;
          }
        }
      }
    }

    // Try spaces API if we haven't hit maxResults
    if (processed + errors < maxResults) {
      const spacesUrl = `https://huggingface.co/api/spaces?search=${encodeURIComponent(tag)}&limit=100`;
      const spacesResponse = await fetchWithRetry(
        spacesUrl,
        {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        },
        { maxAttempts: 3, baseDelay: 1000, timeout: 15000 }
      );

      if (spacesResponse.ok) {
        const spaces = await spacesResponse.json();
        if (Array.isArray(spaces)) {
          for (const space of spaces) {
            if (processed + errors >= maxResults) {
              break;
            }

            try {
              const entry = normalizeHuggingFaceEntry(space);
              await upsertBySourceUrl(entry);
              processed++;
            } catch (err) {
              console.error(`[huggingface-scraper] Fallback space failed: ${err}`);
              errors++;
            }
          }
        }
      }
    }
  } catch (err) {
    console.error(`[huggingface-scraper] Fallback API error: ${err}`);
    // Don't throw — we tried our best
  }

  return { processed, errors };
}
