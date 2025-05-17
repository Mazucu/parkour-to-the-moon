// src/utils/retry.ts

import { sleep } from "./sleep";

export interface RetryOptions {
  retries?: number; // Maximum number of retries
  factor?: number; // How much to increase delay each retry
  minTimeout?: number; // First retry delay (ms)
  maxTimeout?: number; // Maximum delay between retries (ms)
  shouldRetry?: (err: any) => boolean; // Function to decide if we should retry
  jitter?: boolean; // Add randomness to avoid all clients retrying at once
  onRetry?: (err: any, attempt: number, delay: number) => void; // Callback
}

/**
 * Get delay info from response headers if available
 */
function getDelayFromHeaders(err: any, defaultDelay: number): number {
  // Check if we have a Retry-After header
  try {
    if (err.headers && err.headers.get) {
      const retryAfter = err.headers.get("retry-after");
      if (retryAfter) {
        // Convert seconds to milliseconds or parse date
        if (/^\d+$/.test(retryAfter)) {
          return parseInt(retryAfter, 10) * 1000;
        } else {
          const retryDate = new Date(retryAfter).getTime();
          return Math.max(0, retryDate - Date.now());
        }
      }
    }
  } catch (e) {
    // If header parsing fails, use default
    console.warn("Could not parse header, using default delay");
  }

  return defaultDelay;
}

/**
 * Calculate how long to wait before retrying
 */
function calculateDelay(
  attempt: number,
  err: any,
  options: RetryOptions
): number {
  const {
    factor = 2,
    minTimeout = 1000,
    maxTimeout = 30000,
    jitter = true,
  } = options;

  // Start with basic exponential backoff
  let delay = minTimeout * Math.pow(factor, attempt - 1);

  // Don't exceed max timeout
  delay = Math.min(delay, maxTimeout);

  // For rate limit errors (429), use header or longer delay
  if (err.message && err.message.includes("429")) {
    const rateDelay = getDelayFromHeaders(err, delay * 2);
    delay = Math.min(rateDelay, maxTimeout);
  }

  // Add jitter (randomness) to prevent all clients retrying at once
  if (jitter) {
    // Add +/- 30% random variation
    const jitterAmount = 0.7 + Math.random() * 0.6; // 0.7 to 1.3
    delay = Math.floor(delay * jitterAmount);
  }

  return delay;
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const { retries = 8, shouldRetry = () => true, onRetry } = options;
  let attempt = 0;

  while (true) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;

      // Stop retrying if we've reached max retries or shouldRetry returns false
      if (attempt > retries || !shouldRetry(err)) {
        if (attempt > retries) {
          console.error(
            `❌ Max retries (${retries}) reached. Last error:`,
            err.message || err
          );
        }
        throw err;
      }

      // Figure out how long to wait
      const delay = calculateDelay(attempt, err, options);

      // Log the retry
      if (err.message && err.message.includes("429")) {
        console.warn(
          `⏳ Rate limited! Retry ${attempt}/${retries} in ${Math.round(
            delay / 1000
          )}s`
        );
      } else {
        console.warn(
          `⚠ Retry ${attempt}/${retries} in ${Math.round(
            delay / 1000
          )}s: ${err.message || err}`
        );
      }

      // Call onRetry callback if provided
      if (onRetry) {
        onRetry(err, attempt, delay);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }
}
