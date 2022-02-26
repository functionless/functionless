import { Expr, Identifier } from "./expression";
import { AnyLambda } from "./function";
import { AnyTable } from "./table";

export function lookupIdentifier(id: Identifier) {
  return lookup(id.parent);

  function lookup(expr: Expr | undefined): Expr | undefined {
    if (expr === undefined) {
      return undefined;
    } else if (expr.kind === "VariableDecl" && expr.name === id.name) {
      return expr;
    } else if (expr.kind === "FunctionDecl") {
      const parameter = expr.parameters.find((param) => param.name === id.name);
      if (parameter) {
        return parameter;
      }
    }
    if (expr.prev) {
      return lookup(expr.prev);
    } else {
      return lookup(expr.parent);
    }
  }
}

export function findService(expr: Expr): AnyTable | AnyLambda | undefined {
  if (expr.kind === "Reference") {
    return expr.ref();
  } else if (expr.kind === "PropRef") {
    return findService(expr.expr);
  } else if (expr.kind === "Call") {
    return findService(expr.expr);
  } else if (expr.kind === "VariableDecl") {
    return findService(expr.expr);
  }
  return undefined;
}

// export function indent(depth: number) {
//   return Array.from(new Array(depth)).join(" ");
// }

// derives a name from an expression - this can be used to name infrastructure, such as an AppsyncFunction.
// e.g. table.getItem(..) => "table_getItem"
export function toName(expr: Expr): string {
  if (expr.kind === "Identifier") {
    return expr.name;
  } else if (expr.kind === "PropRef") {
    return `${toName(expr.expr)}_${expr.id}`;
  } else if (expr.kind === "Reference") {
    return expr.ref().resource.node.addr;
  } else {
    throw new Error(`invalid expression: '${expr.kind}'`);
  }
}
