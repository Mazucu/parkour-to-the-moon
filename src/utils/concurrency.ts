// src/utils/concurrency.ts

import { sleep } from "./sleep";

/**
 * A simple token bucket rate limiter to avoid 429 errors
 */
class RateLimiter {
  private tokens: number;
  private lastRefill: number;
  private maxTokens: number;
  private refillRate: number; // tokens per millisecond

  constructor(maxTokens = 10, refillRatePerSecond = 2) {
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
    this.maxTokens = maxTokens;
    this.refillRate = refillRatePerSecond / 1000;
  }

  async getToken(): Promise<void> {
    // Refill tokens based on time elapsed
    this.refill();

    if (this.tokens >= 1) {
      // If tokens are available, consume one and proceed
      this.tokens -= 1;
      return;
    }

    // Otherwise, calculate how long to wait for next token
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

  /**
   * Adjust rate limiter settings based on observed API response patterns
   */
  adjustRateLimit(decreaseFactor = 0.8): void {
    // Reduce rate when hitting 429s
    this.refillRate = this.refillRate * decreaseFactor;
    console.log(
      `⚙️ Adjusted rate limiter: ${(this.refillRate * 1000).toFixed(
        2
      )} requests/second`
    );
  }
}

/**
 * Ejecuta un array de tareas (funciones que devuelven promesas) con un límite de concurrencia.
 * Devuelve un array de resultados con estado y valor/razón de cada tarea.
 */
export async function runtWithConcurrencyLimit<T>(
  tasks: (() => Promise<T>)[],
  limit: number
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = [];
  let i = 0;

  // Create a rate limiter with reasonable default values
  const rateLimiter = new RateLimiter(limit * 2, limit * 0.5);

  const runners = new Array(limit).fill(0).map(async () => {
    while (i < tasks.length) {
      const current = i++;
      try {
        // Wait for rate limiter before executing task
        await rateLimiter.getToken();

        const value = await tasks[current]();
        results[current] = { status: "fulfilled", value };
      } catch (error: any) {
        results[current] = { status: "rejected", reason: error };

        // If we hit a rate limit error, adjust the rate limiter
        if (error.message && error.message.includes("429")) {
          rateLimiter.adjustRateLimit();
        }
      }
    }
  });
  await Promise.all(runners);
  return results;
}
