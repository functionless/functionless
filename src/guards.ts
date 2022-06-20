import type { Expr } from "./expression";
import type { FunctionlessNode } from "./node";
import type { Stmt } from "./statement";

export function isNode(a: any): a is FunctionlessNode {
  return typeof a?.kind === "string";
}

export const isErr = typeGuard("Err");

export function isExpr(a: any): a is Expr {
  return (
    isNode(a) &&
    (isArgument(a) ||
      isArrayLiteralExpr(a) ||
      isAwaitExpr(a) ||
      isBinaryExpr(a) ||
      isBooleanLiteralExpr(a) ||
      isCallExpr(a) ||
      isConditionExpr(a) ||
      isComputedPropertyNameExpr(a) ||
      isFunctionExpr(a) ||
      isElementAccessExpr(a) ||
      isFunctionExpr(a) ||
      isIdentifier(a) ||
      isNewExpr(a) ||
      isNullLiteralExpr(a) ||
      isNumberLiteralExpr(a) ||
      isObjectLiteralExpr(a) ||
      isPromiseArrayExpr(a) ||
      isPromiseExpr(a) ||
      isPropAccessExpr(a) ||
      isPropAssignExpr(a) ||
      isReferenceExpr(a) ||
      isStringLiteralExpr(a) ||
      isTemplateExpr(a) ||
      isTypeOfExpr(a) ||
      isUnaryExpr(a) ||
      isUndefinedLiteralExpr(a))
  );
}

export const isFunctionExpr = typeGuard("FunctionExpr");
export const isReferenceExpr = typeGuard("ReferenceExpr");
export const isIdentifier = typeGuard("Identifier");
export const isPropAccessExpr = typeGuard("PropAccessExpr");
export const isElementAccessExpr = typeGuard("ElementAccessExpr");
export const isArgument = typeGuard("Argument");
export const isCallExpr = typeGuard("CallExpr");
export const isNewExpr = typeGuard("NewExpr");
export const isConditionExpr = typeGuard("ConditionExpr");
export const isBinaryExpr = typeGuard("BinaryExpr");
export const isUnaryExpr = typeGuard("UnaryExpr");
export const isNullLiteralExpr = typeGuard("NullLiteralExpr");
export const isUndefinedLiteralExpr = typeGuard("UndefinedLiteralExpr");
export const isBooleanLiteralExpr = typeGuard("BooleanLiteralExpr");
export const isNumberLiteralExpr = typeGuard("NumberLiteralExpr");
export const isStringLiteralExpr = typeGuard("StringLiteralExpr");
export const isArrayLiteralExpr = typeGuard("ArrayLiteralExpr");
export const isObjectLiteralExpr = typeGuard("ObjectLiteralExpr");
export const isPropAssignExpr = typeGuard("PropAssignExpr");
export const isComputedPropertyNameExpr = typeGuard("ComputedPropertyNameExpr");
export const isSpreadAssignExpr = typeGuard("SpreadAssignExpr");
export const isSpreadElementExpr = typeGuard("SpreadElementExpr");
export const isTemplateExpr = typeGuard("TemplateExpr");
export const isTypeOfExpr = typeGuard("TypeOfExpr");
export const isPromiseExpr = typeGuard("PromiseExpr");
export const isPromiseArrayExpr = typeGuard("PromiseArrayExpr");
export const isAwaitExpr = typeGuard("AwaitExpr");

export const isObjectElementExpr = typeGuard(
  "PropAssignExpr",
  "SpreadAssignExpr"
);

export const isLiteralExpr = typeGuard(
  "ArrayLiteralExpr",
  "BooleanLiteralExpr",
  "UndefinedLiteralExpr",
  "NullLiteralExpr",
  "NumberLiteralExpr",
  "ObjectLiteralExpr",
  "StringLiteralExpr"
);

export const isLiteralPrimitiveExpr = typeGuard(
  "BooleanLiteralExpr",
  "NullLiteralExpr",
  "NumberLiteralExpr",
  "StringLiteralExpr"
);

export function isStmt(a: any): a is Stmt {
  return (
    isNode(a) &&
    (isBreakStmt(a) ||
      isBlockStmt(a) ||
      isCatchClause(a) ||
      isContinueStmt(a) ||
      isDoStmt(a) ||
      isExprStmt(a) ||
      isForInStmt(a) ||
      isForOfStmt(a) ||
      isIfStmt(a) ||
      isReturnStmt(a) ||
      isThrowStmt(a) ||
      isTryStmt(a) ||
      isVariableStmt(a) ||
      isWhileStmt(a))
  );
}
export const isExprStmt = typeGuard("ExprStmt");
export const isVariableStmt = typeGuard("VariableStmt");
export const isBlockStmt = typeGuard("BlockStmt");
export const isReturnStmt = typeGuard("ReturnStmt");
export const isIfStmt = typeGuard("IfStmt");
export const isForOfStmt = typeGuard("ForOfStmt");
export const isForInStmt = typeGuard("ForInStmt");
export const isBreakStmt = typeGuard("BreakStmt");
export const isContinueStmt = typeGuard("ContinueStmt");
export const isTryStmt = typeGuard("TryStmt");
export const isCatchClause = typeGuard("CatchClause");
export const isThrowStmt = typeGuard("ThrowStmt");
export const isWhileStmt = typeGuard("WhileStmt");
export const isDoStmt = typeGuard("DoStmt");

export const isFunctionDecl = typeGuard("FunctionDecl");
export const isNativeFunctionDecl = typeGuard("NativeFunctionDecl");
export const isParameterDecl = typeGuard("ParameterDecl");

// generates type guards
export function typeGuard<Kind extends FunctionlessNode["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<FunctionlessNode, { kind: Kind }> {
  return (a: any): a is Extract<FunctionlessNode, { kind: Kind }> =>
    kinds.find((kind) => a?.kind === kind) !== undefined;
}
