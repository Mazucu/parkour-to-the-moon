import { sleep } from "../../src/utils/sleep";

describe("sleep utility", () => {
  test("should resolve after the specified time", async () => {
    // Mock timer functions
    jest.useFakeTimers();

    // Start sleep
    const sleepPromise = sleep(1000);

    // Advance timers
    jest.advanceTimersByTime(1000);

    // Await the promise and make sure it resolves
    await expect(sleepPromise).resolves.toBeUndefined();

    // Restore timers
    jest.useRealTimers();
  });
});
