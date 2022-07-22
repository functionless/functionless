import type { BindingPattern, Decl } from "./declaration";
import type { Expr, VariableReference } from "./expression";
import type { FunctionlessNode } from "./node";
import type { Stmt } from "./statement";

export function isNode(a: any): a is FunctionlessNode {
  return typeof a?.kind === "string";
}

export const isErr = typeGuard("Err");

export function isExpr(a: any): a is Expr {
  return isNode(a) && a.nodeKind === "Expr";
}

export const isArgument = typeGuard("Argument");
export const isArrayLiteralExpr = typeGuard("ArrayLiteralExpr");
export const isArrowFunctionExpr = typeGuard("ArrowFunctionExpr");
export const isAwaitExpr = typeGuard("AwaitExpr");
export const isBinaryExpr = typeGuard("BinaryExpr");
export const isBooleanLiteralExpr = typeGuard("BooleanLiteralExpr");
export const isCallExpr = typeGuard("CallExpr");
export const isClassExpr = typeGuard("ClassExpr");
export const isComputedPropertyNameExpr = typeGuard("ComputedPropertyNameExpr");
export const isConditionExpr = typeGuard("ConditionExpr");
export const isElementAccessExpr = typeGuard("ElementAccessExpr");
export const isFunctionExpr = typeGuard("FunctionExpr");
export const isIdentifier = typeGuard("Identifier");
export const isPrivateIdentifier = typeGuard("PrivateIdentifier");
export const isNewExpr = typeGuard("NewExpr");
export const isNullLiteralExpr = typeGuard("NullLiteralExpr");
export const isNumberLiteralExpr = typeGuard("NumberLiteralExpr");
export const isObjectLiteralExpr = typeGuard("ObjectLiteralExpr");
export const isPostfixUnaryExpr = typeGuard("PostfixUnaryExpr");
export const isPromiseArrayExpr = typeGuard("PromiseArrayExpr");
export const isPromiseExpr = typeGuard("PromiseExpr");
export const isPropAccessExpr = typeGuard("PropAccessExpr");
export const isPropAssignExpr = typeGuard("PropAssignExpr");
export const isReferenceExpr = typeGuard("ReferenceExpr");
export const isSpreadAssignExpr = typeGuard("SpreadAssignExpr");
export const isSpreadElementExpr = typeGuard("SpreadElementExpr");
export const isStringLiteralExpr = typeGuard("StringLiteralExpr");
export const isSuperKeyword = typeGuard("SuperKeyword");
export const isTemplateExpr = typeGuard("TemplateExpr");
export const isThisExpr = typeGuard("ThisExpr");
export const isTypeOfExpr = typeGuard("TypeOfExpr");
export const isUnaryExpr = typeGuard("UnaryExpr");
export const isUndefinedLiteralExpr = typeGuard("UndefinedLiteralExpr");

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
  return isNode(a) && a.nodeKind === "Stmt";
}
export const isBlockStmt = typeGuard("BlockStmt");
export const isForStmt = typeGuard("ForStmt");
export const isBreakStmt = typeGuard("BreakStmt");
export const isCaseClause = typeGuard("CaseClause");
export const isCatchClause = typeGuard("CatchClause");
export const isContinueStmt = typeGuard("ContinueStmt");
export const isDebuggerStmt = typeGuard("DebuggerStmt");
export const isDefaultClause = typeGuard("DefaultClause");
export const isDoStmt = typeGuard("DoStmt");
export const isEmptyStmt = typeGuard("EmptyStmt");
export const isExprStmt = typeGuard("ExprStmt");
export const isForInStmt = typeGuard("ForInStmt");
export const isForOfStmt = typeGuard("ForOfStmt");
export const isIfStmt = typeGuard("IfStmt");
export const isLabelledStmt = typeGuard("LabelledStmt");
export const isReturnStmt = typeGuard("ReturnStmt");
export const isSwitchStmt = typeGuard("SwitchStmt");
export const isThrowStmt = typeGuard("ThrowStmt");
export const isTryStmt = typeGuard("TryStmt");
export const isVariableStmt = typeGuard("VariableStmt");
export const isWhileStmt = typeGuard("WhileStmt");
export const isWithStmt = typeGuard("WithStmt");
export const isYieldExpr = typeGuard("YieldExpr");

export const isSwitchClause = typeGuard("CaseClause", "DefaultClause");

export function isDecl(a: any): a is Decl {
  return isNode(a) && a.nodeKind === "Decl";
}

export const isClassDecl = typeGuard("ClassDecl");
export const isClassStaticBlockDecl = typeGuard("ClassStaticBlockDecl");
export const isConstructorDecl = typeGuard("ConstructorDecl");
export const isFunctionDecl = typeGuard("FunctionDecl");
export const isMethodDecl = typeGuard("MethodDecl");
export const isParameterDecl = typeGuard("ParameterDecl");
export const isPropDecl = typeGuard("PropDecl");
export const isClassMember = typeGuard(
  "ClassStaticBlockDecl",
  "ConstructorDecl",
  "MethodDecl",
  "PropDecl"
);
export const isVariableDecl = typeGuard("VariableDecl");

export const isArrayBinding = typeGuard("ArrayBinding");
export const isBindingElem = typeGuard("BindingElem");
export const isObjectBinding = typeGuard("ObjectBinding");

export const isPropName = typeGuard(
  "Identifier",
  "ComputedPropertyNameExpr",
  "StringLiteralExpr"
);

export const isBindingPattern = (a: any): a is BindingPattern =>
  isNode(a) && (isObjectBinding(a) || isArrayBinding(a));

export const isVariableDeclList = typeGuard("VariableDeclList");

// generates type guards
export function typeGuard<Kind extends FunctionlessNode["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<FunctionlessNode, { kind: Kind }> {
  return (a: any): a is Extract<FunctionlessNode, { kind: Kind }> =>
    kinds.find((kind) => a?.kind === kind) !== undefined;
}

export function isVariableReference(expr: Expr): expr is VariableReference {
  return (
    isIdentifier(expr) || isPropAccessExpr(expr) || isElementAccessExpr(expr)
  );
}
