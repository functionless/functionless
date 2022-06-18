import { BaseNode, typeGuard } from "./node";

export const isErr = typeGuard("Err");

export class Err extends BaseNode<"Err"> {
  readonly nodeKind: "Err" = "Err";

  constructor(readonly error: Error) {
    super("Err");
  }

  public clone(): this {
    return new Err(this.error) as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
