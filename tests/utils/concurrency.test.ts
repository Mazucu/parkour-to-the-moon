import { runtWithConcurrencyLimit } from "../../src/utils/concurrency";
import { sleep } from "../../src/utils/sleep";

// Mock the sleep utility
jest.mock("../../src/utils/sleep", () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

describe("concurrency utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Spy on console.log for rate limiter adjustments
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  test("should execute tasks with concurrency limit", async () => {
    // Create test tasks that track when they're executed
    const executeOrder: number[] = [];
    const tasks = [0, 1, 2, 3, 4].map((i) => async () => {
      executeOrder.push(i);
      return i * 10;
    });

    // Run with concurrency of 2
    const results = await runtWithConcurrencyLimit(tasks, 2);

    // Check that all tasks were executed
    expect(results.length).toBe(5);
    expect(executeOrder.length).toBe(5);

    // Check all tasks succeeded
    results.forEach((result, i) => {
      expect(result.status).toBe("fulfilled");
      if (result.status === "fulfilled") {
        expect(result.value).toBe(i * 10);
      }
    });
  });

  test("should handle task failures", async () => {
    // Create mixed success/failure tasks
    const tasks = [
      async () => "success1",
      async () => {
        throw new Error("test error");
      },
      async () => "success2",
    ];

    const results = await runtWithConcurrencyLimit(tasks, 2);

    // Check results
    expect(results.length).toBe(3);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");
  });

  test("should adjust rate limiter when encountering 429 errors", async () => {
    const tasks = [
      async () => "success",
      async () => {
        throw new Error("429 Rate limit exceeded");
      },
      async () => "success again",
    ];

    const results = await runtWithConcurrencyLimit(tasks, 2);

    // Check that console.log was called for rate limiter adjustment
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("Slowing down")
    );

    // Check results
    expect(results.length).toBe(3);
    expect(results[0].status).toBe("fulfilled");
    expect(results[1].status).toBe("rejected");
    expect(results[2].status).toBe("fulfilled");
  });
});
