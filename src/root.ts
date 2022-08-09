import { ClassDecl, FunctionDecl, MethodDecl } from "./declaration";
import { ArrowFunctionExpr, ClassExpr, FunctionExpr } from "./expression";
import { BaseNode } from "./node";
import { NodeKind } from "./node-kind";
import { Span } from "./span";

/**
 * A `Module` is the root of an entire AST.
 *
 * It contains metadata about the contained AST, such as its {@link filename}.
 */
export class Root extends BaseNode<NodeKind.Root, undefined> {
  readonly nodeKind = "Root";
  constructor(
    span: Span,
    /**
     * Contains the name of the source file this Node originated from.
     *
     * Only set for the root declaration in an AST tree.
     */
    readonly filename: string,
    readonly entrypoint:
      | FunctionDecl
      | FunctionExpr
      | ArrowFunctionExpr
      | ClassDecl
      | ClassExpr
      | MethodDecl
  ) {
    super(NodeKind.Root, span, arguments);
  }
}
