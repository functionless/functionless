import { BaseNode } from "./node";
import { NodeKind } from "./node-kind";
import { Span } from "./span";

export class Err extends BaseNode<NodeKind.Err> {
  readonly nodeKind: "Err" = "Err";

  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly error: Error
  ) {
    super(NodeKind.Err, span, arguments);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
