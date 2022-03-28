import { BaseNode, typeGuard } from "./node";

export const isErr = typeGuard("Err");

export class Err extends BaseNode<"Err"> {
  constructor(readonly error: Error) {
    super("Err");
  }
}
