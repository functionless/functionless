import { CallExpr, CanReference } from "./expression";
// import { isStmt } from "./statement";
import { FunctionlessNode } from "./node";
import { VTL } from "./vtl";
import { ASL, Task } from "./asl";

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
    if (ref.kind === "AWS") {
      return "AWS";
    } else {
      return ref.resource.node.addr;
    }
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
  for (const item of arr) {
    if (!f(item)) {
      throw new Error(message);
    }
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
  return (a: any): a is EnsureOr<T> => {
    for (const f of fns) {
      if (f(a)) {
        return true;
      }
    }
    return false;
  };
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
