export enum NodeKind {
  Argument = 0,
  ArrayBinding = 1,
  ArrayLiteralExpr = 2,
  ArrowFunctionExpr = 3,
  AwaitExpr = 4,
  BigIntExpr = 5,
  BinaryExpr = 6,
  BindingElem = 7,
  BlockStmt = 8,
  BooleanLiteralExpr = 9,
  BreakStmt = 10,
  CallExpr = 11,
  CaseClause = 12,
  CatchClause = 13,
  ClassDecl = 14,
  ClassExpr = 15,
  ClassStaticBlockDecl = 16,
  ComputedPropertyNameExpr = 17,
  ConditionExpr = 18,
  ConstructorDecl = 19,
  ContinueStmt = 20,
  DebuggerStmt = 21,
  DefaultClause = 22,
  DeleteExpr = 23,
  DoStmt = 24,
  ElementAccessExpr = 25,
  EmptyStmt = 26,
  Err = 27,
  ExprStmt = 28,
  ForInStmt = 29,
  ForOfStmt = 30,
  ForStmt = 31,
  FunctionDecl = 32,
  FunctionExpr = 33,
  GetAccessorDecl = 34,
  Identifier = 35,
  IfStmt = 36,
  ImportKeyword = 37,
  LabelledStmt = 38,
  MethodDecl = 39,
  NewExpr = 40,
  NullLiteralExpr = 41,
  NumberLiteralExpr = 42,
  ObjectBinding = 43,
  ObjectLiteralExpr = 44,
  OmittedExpr = 45,
  ParameterDecl = 46,
  ParenthesizedExpr = 47,
  PostfixUnaryExpr = 48,
  PrivateIdentifier = 49,
  PromiseArrayExpr = 50,
  PromiseExpr = 51,
  PropAccessExpr = 52,
  PropAssignExpr = 53,
  PropDecl = 54,
  ReferenceExpr = 55,
  RegexExpr = 56,
  ReturnStmt = 57,
  SetAccessorDecl = 58,
  SpreadAssignExpr = 59,
  SpreadElementExpr = 60,
  StringLiteralExpr = 61,
  SuperKeyword = 62,
  SwitchStmt = 63,
  TaggedTemplateExpr = 64,
  TemplateExpr = 65,
  ThisExpr = 66,
  ThrowStmt = 67,
  TryStmt = 68,
  TypeOfExpr = 69,
  UnaryExpr = 70,
  UndefinedLiteralExpr = 71,
  VariableDecl = 72,
  VariableDeclList = 73,
  VariableStmt = 74,
  VoidExpr = 75,
  WhileStmt = 76,
  WithStmt = 77,
  YieldExpr = 78,
  QuasiString = 79,
}

export namespace NodeKind {
  export const BindingPattern = [
    NodeKind.ObjectBinding,
    NodeKind.ArrayBinding,
  ] as const;

  export const BindingNames = [
    NodeKind.Identifier,
    NodeKind.ReferenceExpr,
    ...NodeKind.BindingPattern,
  ];

  export const ClassMember = [
    NodeKind.ClassStaticBlockDecl,
    NodeKind.ConstructorDecl,
    NodeKind.GetAccessorDecl,
    NodeKind.MethodDecl,
    NodeKind.PropDecl,
    NodeKind.SetAccessorDecl,
  ] as const;

  export const ObjectElementExpr = [
    NodeKind.GetAccessorDecl,
    NodeKind.MethodDecl,
    NodeKind.PropAssignExpr,
    NodeKind.SetAccessorDecl,
    NodeKind.SpreadAssignExpr,
  ];

  export const PropName = [
    NodeKind.Identifier,
    NodeKind.PrivateIdentifier,
    NodeKind.ComputedPropertyNameExpr,
    NodeKind.StringLiteralExpr,
    NodeKind.NumberLiteralExpr,
  ];

  export const SwitchClause = [NodeKind.CaseClause, NodeKind.DefaultClause];
}

export type NodeKindName<Kind extends NodeKind> = typeof NodeKindNames[Kind];

const NodeKindNames: {
  [name in keyof typeof NodeKind as Extract<
    typeof NodeKind[name],
    number
  >]: name;
} = Object.fromEntries(
  Object.entries(NodeKind).flatMap(([name, kind]) =>
    typeof kind === "number" ? [[kind, name]] : []
  )
) as any;

export function getNodeKindName<Kind extends NodeKind>(kind: Kind) {
  return NodeKindNames[kind];
}
