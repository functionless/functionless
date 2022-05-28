import { Construct } from "constructs";
import ts from "typescript";
import { Expr } from "./expression";
import { FunctionlessNode } from "./node";

export type AnyFunction = (...args: any[]) => any;

export function isInTopLevelScope(expr: FunctionlessNode): boolean {
  if (expr.parent === undefined) {
    return true;
  }
  return walk(expr.parent);

  function walk(expr: FunctionlessNode): boolean {
    if (expr.kind === "FunctionDecl" || expr.kind === "FunctionExpr") {
      return expr.parent === undefined;
    } else if (expr.kind === "ForInStmt" || expr.kind === "ForOfStmt") {
      return false;
    } else if (expr.parent === undefined) {
      return true;
    }
    return walk(expr.parent);
  }
}

export function ensureItemOf<T>(
  arr: any[],
  f: (item: any) => item is T,
  message: string
): asserts arr is T[] {
  if (arr.some((item) => !f(item))) {
    throw new Error(message);
  }
}

export function ensure<T>(
  a: any,
  is: (a: any) => a is T,
  message: string
): asserts a is T {
  if (!is(a)) {
    debugger;
    throw new Error(message);
  }
}

type EnsureOr<T extends ((a: any) => a is any)[]> = T[number] extends (
  a: any
) => a is infer T
  ? T
  : never;

export function anyOf<T extends ((a: any) => a is any)[]>(
  ...fns: T
): (a: any) => a is EnsureOr<T> {
  return (a: any): a is EnsureOr<T> => fns.some((f) => f(a));
}

export type AnyDepthArray<T> = T | T[] | AnyDepthArray<T>[];

export function flatten<T>(arr: AnyDepthArray<T>): T[] {
  if (Array.isArray(arr)) {
    return (arr as T[]).reduce(
      (a: T[], b: AnyDepthArray<T>) => a.concat(flatten(b)),
      []
    );
  } else {
    return [arr];
  }
}

export function hasParent(node: ts.Node, parent: ts.Node): boolean {
  if (!node.parent) {
    return false;
  } else if (node.parent === parent) {
    return true;
  }
  return hasParent(node.parent, parent);
}

export type ConstantValue =
  | PrimitiveValue
  | { [key: string]: ConstantValue }
  | ConstantValue[];

export type PrimitiveValue = string | number | boolean | undefined | null;

export const isPrimitive = (val: any): val is PrimitiveValue => {
  return (
    typeof val === "string" ||
    typeof val === "number" ||
    typeof val === "boolean" ||
    typeof val === "undefined" ||
    val === null
  );
};

export const singletonConstruct = <T extends Construct, S extends Construct>(
  scope: S,
  id: string,
  create: (scope: S, id: string) => T
): T => {
  const child = scope.node.tryFindChild(id);
  return child ? (child as T) : create(scope, id);
};

export type Constant = null | boolean | number | string;

/**
 * Evaluates an Expr to a constant value
 *
 * ```
 * "hello" // "hello"
 * "hello" + "world" // "helloworld"
 * "hello" + 1 // "hello1"
 * 1 + "hello" // "2hello"
 * 1 // 1
 * -1 // -1
 * 1 + 2 // 3
 * ```
 *
 * @returns the number if it is constant, otherwise undefined.
 */
export function evaluateToConstant(node: Expr): Constant | undefined {
  if (
    node.kind === "NumberLiteralExpr" ||
    node.kind === "NullLiteralExpr" ||
    node.kind === "BooleanLiteralExpr" ||
    node.kind === "StringLiteralExpr"
  ) {
    return node.value;
  } else if (node.kind === "UnaryExpr" && node.op === "-") {
    // for negative numbers, collapse into a NumberLiteralExpr with the negative value
    const expr = evaluateToConstant(node.expr);
    if (typeof expr === "number") {
      return -expr;
    }
  } else if (node.kind === "BinaryExpr") {
    const left: any = evaluateToConstant(node.left);
    const right: any = evaluateToConstant(node.right);
    if (node.op === "+") {
      return left + right;
    } else if (node.op === "-") {
      return left - right;
    } else if (node.op === "*") {
      return left * right;
    } else if (node.op === "/") {
      return left / right;
    }
  }
  return undefined;
}
