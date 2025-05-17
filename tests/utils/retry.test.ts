import { retry } from "../../src/utils/retry";
import { sleep } from "../../src/utils/sleep";

// Mock sleep to avoid waiting in tests
jest.mock("../../src/utils/sleep", () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

describe("retry utility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  test("should resolve if function succeeds on first try", async () => {
    const fn = jest.fn().mockResolvedValue("success");

    const result = await retry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test("should retry on failure and succeed on second attempt", async () => {
    // Fail first time, succeed second time
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("temporary error"))
      .mockResolvedValueOnce("success");

    const result = await retry(fn, { retries: 3 });

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);
  });

  test("should stop retrying after max retries", async () => {
    // Always fail
    const fn = jest
      .fn()
      .mockRejectedValue(new Error("persistent error"));

    await expect(retry(fn, { retries: 2 })).rejects.toThrow(
      "persistent error"
    );

    expect(fn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    expect(sleep).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.error).toHaveBeenCalledTimes(1);
  });

  test("should handle 429 rate limit errors with longer delays", async () => {
    // Create a rate limit error with headers
    const rateError = new Error("429 Rate limit exceeded");
    Object.defineProperty(rateError, "headers", {
      value: {
        get: jest.fn().mockReturnValue("5"), // Retry-After: 5 seconds
      },
    });

    const fn = jest
      .fn()
      .mockRejectedValueOnce(rateError)
      .mockResolvedValueOnce("success");

    const result = await retry(fn);

    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining("Rate limited")
    );
  });

  test("should call onRetry callback if provided", async () => {
    const onRetry = jest.fn();
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new Error("first error"))
      .mockResolvedValueOnce("success");

    await retry(fn, { onRetry });

    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(
      expect.any(Error),
      1,
      expect.any(Number)
    );
  });

  test("should not retry if shouldRetry returns false", async () => {
    const fn = jest
      .fn()
      .mockRejectedValue(new Error("not retryable"));
    const shouldRetry = jest.fn().mockReturnValue(false);

    await expect(retry(fn, { shouldRetry })).rejects.toThrow(
      "not retryable"
    );

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(shouldRetry).toHaveBeenCalledTimes(1);
  });
});
