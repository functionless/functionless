import { AwaitExpr, CallExpr, ReferenceExpr } from "./expression";
import { isAwaitExpr, isCallExpr, isReferenceExpr } from "./guards";
import { FunctionlessNode } from "./node";
import { reflect } from "./reflect";
import { tryResolveReferences } from "./resolve-references";
import { isAnyFunction } from "./util";
import { forEachChild } from "./visit";

export function findDeepReferences<T>(
  ast: FunctionlessNode,
  guard: (node: any) => node is T
): CallExpr<ReferenceExpr<T>>[] {
  const nodes: CallExpr<ReferenceExpr<T>>[] = [];
  const seen = new Set();
  forEachChild(ast, function visit(node: FunctionlessNode): void {
    if (isCallExpr(node)) {
      const found = tryFindReferences(node.expr, guard);
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

/**
 * A bottom-up algorithm that determines the ONLY {@link Integration} value that the {@link node}
 * will resolve to at runtime.
 *
 * If the {@link node} resolves to 0 or more than 1 {@link Integration} then `undefined` is returned.
 *
 * **Note**: This function is an intermediate helper until we migrate the interpreters to be more general
 * (likely by migrating to top-down algorithms, see https://github.com/functionless/functionless/issues/374#issuecomment-1203313604)
 *
 * @param node the node to resolve the {@link Integration} of.
 * @returns the ONLY {@link Integration} that {@link node} can resolve to, otherwise `undefined`.
 */
export function tryFindReference<T>(
  node: FunctionlessNode,
  is: (node: any) => node is T
): T | undefined {
  const integrations = tryFindReferences(node, is);
  if (integrations?.length === 1) {
    return integrations[0];
  }
  return undefined;
}

/**
 * A bottom-up algorithm that determines all of the possible {@link Integration}s that a {@link node}
 * may resolve to at runtime.
 *
 * ```ts
 * declare const table1;
 * declare const table2;
 *
 * const tables = [table1, table2];
 *
 * const a = table1;
 *    // ^ [table1]
 *
 * for (const a of tables) {
 *   const b = a;
 *          // ^ [table1, table2]
 *
 *   const { appsync: { getItem } } = a;
 *                     // ^ [ table1.appsync.getItem, table2.appsync.getItem ]
 * }
 *
 * const a = tables[0];
 *          // ^ [table1]
 *
 * const { appsync: { getItem } } = table[0];
 *                   // ^ [ table1.appsync.getItem ]
 *
 * const { appsync: { getItem = table1.appsync.getItem } } = table[2];
 *                   // ^ [ table1.appsync.getItem ] (because of initializer)
 * ```
 *
 * @param node the node to resolve the possible {@link Integration}s of.
 * @returns a list of all the {@link Integration}s that the {@link node} could evaluate to.
 */
export function tryFindReferences<T>(
  node: FunctionlessNode,
  is: (node: any) => node is T
): T[] {
  return tryResolveReferences(node, undefined).filter(is);
}

export type CallReferencePattern = CallExpr | (AwaitExpr & { expr: CallExpr });

export function getExprFromCallReferencePattern<T>(
  pattern: CallReferencePattern,
  is: (node: any) => node is T
): CallReferencePattern | undefined {
  if (isAwaitExpr(pattern)) {
    return getExprFromCallReferencePattern(pattern.expr, is);
  } else if (isCallExpr(pattern)) {
    const integration = tryFindReference<T>(pattern.expr, is);
    if (integration) {
      return pattern;
    }
  }
  return undefined;
}

export function isIntegrationCallExpr<T>(
  node: FunctionlessNode,
  guard: (a: any) => a is T
): node is CallExpr {
  if (isCallExpr(node)) {
    return tryFindIntegration(node.expr, guard) !== undefined;
  }
  return false;
}

export type IntegrationCallPattern =
  | CallExpr
  | (AwaitExpr & { expr: CallExpr });

export function isCallReferencePattern<T>(
  node: FunctionlessNode,
  guard: (a: any) => a is T
): node is IntegrationCallPattern {
  return (
    (isAwaitExpr(node) && isIntegrationCallExpr(node.expr, guard)) ||
    isIntegrationCallExpr(node, guard)
  );
}

export function tryFindIntegration<T>(
  node: FunctionlessNode,
  guard: (a: any) => a is T
): T | undefined {
  const integrations = tryFindIntegrations(node, guard);
  if (integrations?.length === 1) {
    return integrations[0];
  }
  return undefined;
}

export function tryFindIntegrations<T>(
  node: FunctionlessNode,
  guard: (a: any) => a is T
): T[] {
  return tryResolveReferences(node, undefined).filter((i) => {
    return guard(i);
  });
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
