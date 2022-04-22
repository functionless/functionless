import { CallExpr, CanReference } from "./expression";
import { FunctionlessNode } from "./node";
import { VTL } from "./vtl";
import { ASL, Task } from "./asl";
import { isAWS } from "./aws";
import ts from "typescript";
import { isTable } from "./table";
import { isFunction } from "./function";
import { isStepFunction } from "./step-function";
import { App } from "aws-cdk-lib";
import { SynthesisOptions } from "aws-cdk-lib/core/lib/private/synthesis";

export type AnyFunction = (...args: any[]) => any;

export function findService(expr: FunctionlessNode): CanReference | undefined {
  if (expr.kind === "ReferenceExpr") {
    return expr.ref();
  } else if (expr.kind === "PropAccessExpr") {
    return findService(expr.expr);
  } else if (expr.kind === "CallExpr") {
    return findService(expr.expr);
  } else if (expr.kind === "VariableStmt" && expr.expr) {
    return findService(expr.expr);
  } else if (expr.kind === "ReturnStmt" && expr.expr) {
    return findService(expr.expr);
  } else if (expr.kind === "ExprStmt") {
    return findService(expr.expr);
  }
  return undefined;
}

// derives a name from an expression - this can be used to name infrastructure, such as an AppsyncResolver.
// e.g. table.getItem(..) => "table_getItem"
export function toName(expr: FunctionlessNode): string {
  if (expr.kind === "Identifier") {
    return expr.name;
  } else if (expr.kind === "PropAccessExpr") {
    return `${toName(expr.expr)}_${expr.name}`;
  } else if (expr.kind === "ReferenceExpr") {
    const ref = expr.ref();
    if (isAWS(ref)) {
      return "AWS";
    } else if (isTable(ref) || isFunction(ref) || isStepFunction(ref)) {
      return ref.resource.node.addr;
    }
    throw Error("Cannot derive a name from a external node.");
  } else {
    throw new Error(`invalid expression: '${expr.kind}'`);
  }
}

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

/**
 * @param call call expression that may reference a callable integration
 * @returns the reference to the callable function, e.g. a Lambda Function or method on a DynamoDB Table
 */
export function findFunction(
  call: CallExpr
):
  | (((call: CallExpr, context: VTL) => string) &
      ((call: CallExpr, context: ASL) => Omit<Task, "Next">))
  | undefined {
  return find(call.expr);

  function find(expr: FunctionlessNode): any {
    if (expr.kind === "PropAccessExpr") {
      return find(expr.expr)?.[expr.name];
    } else if (expr.kind === "Identifier") {
      return undefined;
    } else if (expr.kind === "ReferenceExpr") {
      return expr.ref();
    } else {
      return undefined;
    }
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

/**
 * Experimental hack that waits for async code in CDK construct instantiation to complete before
 * calling app.synth().
 */
export const asyncSynth = async (app: App, options?: SynthesisOptions) => {
  await new Promise(setImmediate);
  return app.synth(options);
};
