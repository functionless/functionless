import { Call, Node, Identifier } from "./expression";
import { AnyFunction, AnyLambda } from "./function";
import { AnyTable } from "./table";

export function lookupIdentifier(id: Identifier) {
  return lookup(id.parent);

  function lookup(expr: Node | undefined): Node | undefined {
    if (expr === undefined) {
      return undefined;
    } else if (expr.kind === "VariableDecl" && expr.name === id.name) {
      return expr;
    } else if (expr.kind === "FunctionDecl") {
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

export function findService(expr: Node): AnyTable | AnyLambda | undefined {
  if (expr.kind === "Reference") {
    return expr.ref();
  } else if (expr.kind === "PropRef") {
    return findService(expr.expr);
  } else if (expr.kind === "Call") {
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
export function toName(expr: Node): string {
  if (expr.kind === "Identifier") {
    return expr.name;
  } else if (expr.kind === "PropRef") {
    return `${toName(expr.expr)}_${expr.name}`;
  } else if (expr.kind === "Reference") {
    return expr.ref().resource.node.addr;
  } else {
    throw new Error(`invalid expression: '${expr.kind}'`);
  }
}

export function isInTopLevelScope(expr: Node): boolean {
  if (expr.parent === undefined) {
    return true;
  }
  return walk(expr.parent);

  function walk(expr: Node): boolean {
    if (expr.kind === "FunctionDecl") {
      return expr.parent === undefined;
    } else if (expr.kind === "ForInStmt" || expr.kind === "ForOfStmt") {
      return false;
    } else if (expr.parent === undefined) {
      return true;
    }
    return walk(expr.parent);
  }
}

export function findFunction(call: Call): AnyFunction | undefined {
  return find(call.expr);

  function find(expr: Node): any {
    if (expr.kind === "PropRef") {
      return find(expr.expr)?.[expr.name];
    } else if (expr.kind === "Identifier") {
      return undefined;
    } else if (expr.kind === "Reference") {
      return expr.ref();
    } else {
      return undefined;
    }
  }
}
