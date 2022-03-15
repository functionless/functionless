import {
  ArrayLiteralExpr,
  assertIsExpr,
  BinaryExpr,
  CallExpr,
  Expr,
  isExpr,
} from "./expression";
import { FunctionlessNode } from "./node";

import { BlockStmt, isStmt, Stmt } from "./statement";

/**
 * Visits each child of a Node using the supplied visitor, possibly returning a new Node of the same kind in its place.
 *
 * @param node The Node whose children will be visited.
 * @param visitor The callback used to visit each child.
 * @param context A lexical environment context for the visitor.
 */
export function visitEachChild<T extends FunctionlessNode>(
  node: T,
  visitor: (
    node: FunctionlessNode
  ) => FunctionlessNode | FunctionlessNode[] | undefined
): T {
  if (node.kind === "ArrayLiteralExpr") {
    return new ArrayLiteralExpr(
      node.items.reduce((items: Expr[], item) => {
        const result = visitor(item);
        if (Array.isArray(result)) {
          assertIsArrayOf(result, isExpr);
          return items.concat(result as Expr[]);
        } else {
          return [...items, result] as any;
        }
      }, [])
    ) as T;
  } else if (node.kind === "BinaryExpr") {
    const left = visitor(node.left);
    const right = visitor(node.right);
    if (isExpr(left) && isExpr(right)) {
      return new BinaryExpr(left, node.op, right) as T;
    } else {
      throw new Error(
        `visitEachChild of BinaryExpr must return an Expr for both the left and right operands`
      );
    }
  } else if (node.kind === "BlockStmt") {
    return new BlockStmt(
      node.statements.reduce((stmts: Stmt[], stmt) => {
        const result = visitor(stmt);
        if (Array.isArray(result)) {
          assertIsArrayOf(result, isStmt);
          return stmts.concat(result);
        } else if (isStmt(result)) {
          return [...stmts, result];
        } else {
          throw new Error(
            `visitEachChild of a BlockStmt's child statements must return a Stmt`
          );
        }
      }, [])
    ) as T;
  } else if (node.kind === "BooleanLiteralExpr") {
    return node;
  } else if (node.kind === "BreakStmt") {
    return node;
  } else if (node.kind === "CallExpr") {
    const expr = visitor(node.expr);
    assertIsExpr(
      expr,
      `visitEachChild of a CallExpr's expr must return a single Expr`
    );
    const args = Object.entries(node.args).reduce((args, [argName, argVal]) => {
      const transformedVal = visitor(argVal);
      assertIsExpr(
        transformedVal,
        `visitEachChild of a CallExpr's argument must return a single Expr`
      );
      return {
        ...args,
        [argName]: transformedVal,
      };
    }, {});
    return new CallExpr(expr, args) as T;
  } else {
    throw new Error(``);
  }
}

function assertIsArrayOf<T>(
  arr: any[],
  f: (item: any) => item is T
): asserts arr is T[] {
  for (const item of arr) {
    if (!f(item)) {
      throw new Error(``);
    }
  }
}
