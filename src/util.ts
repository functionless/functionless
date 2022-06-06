import { Construct } from "constructs";
import ts from "typescript";
import {
  Expr,
  isArrayLiteralExpr,
  isBinaryExpr,
  isBooleanLiteral,
  isComputedPropertyNameExpr,
  isIdentifier,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isReferenceExpr,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isUnaryExpr,
  isUndefinedLiteralExpr,
} from "./expression";
import { FunctionlessNode } from "./node";

export type AnyFunction = (...args: any[]) => any;
export type AnyAsyncFunction = (...args: any[]) => Promise<any>;

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

export type EnsureOr<T extends ((a: any) => a is any)[]> = T[number] extends (
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

export interface Constant {
  constant: unknown;
}

export function isConstant(x: any): x is Constant {
  return "constant" in x;
}

/**
 * Retrieves a string, number, boolean, undefined, or null constant from the given expression.
 * Wrap the value to not be ambiguous with the undefined value.
 * When one is not found, return undefined (not wrapped).
 *
 * Use assertConstant or assertPrimitive to make type assertions of the constant returned.
 * Values from external string may be complex types like functions.
 * We choose to late evaluate invalid values to support use cases like StepFunctions where it is both a function and has constant properties.
 * new StepFunction().stepFunctionArn
 *
 * "value" -> { constant: "value" }
 * undefined -> { constant: undefined }
 * null -> { constant: undefined }
 * call() -> undefined
 * true -> { constant: true }
 * -10 -> { constant: -10 }
 * "hello" -> { constant:  "hello" }
 * "hello" + "world" -> { constant:  "helloworld" }
 * "hello" + 1 -> { constant:  "hello1" }
 * 1 + "hello" -> { constant:  "2hello" }
 * 1 -> { constant:  1 }
 * -1 -> { constant:  -1 }
 * 1 + 2 -> { constant:  3 }
 *
 * Note: constants that follow references must already be resolved to a simple constant by {@link flattenedExpression}.
 * const obj = { val: "hello" };
 * obj.val -> { constant: "hello" }
 */
export const evalToConstant = (expr: Expr): Constant | undefined => {
  if (
    isStringLiteralExpr(expr) ||
    isNumberLiteralExpr(expr) ||
    isBooleanLiteral(expr) ||
    isNullLiteralExpr(expr) ||
    isUndefinedLiteralExpr(expr)
  ) {
    return { constant: expr.value };
  } else if (isArrayLiteralExpr(expr)) {
    const array = [];
    for (const item of expr.items) {
      if (isSpreadElementExpr(item)) {
        const val = evalToConstant(item.expr);
        if (val === undefined) {
          return undefined;
        } else if (Array.isArray(val.constant)) {
          array.push(...val.constant);
        }
      } else {
        const val = evalToConstant(item);
        if (val === undefined) {
          return undefined;
        }
        array.push(val.constant);
      }
    }
    return { constant: array };
  } else if (isObjectLiteralExpr(expr)) {
    const obj: any = {};
    for (const prop of expr.properties) {
      if (isPropAssignExpr(prop)) {
        let name;
        if (isComputedPropertyNameExpr(prop.name)) {
          const nameConst = evalToConstant(prop.name);
          if (
            typeof nameConst?.constant === "string" ||
            typeof nameConst?.constant === "number" ||
            typeof nameConst?.constant === "symbol"
          ) {
            name = nameConst.constant;
          } else {
            return undefined;
          }
        } else {
          name = isIdentifier(prop.name) ? prop.name.name : prop.name.value;
        }
        const val = evalToConstant(prop.expr);
        if (val === undefined) {
          return undefined;
        } else {
          obj[name] = val.constant;
        }
      } else if (isSpreadAssignExpr(prop)) {
        const spreadConst = evalToConstant(prop.expr);
        if (spreadConst === undefined) {
          return undefined;
        } else if (
          spreadConst.constant === null ||
          spreadConst.constant === undefined
        ) {
          // no-op, spreading null/undefined achieves nothing
        } else if (typeof spreadConst.constant === "object") {
          for (const [key, val] of Object.entries(spreadConst.constant)) {
            obj[key] = val;
          }
        }
      }
    }
    return { constant: obj };
  } else if (isUnaryExpr(expr) && expr.op === "-") {
    const number = evalToConstant(expr.expr)?.constant;
    if (typeof number === "number") {
      return { constant: -number };
    }
  } else if (isPropAccessExpr(expr)) {
    const obj = evalToConstant(expr.expr)?.constant as any;
    if (obj && expr.name in obj) {
      return { constant: obj[expr.name] };
    }
    return undefined;
  } else if (isReferenceExpr(expr)) {
    const value = expr.ref();
    if (
      typeof value === "string" ||
      typeof value === "number" ||
      typeof value === "boolean" ||
      typeof value === "undefined" ||
      value === null
    ) {
      return { constant: value };
    } else {
      return { constant: value as any };
    }
  } else if (isBinaryExpr(expr)) {
    const left: any = evalToConstant(expr.left);
    const right: any = evalToConstant(expr.right);
    if (left !== undefined && right !== undefined) {
      if (expr.op === "+") {
        return { constant: left.constant + right.constant };
      } else if (expr.op === "-") {
        return { constant: left.constant - right.constant };
      } else if (expr.op === "*") {
        return { constant: left.constant * right.constant };
      } else if (expr.op === "/") {
        return { constant: left.constant / right.constant };
      }
    }
  }
  return undefined;
};
