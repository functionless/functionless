import { CallExpr, Identifier } from "./expression";
import { AnyFunction, AnyLambda } from "./function";
import { FunctionlessNode } from "./node";
import { AnyTable } from "./table";

export function lookupIdentifier(id: Identifier) {
  return lookup(id.parent);

  function lookup(
    expr: FunctionlessNode | undefined
  ): FunctionlessNode | undefined {
    if (expr === undefined) {
      return undefined;
    } else if (expr.kind === "VariableDecl" && expr.name === id.name) {
      return expr;
    } else if (expr.kind === "FunctionDecl" || expr.kind === "FunctionExpr") {
      const parameter = expr.parameters.find((param) => param.name === id.name);
      if (parameter) {
        return parameter;
      }
    } else if (expr.kind === "ForInStmt" || expr.kind === "ForOfStmt") {
      if (expr.i.name === id.name) {
        return expr.i;
      }
    }
    if (expr.prev) {
      return lookup(expr.prev);
    } else {
      return lookup(expr.parent);
    }
  }
}

export function findService(
  expr: FunctionlessNode
): AnyTable | AnyLambda | undefined {
  if (expr.kind === "ReferenceExpr") {
    return expr.ref();
  } else if (expr.kind === "PropAccessExpr") {
    return findService(expr.expr);
  } else if (expr.kind === "CallExpr") {
    return findService(expr.expr);
  } else if (expr.kind === "VariableDecl" && expr.expr) {
    return findService(expr.expr);
  }
  return undefined;
}

// export function indent(depth: number) {
//   return Array.from(new Array(depth)).join(" ");
// }

// derives a name from an expression - this can be used to name infrastructure, such as an AppsyncFunction.
// e.g. table.getItem(..) => "table_getItem"
export function toName(expr: FunctionlessNode): string {
  if (expr.kind === "Identifier") {
    return expr.name;
  } else if (expr.kind === "PropAccessExpr") {
    return `${toName(expr.expr)}_${expr.name}`;
  } else if (expr.kind === "ReferenceExpr") {
    return expr.ref().resource.node.addr;
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

export function findFunction(call: CallExpr): AnyFunction | undefined {
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
