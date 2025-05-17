import { IMegaverseApiClient } from "../api/MegaverseApiClient";
import { runtWithConcurrencyLimit } from "../utils/concurrency";
import { retry, RetryOptions } from "../utils/retry";
import { createProgressLogger } from "../utils/progressLogger";
import { sleep } from "../utils/sleep";

export class MegaverseBuilder {
  // Default values for concurrency control
  private concurrency = 3; // Start conservative
  private readonly maxConcurrency = 10;
  private readonly adjustIntervalMs = 10_000; // cada 10s reevaluamos
  private error429Count = 0;
  private adjustTimer: NodeJS.Timeout;

  // Batch processing parameters
  private readonly batchSize = 20; // Process tasks in small batches
  private readonly batchDelayMs = 3000; // Delay between batches

  constructor(private readonly apiClient: IMegaverseApiClient) {
    // Arrancamos el "termómetro" de 429s
    this.adjustTimer = setInterval(
      () => this.adjustConcurrency(),
      this.adjustIntervalMs
    );
  }

  /**
   * Returns a small progress-logger fn that prints
   * "🪐 <label>: done/total" each time you call it.
   */
  private makeProgressLogger(
    label: string,
    total: number
  ): () => void {
    let done = 0;
    return () => {
      done++;
      console.log(`🪐 ${label}: ${done}/${total}`);
    };
  }

  /** Llamar desde el retry cuando veas un 429 */
  private record429() {
    this.error429Count++;
  }

  /** Cada intervalo observamos cuántos 429 hubo y subimos/bajamos concurrency */
  private adjustConcurrency() {
    // More aggressive adjustment down with exponential backing off
    if (this.error429Count === 0) {
      // If no errors, slowly increase concurrency (more cautious growth)
      this.concurrency = Math.min(
        this.concurrency + 1,
        this.maxConcurrency
      );
    } else {
      // If errors, aggressively reduce concurrency based on error count
      const reduction = Math.min(
        this.error429Count,
        this.concurrency - 1
      );
      this.concurrency = Math.max(1, this.concurrency - reduction);
    }

    console.log(
      `↔ Adjusted concurrency to ${this.concurrency} after ${this.error429Count} rate-limit errors`
    );
    this.error429Count = 0;
  }

  /** Creamos un retryOpts "ligado" a este builder para contar 429 */
  private makeRetryOpts(): RetryOptions {
    return {
      retries: 10,
      factor: 2,
      minTimeout: 1000, // Start with a higher base timeout
      maxTimeout: 60000, // Allow longer backoff for severe rate limiting
      shouldRetry: (err: Error) => {
        const is429 = /429/.test(err.message);
        if (is429) this.record429();
        // retryamos también 5xx
        return is429 || /5\d{2}/.test(err.message);
      },
    };
  }

  /**
   * Process tasks in batches to better handle rate limits
   */
  private async processBatches<T>(
    allTasks: (() => Promise<T>)[],
    concurrency: number
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];
    const batches = [];

    // Create batches of tasks
    for (let i = 0; i < allTasks.length; i += this.batchSize) {
      batches.push(allTasks.slice(i, i + this.batchSize));
    }

    console.log(
      `📦 Processing ${batches.length} batches of ~${this.batchSize} tasks each`
    );

    // Process each batch with concurrency limit, with delay between batches
    for (let i = 0; i < batches.length; i++) {
      const batchTasks = batches[i];
      console.log(
        `📦 Starting batch ${i + 1}/${batches.length} with ${
          batchTasks.length
        } tasks`
      );

      const batchResults = await runtWithConcurrencyLimit(
        batchTasks,
        concurrency
      );
      results.push(...batchResults);

      // Check if we need to reduce concurrency based on batch results
      const failedWith429 = batchResults.filter(
        (r) =>
          r.status === "rejected" &&
          (r as PromiseRejectedResult).reason.message.includes("429")
      ).length;

      if (failedWith429 > 0) {
        // If we got rate limited in this batch, reduce concurrency for next batch
        this.error429Count += failedWith429;
        this.adjustConcurrency();
      }

      // Add delay between batches if not the last batch
      if (i < batches.length - 1) {
        console.log(
          `⏱ Pausing between batches for ${this.batchDelayMs}ms`
        );
        await sleep(this.batchDelayMs);
      }
    }

    return results;
  }

  buildXPattern = async (matrixSize: number): Promise<void> => {
    const retryOpts = this.makeRetryOpts();
    const tasks: (() => Promise<void>)[] = [];

    for (let i = 2; i < matrixSize - 2; i++) {
      tasks.push(() =>
        retry(() => this.apiClient.createPolyanet(i, i), retryOpts)
      );
      tasks.push(() =>
        retry(
          () => this.apiClient.createPolyanet(i, matrixSize - i),
          retryOpts
        )
      );
    }

    const results = await this.processBatches(
      tasks,
      this.concurrency
    );
    const failures = results.filter((r) => r.status === "rejected");
    if (failures.length) {
      console.log(`❌ Failed ${failures.length} operations:`);
      failures.forEach((f) =>
        console.log(
          `- ${(f as PromiseRejectedResult).reason.message}`
        )
      );
    }

    console.log("✅ Cruz cósmica completada");
  };

  public buildUniverse = async (): Promise<void> => {
    const retryOpts = this.makeRetryOpts();
    const goalMap = await this.apiClient.getGoalMap();
    const rawTasks: Array<() => Promise<void>> = [];

    // 1) collect every create-task
    for (let r = 0; r < goalMap.length; r++) {
      for (let c = 0; c < goalMap[r].length; c++) {
        const cell = goalMap[r][c];
        if (cell === "SPACE") continue;

        rawTasks.push(() =>
          retry(() => {
            switch (cell) {
              case "POLYANET":
                return this.apiClient.createPolyanet(r, c);
              case "RED_SOLOON":
                return this.apiClient.createSoloon(r, c, "red");
              case "BLUE_SOLOON":
                return this.apiClient.createSoloon(r, c, "blue");
              case "PURPLE_SOLOON":
                return this.apiClient.createSoloon(r, c, "purple");
              case "WHITE_SOLOON":
                return this.apiClient.createSoloon(r, c, "white");
              case "UP_COMETH":
                return this.apiClient.createCometh(r, c, "up");
              case "DOWN_COMETH":
                return this.apiClient.createCometh(r, c, "down");
              case "LEFT_COMETH":
                return this.apiClient.createCometh(r, c, "left");
              case "RIGHT_COMETH":
                return this.apiClient.createCometh(r, c, "right");
              default:
                return Promise.resolve();
            }
          }, retryOpts)
        );
      }
    }

    const total = rawTasks.length;
    if (total === 0) {
      console.log("✅ No objects to build.");
      return;
    }

    console.log(`🚀 Building universe: ${total} tasks to run…`);

    // 2) wrap with progress logger (every 10, and on the final one)
    const logProgress = createProgressLogger("created", total, 10);
    const tasks = rawTasks.map((fn) => async () => {
      try {
        await fn();
      } catch {
        // swallow errors, still count
      } finally {
        logProgress();
      }
    });

    // 3) execute with batch processing
    await this.processBatches(tasks, this.concurrency);

    console.log("✅ Full universe build complete");
  };

  /* universe-service.ts ----------------------------------------------------- */
  public resetUniverseToBlue = async (): Promise<void> => {
    const grid = await this.apiClient.getCurrentMap();

    // 1) Construye las tareas ----------------------------------------------
    const rawTasks: Array<() => Promise<void>> = [];
    grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (!cell) return;

        const deleteCall = (() => {
          switch (cell.type) {
            case 0:
              return () => this.apiClient.deletePolyanet(r, c);
            case 1:
              return () => this.apiClient.deleteSoloon(r, c);
            case 2:
              return () => this.apiClient.deleteCometh(r, c);
            default:
              return null;
          }
        })();
        if (!deleteCall) return;

        rawTasks.push(() => retry(deleteCall, this.makeRetryOpts()));
      })
    );

    if (rawTasks.length === 0) {
      console.log("✅ Universe already clear.");
      return;
    }

    // 2) Logger de progreso --------------------------------------------------
    const logProgress = createProgressLogger(
      "deleted",
      rawTasks.length,
      10
    );

    // 3) Wrap: intenta-borra-log-pase-lo-que-pase ----------------------------
    const tasks = rawTasks.map((fn) => async () => {
      try {
        await fn();
      } catch (err) {
        console.error("❗️ No se pudo eliminar un objeto:", err);
      } finally {
        logProgress(); // <-- nunca se salta
      }
    });

    console.log(
      `🧹 Deleting ${tasks.length} objects from current map…`
    );

    // Use batch processing for deletion tasks
    await this.processBatches(tasks, this.concurrency);
    console.log("✅ Full universe cleaned");
  };

  stopAdjusting() {
    clearInterval(this.adjustTimer);
  }
}
