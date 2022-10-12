import { FunctionlessNode } from "./node";
import { getCtor, NodeInstance } from "./node-ctor";
import { NodeKind } from "./node-kind";
import { isSpan, Span } from "./span";

/**
 * A memory-efficient representation of a serializer {@link FunctionlessNode} as an s-expression tuple.
 *
 * ```ts
 * ex.
 * // class representation
 * new Identifier("id"),
 *
 * // tuple s-expr representation
 * [Identifier, "id"]
 * ```
 */
export type SExpr<Node extends FunctionlessNode = FunctionlessNode> = [
  kind: Node["kind"],
  span: Span,
  ...args: any[] // we could make these more type-safe, but TS has instantiation problems because of eager evaluation of spreads on recursive tuple types
];

/**
 * Parse a {@link SExpr} representation of a {@link FunctionlessNode} into its class form.
 * @param expr
 * @returns
 */
export function parseSExpr<Kind extends NodeKind>(
  expr: [kind: Kind, ...args: any[]]
): NodeInstance<Kind> {
  const [kind, span, ...args] = expr;
  if (!isSpan(span)) {
    throw new Error(
      `The first argument in a s-expression must always be the Node's Span, but found ${span}.`
    );
  }
  const ctor = getCtor(kind);
  return new ctor(
    span,
    ...(<any>args.map(function parse(item: any): any {
      if (Array.isArray(item)) {
        if (typeof item[0] === "number") {
          // s-expression
          return parseSExpr(item as SExpr);
        } else {
          // array of s-expressions
          return item.map(parse);
        }
      } else {
        return item;
      }
    }))
  ) as NodeInstance<Kind>;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
