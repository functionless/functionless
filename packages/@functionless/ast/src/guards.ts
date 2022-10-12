import type { BindingPattern, Decl } from "./declaration";
import type { Expr, VariableReference } from "./expression";
import type { FunctionlessNode } from "./node";
import { NodeKind } from "./node-kind";
import type { Stmt } from "./statement";

export function isNode(a: any): a is FunctionlessNode {
  return typeof a?.kind === "number";
}

export const isErr = typeGuard(NodeKind.Err);

export function isExpr(a: any): a is Expr {
  return isNode(a) && a.nodeKind === "Expr";
}

export const isArgument = typeGuard(NodeKind.Argument);
export const isArrayLiteralExpr = typeGuard(NodeKind.ArrayLiteralExpr);
export const isArrowFunctionExpr = typeGuard(NodeKind.ArrowFunctionExpr);
export const isAwaitExpr = typeGuard(NodeKind.AwaitExpr);
export const isBigIntExpr = typeGuard(NodeKind.BigIntExpr);
export const isBinaryExpr = typeGuard(NodeKind.BinaryExpr);
export const isBooleanLiteralExpr = typeGuard(NodeKind.BooleanLiteralExpr);
export const isCallExpr = typeGuard(NodeKind.CallExpr);
export const isClassExpr = typeGuard(NodeKind.ClassExpr);
export const isComputedPropertyNameExpr = typeGuard(
  NodeKind.ComputedPropertyNameExpr
);
export const isConditionExpr = typeGuard(NodeKind.ConditionExpr);
export const isDeleteExpr = typeGuard(NodeKind.DeleteExpr);
export const isElementAccessExpr = typeGuard(NodeKind.ElementAccessExpr);
export const isFunctionExpr = typeGuard(NodeKind.FunctionExpr);
export const isIdentifier = typeGuard(NodeKind.Identifier);
export const isImportKeyword = typeGuard(NodeKind.ImportKeyword);
export const isNewExpr = typeGuard(NodeKind.NewExpr);
export const isNoSubstitutionTemplateLiteral = typeGuard(
  NodeKind.NoSubstitutionTemplateLiteral
);
export const isNullLiteralExpr = typeGuard(NodeKind.NullLiteralExpr);
export const isNumberLiteralExpr = typeGuard(NodeKind.NumberLiteralExpr);
export const isObjectLiteralExpr = typeGuard(NodeKind.ObjectLiteralExpr);
export const isOmittedExpr = typeGuard(NodeKind.OmittedExpr);
export const isParenthesizedExpr = typeGuard(NodeKind.ParenthesizedExpr);
export const isPostfixUnaryExpr = typeGuard(NodeKind.PostfixUnaryExpr);
export const isPrivateIdentifier = typeGuard(NodeKind.PrivateIdentifier);
export const isPropAccessExpr = typeGuard(NodeKind.PropAccessExpr);
export const isPropAssignExpr = typeGuard(NodeKind.PropAssignExpr);
export const isReferenceExpr = typeGuard(NodeKind.ReferenceExpr);
export const isRegexExpr = typeGuard(NodeKind.RegexExpr);
export const isSpreadAssignExpr = typeGuard(NodeKind.SpreadAssignExpr);
export const isSpreadElementExpr = typeGuard(NodeKind.SpreadElementExpr);
export const isStringLiteralExpr = typeGuard(NodeKind.StringLiteralExpr);
export const isSuperKeyword = typeGuard(NodeKind.SuperKeyword);
export const isTemplateExpr = typeGuard(NodeKind.TemplateExpr);
export const isThisExpr = typeGuard(NodeKind.ThisExpr);
export const isTypeOfExpr = typeGuard(NodeKind.TypeOfExpr);
export const isUnaryExpr = typeGuard(NodeKind.UnaryExpr);
export const isUndefinedLiteralExpr = typeGuard(NodeKind.UndefinedLiteralExpr);
export const isVoidExpr = typeGuard(NodeKind.VoidExpr);
export const isYieldExpr = typeGuard(NodeKind.YieldExpr);

export const isObjectElementExpr = typeGuard(
  NodeKind.PropAssignExpr,
  NodeKind.SpreadAssignExpr
);

export const isLiteralExpr = typeGuard(
  NodeKind.ArrayLiteralExpr,
  NodeKind.BooleanLiteralExpr,
  NodeKind.UndefinedLiteralExpr,
  NodeKind.NullLiteralExpr,
  NodeKind.NumberLiteralExpr,
  NodeKind.ObjectLiteralExpr,
  NodeKind.StringLiteralExpr
);

export const isLiteralPrimitiveExpr = typeGuard(
  NodeKind.BooleanLiteralExpr,
  NodeKind.NullLiteralExpr,
  NodeKind.NumberLiteralExpr,
  NodeKind.StringLiteralExpr
);

export const isTemplateHead = typeGuard(NodeKind.TemplateHead);
export const isTemplateSpan = typeGuard(NodeKind.TemplateSpan);
export const isTemplateMiddle = typeGuard(NodeKind.TemplateMiddle);
export const isTemplateTail = typeGuard(NodeKind.TemplateTail);

export function isStmt(a: any): a is Stmt {
  return isNode(a) && a.nodeKind === "Stmt";
}
export const isBlockStmt = typeGuard(NodeKind.BlockStmt);
export const isBreakStmt = typeGuard(NodeKind.BreakStmt);
export const isCaseClause = typeGuard(NodeKind.CaseClause);
export const isCatchClause = typeGuard(NodeKind.CatchClause);
export const isContinueStmt = typeGuard(NodeKind.ContinueStmt);
export const isDebuggerStmt = typeGuard(NodeKind.DebuggerStmt);
export const isDefaultClause = typeGuard(NodeKind.DefaultClause);
export const isDoStmt = typeGuard(NodeKind.DoStmt);
export const isEmptyStmt = typeGuard(NodeKind.EmptyStmt);
export const isExprStmt = typeGuard(NodeKind.ExprStmt);
export const isForInStmt = typeGuard(NodeKind.ForInStmt);
export const isForOfStmt = typeGuard(NodeKind.ForOfStmt);
export const isForStmt = typeGuard(NodeKind.ForStmt);
export const isIfStmt = typeGuard(NodeKind.IfStmt);
export const isLabelledStmt = typeGuard(NodeKind.LabelledStmt);
export const isReturnStmt = typeGuard(NodeKind.ReturnStmt);
export const isSwitchStmt = typeGuard(NodeKind.SwitchStmt);
export const isTaggedTemplateExpr = typeGuard(NodeKind.TaggedTemplateExpr);
export const isThrowStmt = typeGuard(NodeKind.ThrowStmt);
export const isTryStmt = typeGuard(NodeKind.TryStmt);
export const isVariableStmt = typeGuard(NodeKind.VariableStmt);
export const isWhileStmt = typeGuard(NodeKind.WhileStmt);
export const isWithStmt = typeGuard(NodeKind.WithStmt);

export const isSwitchClause = typeGuard(
  NodeKind.CaseClause,
  NodeKind.DefaultClause
);

export function isDecl(a: any): a is Decl {
  return isNode(a) && a.nodeKind === "Decl";
}

export const isFunctionLike = typeGuard(
  NodeKind.FunctionDecl,
  NodeKind.FunctionExpr,
  NodeKind.ArrowFunctionExpr
);

export const isClassLike = typeGuard(NodeKind.ClassDecl, NodeKind.ClassExpr);

export const isClassDecl = typeGuard(NodeKind.ClassDecl);
export const isClassStaticBlockDecl = typeGuard(NodeKind.ClassStaticBlockDecl);
export const isConstructorDecl = typeGuard(NodeKind.ConstructorDecl);
export const isFunctionDecl = typeGuard(NodeKind.FunctionDecl);
export const isGetAccessorDecl = typeGuard(NodeKind.GetAccessorDecl);
export const isMethodDecl = typeGuard(NodeKind.MethodDecl);
export const isParameterDecl = typeGuard(NodeKind.ParameterDecl);
export const isPropDecl = typeGuard(NodeKind.PropDecl);
export const isSetAccessorDecl = typeGuard(NodeKind.SetAccessorDecl);
export const isClassMember = typeGuard(
  NodeKind.ClassStaticBlockDecl,
  NodeKind.ConstructorDecl,
  NodeKind.MethodDecl,
  NodeKind.PropDecl
);
export const isVariableDecl = typeGuard(NodeKind.VariableDecl);

export const isArrayBinding = typeGuard(NodeKind.ArrayBinding);
export const isBindingElem = typeGuard(NodeKind.BindingElem);
export const isObjectBinding = typeGuard(NodeKind.ObjectBinding);

export const isPropName = typeGuard(
  NodeKind.ComputedPropertyNameExpr,
  NodeKind.Identifier,
  NodeKind.NumberLiteralExpr,
  NodeKind.StringLiteralExpr
);

export const isBindingPattern = (a: any): a is BindingPattern =>
  isNode(a) && (isObjectBinding(a) || isArrayBinding(a));

export const isVariableDeclList = typeGuard(NodeKind.VariableDeclList);

// generates type guards
export function typeGuard<Kind extends NodeKind>(
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

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
