import { createProgressLogger } from "../../src/utils/progressLogger";

describe("progressLogger", () => {
  beforeEach(() => {
    // Spy on console.log
    jest.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.log
    jest.restoreAllMocks();
  });

  test("should log progress at specified intervals", () => {
    // Create logger with 5 items, log every 2
    const logProgress = createProgressLogger("test", 5, 2);

    // Call twice and verify it logs only once (at item #2)
    logProgress();
    expect(console.log).not.toHaveBeenCalled();

    logProgress();
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("test: 2/5")
    );

    // Reset mock to check next call
    jest.clearAllMocks();

    // Call twice more and verify it logs once (at item #4)
    logProgress();
    expect(console.log).not.toHaveBeenCalled();

    logProgress();
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("test: 4/5")
    );

    // Reset mock to check final call
    jest.clearAllMocks();

    // Final call should log even if not at interval
    logProgress();
    expect(console.log).toHaveBeenCalledTimes(1);
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining("test: 5/5")
    );
  });
});
