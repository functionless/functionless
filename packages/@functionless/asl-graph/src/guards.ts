import {
  CallExpr,
  FunctionlessNode,
  Identifier,
  isCallExpr,
  isIdentifier,
  isPropAccessExpr,
  isReferenceExpr,
  isThrowStmt,
  PropAccessExpr,
  ReferenceExpr,
} from "@functionless/ast";
import { isASLIntegration } from "./asl-integration";

export function isForEach(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr;
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "forEach"
  );
}

export function isMap(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr;
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "map"
  );
}

export function isSlice(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "slice";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "slice"
  );
}

export function isJoin(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "join";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "join"
  );
}

export function isFilter(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "filter";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "filter"
  );
}

export function isIncludes(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "includes";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "includes"
  );
}

export function isJsonParse(call: CallExpr): call is CallExpr & {
  expr: PropAccessExpr & {
    expr: ReferenceExpr;
    name: Identifier & { name: "parse" };
  };
} {
  return (
    isPropAccessExpr(call.expr) &&
    isIdentifier(call.expr.name) &&
    call.expr.name.name === "parse" &&
    isReferenceExpr(call.expr.expr) &&
    call.expr.expr.ref() === JSON
  );
}

export function isJsonStringify(call: CallExpr): call is CallExpr & {
  expr: PropAccessExpr & {
    expr: ReferenceExpr;
    name: Identifier & { name: "stringify" };
  };
} {
  return (
    isPropAccessExpr(call.expr) &&
    isIdentifier(call.expr.name) &&
    call.expr.name.name === "stringify" &&
    isReferenceExpr(call.expr.expr) &&
    call.expr.expr.ref() === JSON
  );
}

export function isSplit(expr: CallExpr): expr is CallExpr & {
  expr: PropAccessExpr & {
    name: "split";
  };
} {
  return (
    isPropAccessExpr(expr.expr) &&
    isIdentifier(expr.expr.name) &&
    expr.expr.name.name === "split"
  );
}

export function canThrow(node: FunctionlessNode): boolean {
  const flow = analyzeFlow(node);
  return (flow.hasTask || flow.hasThrow) ?? false;
}

interface FlowResult {
  hasTask?: true;
  hasThrow?: true;
}

export function analyzeFlow(node: FunctionlessNode): FlowResult {
  return node.children
    .map(analyzeFlow)
    .reduce(
      (a, b) => ({ ...a, ...b }),
      isCallExpr(node) &&
        isReferenceExpr(node.expr) &&
        isASLIntegration(node.expr.ref())
        ? { hasTask: true }
        : isThrowStmt(node)
        ? { hasThrow: true }
        : {}
    );
}
