/* -------------------------------------------------------------------------- */
/*  MegaverseBuilder                                                          */
/* -------------------------------------------------------------------------- */
import {
  IMegaverseApiClient,
  CurrentCell,
} from "../api/MegaverseApiClient";
import { runtWithConcurrencyLimit } from "../utils/concurrency";
import { RetryOptions, retry } from "../utils/retry";
import { createProgressLogger } from "../utils/progressLogger";
import { sleep } from "../utils/sleep";
import { ComethDirection, SoloonColor } from "../domain/models";

/* ------------ helpers to avoid repetitive switch/case -------------------- */
const SOLOON = ["red", "blue", "purple", "white"] as const;
const COMETH = ["up", "down", "left", "right"] as const;

type Soloons = (typeof SOLOON)[number];
type Comeths = (typeof COMETH)[number];

function isSoloonToken(
  t: string
): t is `${Uppercase<Soloons>}_SOLOON` {
  return SOLOON.some((c) => t === `${c.toUpperCase()}_SOLOON`);
}
function isComethToken(
  t: string
): t is `${Uppercase<Comeths>}_COMETH` {
  return COMETH.some((d) => t === `${d.toUpperCase()}_COMETH`);
}

export class MegaverseBuilder {
  /* ----------------- rate-limit tuning & batching ----------------------- */
  private concurrency = 3;
  private readonly maxConcurrency = 8;
  private readonly adjustIntervalMs = 10_000;
  private readonly batchSize = 20;
  private readonly batchDelayMs = 3_000;
  private readonly RATE_LIMIT_MS = 1_700;

  private error429 = 0;
  private readonly adjustTimer: NodeJS.Timeout;

  constructor(private readonly api: IMegaverseApiClient) {
    this.adjustTimer = setInterval(
      () => this.adjustConcurrency(),
      this.adjustIntervalMs
    );
  }

  /* ---------------------- public API ------------------------------------ */

  /** remove *everything* */
  public async cleanUniverse(): Promise<void> {
    /* 1️⃣  first pass – bulk delete at configured speed --------------- */
    let todo = this.toDeleteTasks(await this.api.getCurrentMap());

    if (!todo.length) {
      console.log("✅ Universe already empty.");
      return;
    }

    console.log(`🧹 Deleting ${todo.length} objects…`);
    await this.runWithProgress(todo, "deleted"); // batching + progress + retries

    /* 2️⃣  verification + automatic clean-up --------------------------- */
    for (let attempt = 1; attempt <= 3; attempt++) {
      const leftovers = this.toDeleteTasks(
        await this.api.getCurrentMap()
      );

      if (!leftovers.length) {
        console.log("✅ Universe is fully blue.");
        return;
      }

      console.warn(
        `❌ ${leftovers.length} objects survived cleanup (attempt ${attempt}/3). Retrying…`
      );

      // ultra-conservative sweep: 1 request every 1.7 s
      await runtWithConcurrencyLimit(leftovers, 1);
    }

    console.error(
      "🛑 Gave up after 3 clean-up attempts. Universe still not empty."
    );
  }

  /** build full universe, skipping / fixing as needed */
  public buildUniverse = async (): Promise<void> => {
    /* 1️⃣  quick diff first  ------------------------------------------------ */
    await this.syncWithGoal();

    /* 2️⃣  build only what’s still missing --------------------------------- */
    const [goal, current] = await Promise.all([
      this.api.getGoalMap(),
      this.api.getCurrentMap(),
    ]);

    const createTodo: Array<() => Promise<void>> = [];
    for (let r = 0; r < goal.length; r++) {
      for (let c = 0; c < goal[0].length; c++) {
        if (this.isSame(goal[r][c], current[r][c])) continue;
        createTodo.push(() => this.createFromToken(goal[r][c], r, c));
      }
    }

    if (createTodo.length) {
      console.log(`🚀 Creating ${createTodo.length} objects…`);
      await this.runWithProgress(createTodo, "created");
    } else {
      console.log("🎉 Nothing left to create.");
    }

    /* 3️⃣  final guarantee -------------------------------------------------- */
    await this.syncWithGoal();
  };

  /** call at program end */
  public stopAdjusting() {
    clearInterval(this.adjustTimer);
  }

  /* -------------------- core helpers ------------------------------------ */

  /** compare goal token ↔ current cell */
  private isSame(token: string, cell: CurrentCell | null): boolean {
    return (
      (token === "SPACE" && !cell) ||
      (token === "POLYANET" && cell?.type === 0) ||
      (isSoloonToken(token) &&
        cell?.type === 1 &&
        cell.color === token.split("_")[0].toLowerCase()) ||
      (isComethToken(token) &&
        cell?.type === 2 &&
        cell.direction === token.split("_")[0].toLowerCase())
    );
  }

  /** create according to token (already validated) */
  private createFromToken(
    token: string,
    r: number,
    c: number
  ): Promise<void> {
    if (token === "POLYANET") return this.api.createPolyanet(r, c);
    if (isSoloonToken(token))
      return this.api.createSoloon(
        r,
        c,
        token.split("_")[0].toLowerCase() as SoloonColor
      );
    if (isComethToken(token))
      return this.api.createCometh(
        r,
        c,
        token.split("_")[0].toLowerCase() as ComethDirection
      );
    return Promise.resolve(); // SPACE
  }

  /** build delete tasks from current map */
  private toDeleteTasks(
    grid: CurrentCell[][]
  ): Array<() => Promise<void>> {
    const del = [
      (r: number, c: number) => this.api.deletePolyanet(r, c),
      (r: number, c: number) => this.api.deleteSoloon(r, c),
      (r: number, c: number) => this.api.deleteCometh(r, c),
    ] as const;

    const tasks: Array<() => Promise<void>> = [];
    grid.forEach((row, r) =>
      row.forEach((cell, c) => {
        if (cell) tasks.push(() => del[cell.type](r, c));
      })
    );
    return tasks.map((fn) => () => retry(fn, this.makeRetryOpts()));
  }

  /** ensure current map === goal map (minimal diff, 1 req / 1.7 s) */
  private async syncWithGoal(): Promise<void> {
    const [goal, current] = await Promise.all([
      this.api.getGoalMap(),
      this.api.getCurrentMap(),
    ]);

    const todo: Array<() => Promise<void>> = [];

    goal.forEach((row, r) =>
      row.forEach((token, c) => {
        const have = current[r][c];
        if (this.isSame(token, have)) return;

        /* delete wrong */
        if (have) {
          const del = [
            () => this.api.deletePolyanet(r, c),
            () => this.api.deleteSoloon(r, c),
            () => this.api.deleteCometh(r, c),
          ] as const;
          todo.push(del[have.type]);
        }
        /* create right */
        todo.push(() => this.createFromToken(token, r, c));
      })
    );

    if (!todo.length) {
      console.log("✅ Map already matches goal.");
      return;
    }

    console.log(`🔧 Fixing ${todo.length} cells…`);
    await runtWithConcurrencyLimit(todo, 1);
    console.log("✅ Map corrected.");
  }

  /* ---------------- batching / retry / progress ------------------------ */

  private async runWithProgress(
    raw: Array<() => Promise<void>>,
    label: "created" | "deleted"
  ) {
    const log = createProgressLogger(label, raw.length, 10);
    const wrapped = raw.map((fn) => async () => {
      try {
        await fn();
      } finally {
        log();
      }
    });
    await this.processBatches(wrapped);
  }

  private async processBatches<T>(
    tasks: Array<() => Promise<T>>
  ): Promise<PromiseSettledResult<T>[]> {
    const results: PromiseSettledResult<T>[] = [];
    for (let i = 0; i < tasks.length; i += this.batchSize) {
      const batch = tasks.slice(i, i + this.batchSize);
      const r = await runtWithConcurrencyLimit(
        batch,
        this.concurrency
      );
      results.push(...r);

      const rateErrors = r.filter(
        (x) =>
          x.status === "rejected" &&
          /429/.test((x as any).reason?.message)
      ).length;
      if (rateErrors) {
        this.error429 += rateErrors;
        this.adjustConcurrency();
      }
      if (i + this.batchSize < tasks.length)
        await sleep(this.batchDelayMs);
    }
    return results;
  }

  private makeRetryOpts(): RetryOptions {
    return {
      retries: 8,
      factor: 2,
      minTimeout: 1_000,
      maxTimeout: 60_000,
      shouldRetry: (err) => {
        const is429 = /429/.test(err.message);
        if (is429) this.error429++;
        return is429 || /5\d{2}/.test(err.message);
      },
    };
  }

  private adjustConcurrency() {
    if (!this.error429) {
      this.concurrency = Math.min(
        this.concurrency + 1,
        this.maxConcurrency
      );
    } else {
      this.concurrency = Math.max(
        1,
        this.concurrency - this.error429
      );
    }
    console.log(
      `↔️ Concurrency now ${this.concurrency} (rate-limit hits: ${this.error429})`
    );
    this.error429 = 0;
  }
}
