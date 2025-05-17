export type SoloonColor = "blue" | "red" | "purple" | "white";
export type ComethDirection = "up" | "down" | "left" | "right";
export type Cell =
  | "POLYANET"
  | "UP_COMETH"
  | "DOWN_COMETH"
  | "LEFT_COMETH"
  | "RIGHT_COMETH"
  | "WHITE_SOLOON"
  | "BLUE_SOLOON"
  | "RED_SOLOON"
  | "PURPLE_SOLOON";

export type GoalMap = Cell[][];
export type CandidateMap = Cell[][];

export abstract class AstralBody {
  constructor(
    public readonly row: number,
    public readonly column: number
  ) {}
  abstract get type(): string;
}

export class Polyanet extends AstralBody {
  get type() {
    return "POLYANET";
  }
}

export class Cometh extends AstralBody {
  constructor(
    r: number,
    c: number,
    public readonly direction: string
  ) {
    super(r, c);
  }
  get type() {
    return "COMETH";
  }
}

export class Soloon extends AstralBody {
  constructor(r: number, c: number, public readonly color: string) {
    super(r, c);
  }
  get type() {
    return "SOLOON";
  }
}
