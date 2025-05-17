import { main } from "../src/index";
import { MegaverseApiClient } from "../src/api/MegaverseApiClient";
import { MegaverseBuilder } from "../src/orchestrator/MegaverseBuilder";

// Mock the ApiClient and Builder
jest.mock("../src/api/MegaverseApiClient");
jest.mock("../src/orchestrator/MegaverseBuilder", () => {
  return {
    MegaverseBuilder: jest.fn().mockImplementation(() => {
      return {
        buildUniverse: jest.fn().mockResolvedValue(undefined),
        cleanUniverse: jest.fn().mockResolvedValue(undefined),
        stopAdjusting: jest.fn(),
      };
    }),
  };
});

describe("Main application", () => {
  let mockExit: jest.SpyInstance;
  let mockConsoleLog: jest.SpyInstance;
  let mockConsoleError: jest.SpyInstance;

  // Save original command line args to restore later
  const originalArgv = process.argv;

  // Save original environment
  const originalEnv = process.env;

  beforeEach(() => {
    // Mock console methods
    mockConsoleLog = jest
      .spyOn(console, "log")
      .mockImplementation(() => {});
    mockConsoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    // Mock process.exit to prevent tests from terminating
    mockExit = jest
      .spyOn(process, "exit")
      .mockImplementation((code) => {
        throw new Error(`Process exit with code: ${code}`);
      });

    // Reset modules
    jest.clearAllMocks();

    // Reset argv
    process.argv = [...originalArgv];

    // Reset env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore everything
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockExit.mockRestore();

    // Restore original argv and env
    process.argv = originalArgv;
    process.env = originalEnv;
  });

  test("should exit when no candidate ID is provided", async () => {
    // Don't provide candidate ID anywhere
    process.argv = ["node", "dist/index.js"];
    delete process.env.CANDIDATE_ID;

    await expect(main()).rejects.toThrow("Process exit with code: 1");

    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Please provide your candidate ID")
    );
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  test("should use candidate ID from command line args", async () => {
    process.argv = ["node", "dist/index.js", "test-id"];

    await main();

    expect(MegaverseApiClient).toHaveBeenCalledWith("test-id");
    expect(MegaverseBuilder).toHaveBeenCalled();
  });

  test("should use candidate ID from environment variable", async () => {
    process.env.CANDIDATE_ID = "env-test-id";

    await main();

    expect(MegaverseApiClient).toHaveBeenCalledWith("env-test-id");
    expect(MegaverseBuilder).toHaveBeenCalled();
  });

  test("should prioritize environment variable over command line arg", async () => {
    process.argv = ["node", "dist/index.js", "arg-id"];
    process.env.CANDIDATE_ID = "env-id";

    await main();

    expect(MegaverseApiClient).toHaveBeenCalledWith("env-id");
  });

  test("should run build action by default", async () => {
    process.argv = ["node", "dist/index.js", "test-id"];

    await main();

    const mockBuilder = (MegaverseBuilder as jest.Mock).mock
      .results[0].value;
    expect(mockBuilder.buildUniverse).toHaveBeenCalled();
    expect(mockBuilder.cleanUniverse).not.toHaveBeenCalled();
  });

  test("should run clean action when specified", async () => {
    process.argv = ["node", "dist/index.js", "test-id", "clean"];

    await main();

    const mockBuilder = (MegaverseBuilder as jest.Mock).mock
      .results[0].value;
    expect(mockBuilder.cleanUniverse).toHaveBeenCalled();
    expect(mockBuilder.buildUniverse).not.toHaveBeenCalled();
  });

  test("should always call stopAdjusting when done", async () => {
    process.argv = ["node", "dist/index.js", "test-id"];

    await main();

    const mockBuilder = (MegaverseBuilder as jest.Mock).mock
      .results[0].value;
    expect(mockBuilder.stopAdjusting).toHaveBeenCalled();
  });

  test("should call stopAdjusting even if an error occurs", async () => {
    process.argv = ["node", "dist/index.js", "test-id"];

    // Make buildUniverse throw an error
    const mockBuilder = {
      buildUniverse: jest
        .fn()
        .mockRejectedValue(new Error("Build failed")),
      cleanUniverse: jest.fn(),
      stopAdjusting: jest.fn(),
    };
    (MegaverseBuilder as jest.Mock).mockReturnValueOnce(mockBuilder);

    await expect(main()).rejects.toThrow("Process exit with code: 1");

    expect(mockBuilder.stopAdjusting).toHaveBeenCalled();
    expect(mockConsoleError).toHaveBeenCalledWith(
      expect.stringContaining("Error:"),
      expect.stringContaining("Build failed")
    );
  });
});
