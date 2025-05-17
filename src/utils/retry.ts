// src/utils/retry.ts

import { sleep } from "./sleep";

export interface RetryOptions {
  retries?: number; // Maximum number of retries (default 3)
  factor?: number; // Exponential backoff multiplier (default 2)
  minTimeout?: number; // Base delay in ms (default 100)
  maxTimeout?: number; // Maximum delay between retries in ms
  shouldRetry?: (err: any) => boolean; // Filter for retryable errors (default always true)
  jitter?: boolean; // Add randomness to backoff to avoid thundering herd
  onRetry?: (err: any, attempt: number, delay: number) => void; // Callback on retry
}

/**
 * Parse Retry-After header if present, or return default value
 */
function parseRetryAfterHeader(err: any, defaultMs: number): number {
  try {
    if (err.headers && err.headers.get) {
      const retryAfter = err.headers.get("retry-after");
      if (retryAfter) {
        // Could be in seconds or as a date
        if (/^\d+$/.test(retryAfter)) {
          return parseInt(retryAfter, 10) * 1000; // Convert seconds to ms
        } else {
          // It's a date
          const retryDate = new Date(retryAfter).getTime();
          return Math.max(0, retryDate - Date.now());
        }
      }
    }
  } catch (e) {
    // If we can't parse the header, just use the default
    console.warn(
      "Error parsing Retry-After header, using default delay"
    );
  }

  return defaultMs;
}

/**
 * Calculate backoff delay with special handling for 429 errors
 */
function calculateBackoff(
  attempt: number,
  err: any,
  {
    factor = 2,
    minTimeout = 100,
    maxTimeout = 30000,
    jitter = true,
  }: RetryOptions
): number {
  // Start with exponential backoff
  let delay = minTimeout * Math.pow(factor, attempt - 1);

  // Cap at maximum timeout
  delay = Math.min(delay, maxTimeout);

  // Special handling for rate limit errors
  if (err.message && err.message.includes("429")) {
    // Use header-specified delay if available, otherwise use a larger backoff
    const baseDelay = parseRetryAfterHeader(err, delay * 2);
    delay = Math.min(baseDelay, maxTimeout);
  }

  // Add jitter to prevent thundering herd
  if (jitter) {
    // Add +/- 30% random jitter
    const jitterFactor = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    delay = Math.floor(delay * jitterFactor);
  }

  return delay;
}

/**
 * Wraps a promise with exponential backoff retry logic.
 * Throws the last error if retries are exceeded or if shouldRetry returns false.
 */
export async function retry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions = {}
): Promise<T> {
  const {
    retries = 10, // Increased max retries for rate limit handling
    shouldRetry = () => true,
    onRetry,
  } = opts;

  let attempt = 0;
  let lastError: any;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      attempt++;

      // Check if we should retry
      if (attempt > retries || !shouldRetry(err)) {
        if (attempt > retries) {
          console.error(
            `❌ Max retries (${retries}) exceeded. Last error:`,
            err.message || err
          );
        }
        throw err;
      }

      // Calculate delay with special handling for rate limit errors
      const delay = calculateBackoff(attempt, err, opts);

      // Log the retry information
      if (err.message && err.message.includes("429")) {
        console.warn(
          `⏳ Rate limited! Retry #${attempt}/${retries} in ${Math.round(
            delay / 1000
          )}s...`
        );
      } else {
        console.warn(
          `⚠ Retry #${attempt}/${retries} in ${Math.round(
            delay / 1000
          )}s due to error:`,
          err.message || err
        );
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(err, attempt, delay);
      }

      await sleep(delay);
    }
  }
}
