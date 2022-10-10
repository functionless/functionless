import { CallExpr, ReferenceExpr } from "./expression";
import { isCallExpr, isReferenceExpr } from "./guards";
import { FunctionlessNode } from "./node";
import { reflect } from "./reflect";
import { isAnyFunction } from "./util";
import { forEachChild } from "./visit";

export function findDeepReferences<T>(
  ast: FunctionlessNode,
  find: (node: FunctionlessNode) => T[]
): CallExpr<ReferenceExpr<T>>[] {
  const nodes: CallExpr<ReferenceExpr<T>>[] = [];
  const seen = new Set();
  forEachChild(ast, function visit(node: FunctionlessNode): void {
    if (isCallExpr(node)) {
      const found = find(node.expr);
      if (found) {
        nodes.push(
          ...found.map((ref) =>
            node.fork(
              new CallExpr(
                node.span,
                new ReferenceExpr(node.expr.span, "", () => ref, 0, 0),
                node.args.map((arg) => arg.clone()),
                false
              )
            )
          )
        );
      }
    } else if (isReferenceExpr(node)) {
      (function visitValue(value: any): void {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
        if (isAnyFunction(value)) {
          const ast = reflect(value);
          if (ast) {
            visit(ast);
          }
        } else if (Array.isArray(value)) {
          value.forEach(visitValue);
        } else if (value && typeof value === "object") {
          Object.values(value).forEach(visitValue);
        }
      })(node.ref());
    }

    forEachChild(node, visit);
  });

  return nodes;
}
