import { CallExpr, CanReference, Identifier } from "./expression";
import { isStmt, Stmt } from "./statement";
import { FunctionlessNode } from "./node";
import { VTL } from "./vtl";
import { ASL, Task } from "./asl";

export type AnyFunction = (...args: any[]) => any;

export function lookupIdentifier(id: Identifier) {
  return lookup(id.parent);

  function lookup(
    expr: FunctionlessNode | undefined
  ): FunctionlessNode | undefined {
    if (expr === undefined) {
      return undefined;
    } else if (expr.kind === "VariableStmt" && expr.name === id.name) {
      return expr;
    } else if (expr.kind === "FunctionDecl" || expr.kind === "FunctionExpr") {
      const parameter = expr.parameters.find((param) => param.name === id.name);
      if (parameter) {
        return parameter;
      }
    } else if (expr.kind === "ForInStmt" || expr.kind === "ForOfStmt") {
      if (expr.variableDecl.name === id.name) {
        return expr.variableDecl;
      }
    }
    if (isStmt(expr) && expr.prev) {
      return lookup(expr.prev);
    } else {
      return lookup(expr.parent);
    }
  }
}

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

// export function indent(depth: number) {
//   return Array.from(new Array(depth)).join(" ");
// }

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

// checks if a Stmt is terminal - meaning all branches explicitly return a value
export function isTerminal(stmt: Stmt): boolean {
  if (stmt.kind === "ReturnStmt" || stmt.kind === "ThrowStmt") {
    return true;
  } else if (stmt.kind === "TryStmt") {
    if (stmt.finallyBlock) {
      return (
        isTerminal(stmt.finallyBlock) ||
        (isTerminal(stmt.tryBlock) && isTerminal(stmt.catchClause.block))
      );
    } else {
      return isTerminal(stmt.tryBlock) && isTerminal(stmt.catchClause.block);
    }
  } else if (stmt.kind === "BlockStmt") {
    if (stmt.isEmpty()) {
      return false;
    } else {
      return isTerminal(stmt.lastStmt);
    }
  } else if (stmt.kind === "IfStmt") {
    return (
      isTerminal(stmt.then) &&
      stmt._else !== undefined &&
      isTerminal(stmt._else)
    );
  } else {
    return false;
  }
}

export function getLexicalScope(node: FunctionlessNode): string[] {
  return Array.from(new Set(getLexicalScope(node)));

  function getLexicalScope(node: FunctionlessNode | undefined): string[] {
    if (node === undefined) {
      return [];
    }
    return getLexicalScope(
      isStmt(node) && node.prev ? node.prev : node.parent
    ).concat(getNames(node));
  }

  function getNames(node: FunctionlessNode | undefined): string[] {
    if (node === undefined) {
      return [];
    } else if (node.kind === "VariableStmt") {
      return [node.name];
    } else if (node.kind === "FunctionExpr" || node.kind === "FunctionDecl") {
      return node.parameters.map((param) => param.name);
    } else if (node.kind === "ForInStmt" || node.kind === "ForOfStmt") {
      return [node.variableDecl.name];
    } else if (node.kind === "CatchClause" && node.variableDecl?.name) {
      return [node.variableDecl?.name];
    } else {
      return [];
    }
  }
}
