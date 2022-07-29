import {
  ArrayBinding,
  BindingElem,
  ClassDecl,
  ClassStaticBlockDecl,
  ConstructorDecl,
  FunctionDecl,
  GetAccessorDecl,
  MethodDecl,
  ObjectBinding,
  ParameterDecl,
  PropDecl,
  SetAccessorDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import { Err } from "./error";
import {
  SuperKeyword,
  ImportKeyword,
  Argument,
  ArrayLiteralExpr,
  ArrowFunctionExpr,
  AwaitExpr,
  BigIntExpr,
  BinaryExpr,
  BooleanLiteralExpr,
  CallExpr,
  ClassExpr,
  ComputedPropertyNameExpr,
  ConditionExpr,
  DeleteExpr,
  ElementAccessExpr,
  FunctionExpr,
  Identifier,
  NewExpr,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  OmittedExpr,
  ParenthesizedExpr,
  PostfixUnaryExpr,
  PrivateIdentifier,
  PromiseArrayExpr,
  PromiseExpr,
  PropAccessExpr,
  PropAssignExpr,
  ReferenceExpr,
  RegexExpr,
  SpreadAssignExpr,
  SpreadElementExpr,
  StringLiteralExpr,
  TaggedTemplateExpr,
  TemplateExpr,
  ThisExpr,
  TypeOfExpr,
  UnaryExpr,
  UndefinedLiteralExpr,
  VoidExpr,
  YieldExpr,
} from "./expression";
import { FunctionlessNode } from "./node";
import { NodeKind } from "./node-kind";
import {
  BlockStmt,
  BreakStmt,
  CaseClause,
  CatchClause,
  ContinueStmt,
  DebuggerStmt,
  DefaultClause,
  DoStmt,
  EmptyStmt,
  ExprStmt,
  ForInStmt,
  ForOfStmt,
  ForStmt,
  IfStmt,
  LabelledStmt,
  ReturnStmt,
  SwitchStmt,
  ThrowStmt,
  TryStmt,
  VariableStmt,
  WhileStmt,
  WithStmt,
} from "./statement";

/**
 * A memory-efficient representation of a serializer {@link FunctionlessNode} as an s-expression tuple.
 *
 * ```ts
 * ex.
 * // class representation
 * new Identifier("id"),
 *
 * // tuple s-expr representation
 * [Identifier, "id"]
 * ```
 */
export type SExpr<Node extends FunctionlessNode> = [
  kind: Node["kind"],
  ...args: any[] // we could make these more type-safe, but TS has instantiation problems because of eager evaluation of spreads on recursive tuple types
];

/**
 * Parse a {@link SExpr} representation of a {@link FunctionlessNode} into its class form.
 * @param expr
 * @returns
 */
export function parseSExpr<Kind extends NodeKind>(
  expr: [kind: Kind, ...args: any[]]
): InstanceType<typeof nodes[Kind]> {
  const [kind, ...args] = expr;
  const ctor: new (...args: any[]) => any = nodes[kind];
  // TODO: recursively parse the args s-expressions
  return new ctor(...(<any>args));
}

export const declarations = {
  [NodeKind.ArrayBinding]: ArrayBinding,
  [NodeKind.BindingElem]: BindingElem,
  [NodeKind.ClassDecl]: ClassDecl,
  [NodeKind.ClassStaticBlockDecl]: ClassStaticBlockDecl,
  [NodeKind.ConstructorDecl]: ConstructorDecl,
  [NodeKind.FunctionDecl]: FunctionDecl,
  [NodeKind.GetAccessorDecl]: GetAccessorDecl,
  [NodeKind.MethodDecl]: MethodDecl,
  [NodeKind.ObjectBinding]: ObjectBinding,
  [NodeKind.ParameterDecl]: ParameterDecl,
  [NodeKind.PropDecl]: PropDecl,
  [NodeKind.SetAccessorDecl]: SetAccessorDecl,
  [NodeKind.VariableDecl]: VariableDecl,
  [NodeKind.VariableDeclList]: VariableDeclList,
} as const;

export const error = {
  [NodeKind.Err]: Err,
};

export const statements = {
  [NodeKind.BlockStmt]: BlockStmt,
  [NodeKind.BreakStmt]: BreakStmt,
  [NodeKind.CaseClause]: CaseClause,
  [NodeKind.CatchClause]: CatchClause,
  [NodeKind.ContinueStmt]: ContinueStmt,
  [NodeKind.DebuggerStmt]: DebuggerStmt,
  [NodeKind.DefaultClause]: DefaultClause,
  [NodeKind.DoStmt]: DoStmt,
  [NodeKind.EmptyStmt]: EmptyStmt,
  [NodeKind.ExprStmt]: ExprStmt,
  [NodeKind.ForInStmt]: ForInStmt,
  [NodeKind.ForOfStmt]: ForOfStmt,
  [NodeKind.ForStmt]: ForStmt,
  [NodeKind.IfStmt]: IfStmt,
  [NodeKind.LabelledStmt]: LabelledStmt,
  [NodeKind.ReturnStmt]: ReturnStmt,
  [NodeKind.SwitchStmt]: SwitchStmt,
  [NodeKind.ThrowStmt]: ThrowStmt,
  [NodeKind.TryStmt]: TryStmt,
  [NodeKind.VariableStmt]: VariableStmt,
  [NodeKind.WhileStmt]: WhileStmt,
  [NodeKind.WithStmt]: WithStmt,
} as const;

export const expressions = {
  [NodeKind.Argument]: Argument,
  [NodeKind.ArrayLiteralExpr]: ArrayLiteralExpr,
  [NodeKind.ArrowFunctionExpr]: ArrowFunctionExpr,
  [NodeKind.AwaitExpr]: AwaitExpr,
  [NodeKind.BigIntExpr]: BigIntExpr,
  [NodeKind.BinaryExpr]: BinaryExpr,
  [NodeKind.BooleanLiteralExpr]: BooleanLiteralExpr,
  [NodeKind.CallExpr]: CallExpr,
  [NodeKind.ClassExpr]: ClassExpr,
  [NodeKind.ComputedPropertyNameExpr]: ComputedPropertyNameExpr,
  [NodeKind.ConditionExpr]: ConditionExpr,
  [NodeKind.DeleteExpr]: DeleteExpr,
  [NodeKind.ElementAccessExpr]: ElementAccessExpr,
  [NodeKind.FunctionExpr]: FunctionExpr,
  [NodeKind.Identifier]: Identifier,
  [NodeKind.NewExpr]: NewExpr,
  [NodeKind.NullLiteralExpr]: NullLiteralExpr,
  [NodeKind.NumberLiteralExpr]: NumberLiteralExpr,
  [NodeKind.ObjectLiteralExpr]: ObjectLiteralExpr,
  [NodeKind.OmittedExpr]: OmittedExpr,
  [NodeKind.ParenthesizedExpr]: ParenthesizedExpr,
  [NodeKind.PostfixUnaryExpr]: PostfixUnaryExpr,
  [NodeKind.PrivateIdentifier]: PrivateIdentifier,
  [NodeKind.PromiseArrayExpr]: PromiseArrayExpr,
  [NodeKind.PromiseExpr]: PromiseExpr,
  [NodeKind.PropAccessExpr]: PropAccessExpr,
  [NodeKind.PropAssignExpr]: PropAssignExpr,
  [NodeKind.ReferenceExpr]: ReferenceExpr,
  [NodeKind.RegexExpr]: RegexExpr,
  [NodeKind.SpreadAssignExpr]: SpreadAssignExpr,
  [NodeKind.SpreadElementExpr]: SpreadElementExpr,
  [NodeKind.StringLiteralExpr]: StringLiteralExpr,
  [NodeKind.TaggedTemplateExpr]: TaggedTemplateExpr,
  [NodeKind.TemplateExpr]: TemplateExpr,
  [NodeKind.ThisExpr]: ThisExpr,
  [NodeKind.TypeOfExpr]: TypeOfExpr,
  [NodeKind.UnaryExpr]: UnaryExpr,
  [NodeKind.UndefinedLiteralExpr]: UndefinedLiteralExpr,
  [NodeKind.VoidExpr]: VoidExpr,
  [NodeKind.YieldExpr]: YieldExpr,
} as const;

export const keywords = {
  [NodeKind.ImportKeyword]: ImportKeyword,
  [NodeKind.SuperKeyword]: SuperKeyword,
};

export const nodes = {
  ...declarations,
  ...error,
  ...expressions,
  ...keywords,
  ...statements,
} as const;
