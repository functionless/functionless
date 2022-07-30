import { BaseNode } from "./node";
import { NodeKind } from "./node-kind";

export class Err extends BaseNode<NodeKind.Err> {
  readonly nodeKind: "Err" = "Err";

  constructor(readonly error: Error) {
    super(NodeKind.Err, arguments);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
