import { assertNever } from "./assert";
import {
  Expr,
  isCall,
  isIdentifier,
  isIntrinsicExpr,
  isPropRef,
} from "./expression";
import { isStmt } from "./statement";

export function renderExpr(expr: Expr, depth = 0): string {
  if (expr === undefined) {
    return "";
  } else if (expr === null) {
    return "null";
  } else if (expr === true || expr === false) {
    return `${expr}`;
  } else if (typeof expr === "number") {
    return `${expr.toString(10)}`;
  } else if (typeof expr === "string") {
    return `"${expr}"`;
  } else if (isStmt(expr)) {
    throw new Error("todo");
  } else if (isIntrinsicExpr(expr)) {
    if (isIdentifier(expr)) {
      return expr.id.startsWith("$") ? expr.id : `$${expr.id}`;
    } else if (isCall(expr)) {
      return `${renderExpr(expr.expr)}(${Object.values(expr.args)
        .map((arg) => renderExpr(arg))
        .join(", ")})`;
    } else if (isPropRef(expr)) {
      return `${renderExpr(expr.expr)}.${expr.id}`;
    }
    throw new Error("todo");
  } else if (Array.isArray(expr)) {
    return indent(
      JSON.stringify(
        expr.map((item) => renderExpr(item, depth + 1)),
        null,
        2
      ),
      depth
    );
  } else if (typeof expr === "object") {
    return indent(
      JSON.stringify(
        Object.entries(expr)
          .map(([name, value]) => ({
            [name]: renderExpr(value, depth + 1),
          }))
          .reduce((a, b) => ({ ...a, ...b }), {})
      ),
      depth
    );
  }

  return assertNever(expr);
}

function indent(value: string, depth: number) {
  return value.replace("\n", `\n${Array.from(new Array(depth)).join(" ")}`);
}
