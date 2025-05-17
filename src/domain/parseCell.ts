import { Cell } from "./models";
import { Polyanet, Soloon, Cometh, AstralBody } from "./models";

export function parseCell(
  cell: Cell,
  row: number,
  column: number
): AstralBody | null {
  switch (cell) {
    case "POLYANET":
      return new Polyanet(row, column);

    case "RED_SOLOON":
    case "BLUE_SOLOON":
    case "PURPLE_SOLOON":
    case "WHITE_SOLOON":
      // color = parte antes de _SOLOON en minúsculas
      const color = cell.split("_")[0].toLowerCase() as
        | "red"
        | "blue"
        | "purple"
        | "white";
      return new Soloon(row, column, color);

    case "UP_COMETH":
    case "DOWN_COMETH":
    case "LEFT_COMETH":
    case "RIGHT_COMETH":
      // direction = parte antes de _COMETH en minúsculas
      const direction = cell.split("_")[0].toLowerCase() as
        | "up"
        | "down"
        | "left"
        | "right";
      return new Cometh(row, column, direction);

    default:
      return null; // SPACE u otros
  }
}
