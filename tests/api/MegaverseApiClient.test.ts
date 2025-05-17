import {
  MegaverseApiClient,
  ApiError,
} from "../../src/api/MegaverseApiClient";

describe("MegaverseApiClient", () => {
  const candidateId = "test-candidate-id";
  let client: MegaverseApiClient;

  beforeEach(() => {
    client = new MegaverseApiClient(candidateId);

    // Reset and prepare the fetch mock
    (global.fetch as jest.Mock).mockReset();
  });

  test("should initialize with candidate ID", () => {
    expect(client).toBeInstanceOf(MegaverseApiClient);
  });

  describe("getGoalMap", () => {
    test("should fetch and return goal map data", async () => {
      // Mock successful response
      const mockResponse = {
        goal: [
          ["SPACE", "POLYANET"],
          ["POLYANET", "SPACE"],
        ],
      };

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValueOnce(mockResponse),
      });

      const result = await client.getGoalMap();

      // Validate request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/map/test-candidate-id/goal")
      );

      // Validate response
      expect(result).toEqual(mockResponse.goal);
    });

    test("should throw ApiError on non-ok response", async () => {
      // Mock error response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValueOnce("Not found"),
      });

      await expect(client.getGoalMap()).rejects.toThrow(ApiError);
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/map/test-candidate-id/goal")
      );
    });
  });

  describe("createPolyanet", () => {
    test("should call POST API with correct parameters", async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await client.createPolyanet(5, 10);

      // Validate request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/polyanets"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"row":5'),
          headers: expect.any(Object),
        })
      );

      // Verify JSON body
      const callArgs = (global.fetch as jest.Mock).mock.calls[0];
      const requestBody = JSON.parse(callArgs[1].body);
      expect(requestBody).toEqual({
        candidateId,
        row: 5,
        column: 10,
      });
    });

    test("should throw ApiError on failed request", async () => {
      // Mock error response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: jest.fn().mockResolvedValueOnce("Rate limit exceeded"),
      });

      await expect(client.createPolyanet(1, 2)).rejects.toThrow(
        ApiError
      );
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe("createSoloon", () => {
    test("should call API with correct color parameter", async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await client.createSoloon(3, 4, "blue");

      // Validate request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/soloons"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"color":"blue"'),
        })
      );
    });
  });

  describe("createCometh", () => {
    test("should call API with correct direction parameter", async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await client.createCometh(5, 6, "up");

      // Validate request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/comeths"),
        expect.objectContaining({
          method: "POST",
          body: expect.stringContaining('"direction":"up"'),
        })
      );
    });
  });

  describe("delete operations", () => {
    test("should call DELETE API with correct parameters", async () => {
      // Mock successful response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
      });

      await client.deletePolyanet(7, 8);

      // Validate request
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining("/polyanets"),
        expect.objectContaining({
          method: "DELETE",
          body: expect.stringContaining('"row":7'),
        })
      );
    });
  });
});
