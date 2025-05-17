// src/utils/concurrency.ts

import { sleep } from "./sleep";

/**
 * Simple rate limiter to avoid hitting API limits
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond

  constructor(maxRequests = 10, requestsPerSecond = 2) {
    this.tokens = maxRequests;
    this.lastRefill = Date.now();
    this.maxTokens = maxRequests;
    this.refillRate = requestsPerSecond / 1000;
  }

  async getToken(): Promise<void> {
    this.refill();

    if (this.tokens >= 1) {
      // We have tokens available, use one
      this.tokens -= 1;
      return;
    }

    // Wait until we have a token
    const waitTime = Math.ceil((1 - this.tokens) / this.refillRate);
    await sleep(waitTime);
    this.tokens -= 1;
  }

  private refill(): void {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const newTokens = timePassed * this.refillRate;

    this.tokens = Math.min(this.maxTokens, this.tokens + newTokens);
    this.lastRefill = now;
  }

  // Slow down when we hit rate limits
  adjustForRateLimit(): void {
    // Reduce rate by 20%
    this.refillRate = this.refillRate * 0.8;
    console.log(
      `⚙️ Slowing down: ${(this.refillRate * 1000).toFixed(
        2
      )} req/sec`
    );
  }
}

/**
 * Runs tasks with a limit on how many can run at once
 */
export async function runtWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let i = 0;

  // Create a rate limiter that allows each worker to make requests
  const rateLimiter = new RateLimiter(limit * 2, limit * 0.5);

  // Create worker threads up to the concurrency limit
  const workers = new Array(limit).fill(0).map(async () => {
    while (i < tasks.length) {
      const current = i++;
      try {
        // Wait for permission from rate limiter
        await rateLimiter.getToken();

        const value = await tasks[current]();
        results[current] = { status: "fulfilled", value };
      } catch (error: any) {
        results[current] = { status: "rejected", reason: error };

        // If we hit a rate limit, slow down
        if (error.message && error.message.includes("429")) {
          rateLimiter.adjustForRateLimit();
        }
      }
    }
  });

  await Promise.all(workers);
  return results;
}
