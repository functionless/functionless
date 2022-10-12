export { assertConstantValue, assertNodeKind, assertPrimitive } from "./assert";
export { BindFunctionName, RegisterFunctionName } from "./constants";
export {
  ArrayBinding,
  BindingElem,
  BindingName,
  BindingPattern,
  ClassDecl,
  ClassMember,
  ClassStaticBlockDecl,
  ConstructorDecl,
  Decl,
  FunctionDecl,
  FunctionLike,
  GetAccessorDecl,
  MethodDecl,
  ObjectBinding,
  ParameterDecl,
  PropDecl,
  SetAccessorDecl,
  SingleEntryVariableDeclList,
  VariableDecl,
  VariableDeclKind,
  VariableDeclList,
  VariableDeclListParent,
  VariableDeclParent,
} from "./declaration";
export {
  Assertion,
  AssertionToInstance,
  ensure,
  ensureArrayOf,
} from "./ensure";
export { Err } from "./error";
export {
  Argument,
  ArithmeticOp,
  ArrayLiteralExpr,
  ArrowFunctionExpr,
  AssignmentOp,
  AwaitExpr,
  BaseExpr,
  BigIntExpr,
  BinaryExpr,
  BinaryLogicalOp,
  BinaryOp,
  BitwiseBinaryOp,
  BitwiseShiftOp,
  BooleanLiteralExpr,
  CallExpr,
  ClassExpr,
  CommaOp,
  ComputedPropertyNameExpr,
  ConditionExpr,
  DeleteExpr,
  ElementAccessExpr,
  EqualityOp,
  Expr,
  FunctionExpr,
  Identifier,
  ImportKeyword,
  NewExpr,
  NoSubstitutionTemplateLiteralExpr,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectElementExpr,
  ObjectLiteralExpr,
  OmittedExpr,
  ParenthesizedExpr,
  PostfixUnaryExpr,
  PostfixUnaryOp,
  PrivateIdentifier,
  PropAccessExpr,
  PropAssignExpr,
  PropName,
  ReferenceExpr,
  RegexExpr,
  RelationalOp,
  SpreadAssignExpr,
  SpreadElementExpr,
  StringLiteralExpr,
  SuperKeyword,
  TaggedTemplateExpr,
  TemplateExpr,
  TemplateHead,
  TemplateLiteral,
  TemplateMiddle,
  TemplateSpan,
  TemplateTail,
  ThisExpr,
  TypeOfExpr,
  UnaryExpr,
  UnaryOp,
  UndefinedLiteralExpr,
  VariableReference,
  VoidExpr,
  YieldExpr,
} from "./expression";
export {
  CallReferencePattern,
  IntegrationCallPattern,
  findDeepReferences,
  getExprFromCallReferencePattern,
  isCallReferencePattern,
  isIntegrationCallExpr,
  tryFindIntegration,
  tryFindIntegrations,
  tryFindReference,
  tryFindReferences,
} from "./find";
export * from "./guards";
export * from "./literal";
export * from "./node-clone";
export {
  NodeCtor,
  NodeInstance,
  declarations,
  error,
  expressions,
  getCtor,
  keywords,
  nodes,
  statements,
} from "./node-ctor";
export { NodeKind, NodeKindName, getNodeKindName } from "./node-kind";
export { BaseNode, BindingDecl, FunctionlessNode, HasParent } from "./node";
export {
  BoundFunctionComponents,
  ProxyComponents,
  ReflectionSymbolNames,
  ReflectionSymbols,
  reflect,
  registerSubstitution,
  resolveSubstitution,
  reverseProxy,
  unbind,
  validateFunctionLike,
} from "./reflect";
export { tryResolveReferences } from "./resolve-references";
export { SExpr, parseSExpr } from "./s-expression";
export { Span, emptySpan, isSpan } from "./span";
export {
  BaseStmt,
  BlockStmt,
  BlockStmtParent,
  BreakStmt,
  CaseClause,
  CatchClause,
  ContinueStmt,
  DebuggerStmt,
  DefaultClause,
  DoStmt,
  EmptyStmt,
  ExprStmt,
  FinallyBlock,
  ForInStmt,
  ForOfStmt,
  ForStmt,
  IfStmt,
  LabelledStmt,
  ReturnStmt,
  Stmt,
  SwitchClause,
  SwitchStmt,
  ThrowStmt,
  TryStmt,
  VariableStmt,
  WhileStmt,
  WithStmt,
} from "./statement";
export {
  AnyAsyncFunction,
  AnyClass,
  AnyDepthArray,
  AnyFunction,
  Constant,
  ConstantValue,
  DeterministicNameGenerator,
  PrimitiveValue,
  UniqueNameGenerator,
  anyOf,
  evalToConstant,
  flatten,
  hasOnlyAncestors,
  hasParent,
  invertBinaryOperator,
  isAnyFunction,
  isConstant,
  isInTopLevelScope,
  isPrimitive,
  isPromiseAll,
  memoize,
} from "./util";
export {
  forEachChild,
  visitBlock,
  visitEachChild,
  visitSpecificChildren,
} from "./visit";

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
