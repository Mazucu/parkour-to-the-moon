/**
 * Unit tests for MegaverseBuilder
 *
 * These tests exercise the public API (buildUniverse & cleanUniverse)
 * and some critical private helpers (isSame, createFromToken).
 *
 * All external dependencies are mocked so no real HTTP calls are made.
 */

import { MegaverseBuilder } from "../../src/orchestrator/MegaverseBuilder";
import {
  IMegaverseApiClient,
  CurrentCell,
} from "../../src/api/MegaverseApiClient";

// ──────────────────── Mock utilities ────────────────────

jest.mock("../../src/utils/sleep", () => ({
  sleep: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../../src/utils/concurrency", () => ({
  runtWithConcurrencyLimit: jest
    .fn()
    .mockImplementation(
      async (tasks: Array<() => Promise<any>>, _limit: number) => {
        const results: Array<PromiseSettledResult<any>> = [];
        for (const t of tasks) {
          try {
            results.push({
              status: "fulfilled",
              value: await t(),
            } as PromiseFulfilledResult<any>);
          } catch (reason) {
            results.push({
              status: "rejected",
              reason,
            } as PromiseRejectedResult);
          }
        }
        return results;
      }
    ),
}));

jest.mock("../../src/utils/retry", () => ({
  retry: jest
    .fn()
    .mockImplementation(async (fn: () => Promise<any>) => await fn()),
}));

jest.mock("../../src/utils/progressLogger", () => ({
  createProgressLogger: jest.fn().mockImplementation(() => jest.fn()),
}));

// ──────────────────── Test suite ────────────────────

describe("MegaverseBuilder", () => {
  let mockApi: jest.Mocked<IMegaverseApiClient>;
  let builder: MegaverseBuilder;

  beforeEach(() => {
    jest.useFakeTimers(); // mute the internal adjustConcurrency timer

    mockApi = {
      getGoalMap: jest.fn(),
      getCurrentMap: jest.fn(),
      createPolyanet: jest.fn().mockResolvedValue(undefined),
      deletePolyanet: jest.fn().mockResolvedValue(undefined),
      createSoloon: jest.fn().mockResolvedValue(undefined),
      deleteSoloon: jest.fn().mockResolvedValue(undefined),
      createCometh: jest.fn().mockResolvedValue(undefined),
      deleteCometh: jest.fn().mockResolvedValue(undefined),
    };

    // Silence console noise during tests
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "warn").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});

    builder = new MegaverseBuilder(mockApi);
  });

  afterEach(() => {
    builder.stopAdjusting();
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ─────────────────── buildUniverse ───────────────────

  describe("buildUniverse", () => {
    test("creates all polyanets required by the goal map when current map is empty", async () => {
      const goal = [
        ["SPACE", "POLYANET", "SPACE"],
        ["POLYANET", "SPACE", "POLYANET"],
      ];
      const empty: CurrentCell[][] = goal.map((row) =>
        row.map(() => null)
      );

      // Always return the same values for consistent testing
      mockApi.getGoalMap.mockResolvedValue(goal);
      mockApi.getCurrentMap.mockResolvedValue(empty);

      await builder.buildUniverse();

      // Don't test exact call count because syncWithGoal is called twice
      expect(mockApi.createPolyanet).toHaveBeenCalledWith(0, 1);
      expect(mockApi.createPolyanet).toHaveBeenCalledWith(1, 0);
      expect(mockApi.createPolyanet).toHaveBeenCalledWith(1, 2);
      expect(mockApi.createSoloon).not.toHaveBeenCalled();
      expect(mockApi.createCometh).not.toHaveBeenCalled();
    });

    test("does nothing when goal map already matches current map", async () => {
      const goal = [
        ["SPACE", "POLYANET"],
        ["RED_SOLOON", "LEFT_COMETH"],
      ];
      const current: CurrentCell[][] = [
        [null, { type: 0 }],
        [
          { type: 1, color: "red" },
          { type: 2, direction: "left" },
        ],
      ];

      mockApi.getGoalMap.mockResolvedValue(goal);
      mockApi.getCurrentMap.mockResolvedValue(current);

      await builder.buildUniverse();

      expect(mockApi.createPolyanet).not.toHaveBeenCalled();
      expect(mockApi.createSoloon).not.toHaveBeenCalled();
      expect(mockApi.createCometh).not.toHaveBeenCalled();
    });

    test("removes wrong entities and creates correct ones", async () => {
      // Goal map with specific requirements
      const goal = [
        ["POLYANET", "SPACE"],
        ["SPACE", "RED_SOLOON"],
      ];

      // Current map with wrong entities
      const current: CurrentCell[][] = [
        [{ type: 1, color: "blue" }, null], // Should be polyanet, not blue soloon
        [null, { type: 1, color: "purple" }], // Should be red soloon, not purple
      ];

      mockApi.getGoalMap.mockResolvedValue(goal);
      mockApi.getCurrentMap.mockResolvedValue(current);

      await builder.buildUniverse();

      // Should delete the wrong entities
      expect(mockApi.deleteSoloon).toHaveBeenCalledWith(0, 0);
      expect(mockApi.deleteSoloon).toHaveBeenCalledWith(1, 1);

      // Should create the correct entities
      expect(mockApi.createPolyanet).toHaveBeenCalledWith(0, 0);
      expect(mockApi.createSoloon).toHaveBeenCalledWith(1, 1, "red");
    });
  });

  // ─────────────────── cleanUniverse ───────────────────

  describe("cleanUniverse", () => {
    test("deletes every non-empty cell in the map", async () => {
      const gridWithStuff: CurrentCell[][] = [
        [null, { type: 0 }, null],
        [
          { type: 1, color: "blue" },
          null,
          { type: 2, direction: "up" },
        ],
      ];
      const emptyGrid: CurrentCell[][] = gridWithStuff.map((row) =>
        row.map(() => null)
      );

      mockApi.getCurrentMap
        .mockResolvedValueOnce(gridWithStuff) // first pass
        .mockResolvedValueOnce(emptyGrid); // verification pass

      await builder.cleanUniverse();

      expect(mockApi.deletePolyanet).toHaveBeenCalledTimes(1);
      expect(mockApi.deleteSoloon).toHaveBeenCalledTimes(1);
      expect(mockApi.deleteCometh).toHaveBeenCalledTimes(1);

      expect(mockApi.deletePolyanet).toHaveBeenCalledWith(0, 1);
      expect(mockApi.deleteSoloon).toHaveBeenCalledWith(1, 0);
      expect(mockApi.deleteCometh).toHaveBeenCalledWith(1, 2);
    });
  });

  // ─────────────────── internal helpers ───────────────────

  describe("internal helpers", () => {
    test("isSame correctly distinguishes token/cell combinations", () => {
      // Access private method via bracket notation
      const isSame = (builder as any).isSame.bind(builder);

      expect(isSame("SPACE", null)).toBe(true);
      expect(isSame("POLYANET", { type: 0 })).toBe(true);
      expect(isSame("RED_SOLOON", { type: 1, color: "red" })).toBe(
        true
      );
      expect(
        isSame("LEFT_COMETH", { type: 2, direction: "left" })
      ).toBe(true);

      // Mismatches
      expect(isSame("POLYANET", null)).toBe(false);
      expect(isSame("WHITE_SOLOON", { type: 1, color: "red" })).toBe(
        false
      );
      expect(
        isSame("UP_COMETH", { type: 2, direction: "left" })
      ).toBe(false);
    });

    test("createFromToken delegates to the correct API method", async () => {
      const createFromToken = (builder as any).createFromToken.bind(
        builder
      );

      await createFromToken("POLYANET", 0, 0);
      await createFromToken("BLUE_SOLOON", 1, 1);
      await createFromToken("DOWN_COMETH", 2, 2);

      expect(mockApi.createPolyanet).toHaveBeenCalledWith(0, 0);
      expect(mockApi.createSoloon).toHaveBeenCalledWith(1, 1, "blue");
      expect(mockApi.createCometh).toHaveBeenCalledWith(2, 2, "down");
    });
  });
});
