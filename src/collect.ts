import { assertNever } from "./assert";
import { FunctionlessNode } from "./node";

/**
 * Walks each child of a {@link node} and calls {@link walk} and returns each result as an array.
 *
 * @param node the node to walk the children of
 * @param walk callback to call with each child node
 * @returns an array of each of the results
 */
export function collect<T extends FunctionlessNode, U>(
  node: T,
  walk: (node: FunctionlessNode) => U
): U[] {
  if (node.kind === "ArrayLiteralExpr") {
    return node.items.reduce(
      (items: U[], item) => items.concat([walk(item)]),
      []
    );
  } else if (node.kind === "BinaryExpr") {
    return [walk(node.left), walk(node.right)];
  } else if (node.kind === "BlockStmt") {
    return node.statements.reduce(
      (statements: U[], stmt) => statements.concat([walk(stmt)]),
      []
    );
  } else if (node.kind === "BooleanLiteralExpr") {
  } else if (node.kind === "BreakStmt") {
  } else if (node.kind === "CallExpr" || node.kind === "NewExpr") {
    return Object.values(node.args).reduce(
      (items: U[], item) => items.concat([walk(item)]),
      [walk(node.expr)]
    );
  } else if (node.kind === "CatchClause") {
    return [
      ...(node.variableDecl ? [walk(node.variableDecl)] : []),
      walk(node.block),
    ];
  } else if (node.kind === "ConditionExpr") {
    return [walk(node.when), walk(node.then), walk(node._else)];
  } else if (node.kind == "ElementAccessExpr") {
    return [walk(node.expr), walk(node.element)];
  } else if (node.kind === "ExprStmt") {
    return [walk(node.expr)];
  } else if (node.kind === "ForInStmt" || node.kind === "ForOfStmt") {
    return [walk(node.variableDecl), walk(node.expr), walk(node.body)];
  } else if (node.kind === "FunctionDecl" || node.kind === "FunctionExpr") {
    return node.parameters.reduce(
      (items: U[], item) => items.concat([walk(item)]),
      [walk(node.body)]
    );
  } else if (node.kind === "Identifier") {
  } else if (node.kind === "IfStmt") {
    return [
      walk(node.when),
      walk(node.then),
      ...(node._else ? [walk(node._else)] : []),
    ];
  } else if (node.kind === "NullLiteralExpr") {
  } else if (node.kind === "NumberLiteralExpr") {
  } else if (node.kind === "ObjectLiteralExpr") {
    return node.properties.reduce(
      (items: U[], item) => items.concat([walk(item)]),
      []
    );
  } else if (node.kind === "ParameterDecl") {
  } else if (node.kind === "PropAccessExpr") {
    return [walk(node.expr)];
  } else if (node.kind === "PropAssignExpr") {
    return [walk(node.name), walk(node.expr)];
  } else if (node.kind === "ReferenceExpr") {
  } else if (node.kind === "ReturnStmt") {
    if (node.expr) {
      return [walk(node.expr)];
    }
  } else if (node.kind === "SpreadAssignExpr") {
    return [walk(node.expr)];
  } else if (node.kind === "SpreadElementExpr") {
    return [walk(node.expr)];
  } else if (node.kind === "StringLiteralExpr") {
  } else if (node.kind === "TemplateExpr") {
    return node.exprs.reduce(
      (items: U[], item) => items.concat([walk(item)]),
      []
    );
  } else if (node.kind === "ThrowStmt") {
    return [walk(node.expr)];
  } else if (node.kind === "TryStmt") {
    return [
      walk(node.tryBlock),
      ...(node.catchClause ? [walk(node.catchClause)] : []),
      ...(node.finallyBlock ? [walk(node.finallyBlock)] : []),
    ];
  } else if (node.kind === "UnaryExpr") {
    return [walk(node.expr)];
  } else if (node.kind === "VariableStmt") {
    if (node.expr) {
      return [walk(node.expr)];
    }
  } else {
    return assertNever(node);
  }
  return [];
}
