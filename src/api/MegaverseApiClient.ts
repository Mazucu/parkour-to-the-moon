// src/api/MegaverseApiClient.ts

import { ComethDirection, SoloonColor } from "../domain/models";

/* -------------------------------------------------------------------------- */
/*  Models                                                                     */
/* -------------------------------------------------------------------------- */
export type CurrentCell =
  | null
  | { type: 0 }
  | { type: 1; color: SoloonColor }
  | { type: 2; direction: ComethDirection };

export interface IMegaverseApiClient {
  /* Maps */
  getGoalMap(): Promise<string[][]>;
  getCurrentMap(): Promise<CurrentCell[][]>;

  /* Polyanets */
  createPolyanet(row: number, column: number): Promise<void>;
  deletePolyanet(row: number, column: number): Promise<void>;

  /* Soloons  */
  createSoloon(
    row: number,
    column: number,
    color: SoloonColor
  ): Promise<void>;
  deleteSoloon(row: number, column: number): Promise<void>;

  /* Comeths  */
  createCometh(
    row: number,
    column: number,
    direction: ComethDirection
  ): Promise<void>;
  deleteCometh(row: number, column: number): Promise<void>;
}

/**
 * Custom error with API response details to help with retry logic
 */
export class ApiError extends Error {
  headers: Headers;
  status: number;

  constructor(message: string, response: Response) {
    super(message);
    this.name = "ApiError";
    this.headers = response.headers;
    this.status = response.status;
  }
}

/* -------------------------------------------------------------------------- */
/*  API Client                                                                 */
/* -------------------------------------------------------------------------- */
export class MegaverseApiClient implements IMegaverseApiClient {
  private readonly BASE_URL = "https://challenge.crossmint.io/api";

  constructor(private readonly candidateId: string) {}

  /* --- MAP OPERATIONS --- */

  async getGoalMap(): Promise<string[][]> {
    const resp = await fetch(
      `${this.BASE_URL}/map/${this.candidateId}/goal`
    );

    if (!resp.ok) {
      throw new ApiError(
        `Goal map request failed (${
          resp.status
        }): ${await resp.text()}`,
        resp
      );
    }

    const { goal } = (await resp.json()) as { goal: string[][] };
    return goal;
  }

  async getCurrentMap(): Promise<CurrentCell[][]> {
    const resp = await fetch(
      `${this.BASE_URL}/map/${this.candidateId}`
    );

    if (!resp.ok) {
      throw new ApiError(
        `Current map request failed (${
          resp.status
        }): ${await resp.text()}`,
        resp
      );
    }

    const body = (await resp.json()) as {
      map: { content: CurrentCell[][] };
    };

    return body.map.content;
  }

  /* --- POLYANETS --- */

  async createPolyanet(row: number, column: number): Promise<void> {
    await this.post("polyanets", { row, column });
  }

  async deletePolyanet(row: number, column: number): Promise<void> {
    await this.del("polyanets", { row, column });
  }

  /* --- SOLOONS --- */

  async createSoloon(
    row: number,
    column: number,
    color: SoloonColor
  ): Promise<void> {
    await this.post("soloons", { row, column, color });
  }

  async deleteSoloon(row: number, column: number): Promise<void> {
    await this.del("soloons", { row, column });
  }

  /* --- COMETHS --- */

  async createCometh(
    row: number,
    column: number,
    direction: ComethDirection
  ): Promise<void> {
    await this.post("comeths", { row, column, direction });
  }

  async deleteCometh(row: number, column: number): Promise<void> {
    await this.del("comeths", { row, column });
  }

  /* --- HELPER METHODS --- */

  private async post(
    resource: string,
    payload: Record<string, unknown>
  ) {
    const resp = await fetch(`${this.BASE_URL}/${resource}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        candidateId: this.candidateId,
        ...payload,
      }),
    });

    if (!resp.ok) {
      throw new ApiError(
        `POST ${resource} failed (${
          resp.status
        }): ${await resp.text()}`,
        resp
      );
    }
  }

  private async del(
    resource: string,
    coords: { row: number; column: number }
  ) {
    const resp = await fetch(`${this.BASE_URL}/${resource}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        candidateId: this.candidateId,
        ...coords,
      }),
    });

    if (!resp.ok) {
      throw new ApiError(
        `DELETE ${resource} failed (${
          resp.status
        }): ${await resp.text()}`,
        resp
      );
    }
  }
}
