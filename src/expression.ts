import {
  BindingElem,
  ClassMember,
  Decl,
  GetAccessorDecl,
  MethodDecl,
  ParameterDecl,
  SetAccessorDecl,
  VariableDecl,
} from "./declaration";
import {
  isIdentifier,
  isNumberLiteralExpr,
  isParenthesizedExpr,
  isPrivateIdentifier,
  isPropAssignExpr,
  isStringLiteralExpr,
} from "./guards";
import { BaseNode, FunctionlessNode } from "./node";
import { NodeKind } from "./node-kind";
import type { BlockStmt, Stmt } from "./statement";
import type { AnyClass, AnyFunction } from "./util";

/**
 * An {@link Expr} (Expression) is a Node that will be interpreted to a value.
 */
export type Expr =
  | Argument
  | ArrayLiteralExpr
  | ArrowFunctionExpr
  | AwaitExpr
  | BigIntExpr
  | BinaryExpr
  | BooleanLiteralExpr
  | CallExpr
  | ClassExpr
  | ComputedPropertyNameExpr
  | ConditionExpr
  | DeleteExpr
  | ElementAccessExpr
  | FunctionExpr
  | Identifier
  | NewExpr
  | NullLiteralExpr
  | NumberLiteralExpr
  | ObjectLiteralExpr
  | OmittedExpr
  | ParenthesizedExpr
  | PostfixUnaryExpr
  | PrivateIdentifier
  | PromiseArrayExpr
  | PromiseExpr
  | PropAccessExpr
  | PropAssignExpr
  | ReferenceExpr
  | RegexExpr
  | SpreadAssignExpr
  | SpreadElementExpr
  | StringLiteralExpr
  | TaggedTemplateExpr
  | TemplateExpr
  | ThisExpr
  | TypeOfExpr
  | UnaryExpr
  | UndefinedLiteralExpr
  | VoidExpr
  | YieldExpr;

export abstract class BaseExpr<
  Kind extends NodeKind,
  Parent extends FunctionlessNode | undefined =
    | BindingElem
    | Expr
    | Stmt
    | VariableDecl
    | undefined
> extends BaseNode<Kind, Parent> {
  readonly nodeKind: "Expr" = "Expr";
}

export class ArrowFunctionExpr<
  F extends AnyFunction = AnyFunction
> extends BaseExpr<NodeKind.ArrowFunctionExpr> {
  readonly _functionBrand?: F;
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super(NodeKind.ArrowFunctionExpr, arguments);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
  }

  public clone(): this {
    return new ArrowFunctionExpr(
      this.parameters.map((p) => p.clone()),
      this.body.clone()
    ) as this;
  }
}

export class FunctionExpr<
  F extends AnyFunction = AnyFunction
> extends BaseExpr<NodeKind.FunctionExpr> {
  readonly _functionBrand?: F;
  constructor(
    readonly name: string | undefined,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt
  ) {
    super(NodeKind.FunctionExpr, arguments);
    this.ensure(name, "name", ["undefined", "string"]);
    this.ensureArrayOf(parameters, "parameters", [NodeKind.ParameterDecl]);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
  }

  public clone(): this {
    return new FunctionExpr(
      this.name,
      this.parameters.map((p) => p.clone()),
      this.body.clone()
    ) as this;
  }
}

export class ClassExpr<C extends AnyClass = AnyClass> extends BaseExpr<
  NodeKind.ClassExpr,
  undefined
> {
  readonly _classBrand?: C;
  constructor(
    readonly name: string | undefined,
    readonly heritage: Expr | undefined,
    readonly members: ClassMember[]
  ) {
    super(NodeKind.ClassExpr, arguments);
    this.ensure(name, "name", ["undefined", "string"]);
    this.ensure(heritage, "heritage", ["undefined", "Expr"]);
    this.ensureArrayOf(members, "members", ClassMember.Kinds);
  }
  public clone(): this {
    return new ClassExpr(
      this.name,
      this.heritage?.clone(),
      this.members.map((m) => m.clone())
    ) as this;
  }
}

export class ReferenceExpr<
  R = unknown
> extends BaseExpr<NodeKind.ReferenceExpr> {
  constructor(readonly name: string, readonly ref: () => R) {
    super(NodeKind.ReferenceExpr, arguments);
    this.ensure(name, "name", ["undefined", "string"]);
    this.ensure(ref, "ref", ["function"]);
  }

  public clone(): this {
    return new ReferenceExpr(this.name, this.ref) as this;
  }
}

export type VariableReference = Identifier | PropAccessExpr | ElementAccessExpr;

export class Identifier extends BaseExpr<NodeKind.Identifier> {
  constructor(readonly name: string) {
    super(NodeKind.Identifier, arguments);
    this.ensure(name, "name", ["string"]);
  }

  public clone(): this {
    return new Identifier(this.name) as this;
  }

  public lookup(): Decl | undefined {
    return this.getLexicalScope().get(this.name);
  }
}

export class PrivateIdentifier extends BaseExpr<NodeKind.PrivateIdentifier> {
  constructor(readonly name: `#${string}`) {
    super(NodeKind.PrivateIdentifier, arguments);
    this.ensure(name, "name", ["string"]);
  }

  public clone(): this {
    return new PrivateIdentifier(this.name) as this;
  }

  public lookup(): Decl | undefined {
    return this.getLexicalScope().get(this.name);
  }
}

export class PropAccessExpr extends BaseExpr<NodeKind.PropAccessExpr> {
  constructor(
    readonly expr: Expr,
    readonly name: Identifier | PrivateIdentifier,
    readonly isOptional: boolean
  ) {
    super(NodeKind.PropAccessExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensure(name, "ref", [NodeKind.Identifier, NodeKind.PrivateIdentifier]);
  }

  public clone(): this {
    return new PropAccessExpr(
      this.expr.clone(),
      this.name.clone(),
      this.isOptional
    ) as this;
  }
}

export class ElementAccessExpr extends BaseExpr<NodeKind.ElementAccessExpr> {
  constructor(readonly expr: Expr, readonly element: Expr) {
    super(NodeKind.ElementAccessExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensure(element, "element", ["Expr"]);
  }

  public clone(): this {
    return new ElementAccessExpr(
      this.expr.clone(),
      this.element.clone()
    ) as this;
  }
}

export class Argument extends BaseExpr<NodeKind.Argument, CallExpr | NewExpr> {
  constructor(readonly expr?: Expr) {
    super(NodeKind.Argument, arguments);
    this.ensure(expr, "element", ["undefined", "Expr"]);
  }

  public clone(): this {
    return new Argument(this.expr?.clone()) as this;
  }
}

export class CallExpr extends BaseExpr<NodeKind.CallExpr> {
  constructor(
    readonly expr: Expr | SuperKeyword | ImportKeyword,
    readonly args: Argument[]
  ) {
    super(NodeKind.CallExpr, arguments);
  }

  public clone(): this {
    return new CallExpr(
      this.expr.clone(),
      this.args.map((arg) => arg.clone())
    ) as this;
  }
}

export class NewExpr extends BaseExpr<NodeKind.NewExpr> {
  constructor(readonly expr: Expr, readonly args: Argument[]) {
    super(NodeKind.NewExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensureArrayOf(args, "args", [NodeKind.Argument]);
  }

  public clone(): this {
    return new NewExpr(
      this.expr.clone(),
      this.args.map((arg) => arg.clone())
    ) as this;
  }
}

export class ConditionExpr extends BaseExpr<NodeKind.ConditionExpr> {
  constructor(readonly when: Expr, readonly then: Expr, readonly _else: Expr) {
    super(NodeKind.ConditionExpr, arguments);
    this.ensure(when, "when", ["Expr"]);
    this.ensure(then, "then", ["Expr"]);
    this.ensure(_else, "else", ["Expr"]);
  }

  public clone(): this {
    return new ConditionExpr(
      this.when.clone(),
      this.then.clone(),
      this._else.clone()
    ) as this;
  }
}

export type ValueComparisonBinaryOp = "==" | "!=" | "<" | "<=" | ">" | ">=";
export type MathBinaryOp = "/" | "*" | "+" | "-" | "%";
export type MutationMathBinaryOp = "+=" | "*=" | "-=" | "/=" | "%=";
export type ComparatorOp = "&&" | "||" | "??";

export type BinaryOp =
  | MathBinaryOp
  | MutationMathBinaryOp
  | ValueComparisonBinaryOp
  | ComparatorOp
  | ","
  | "="
  | "in";

export class BinaryExpr extends BaseExpr<NodeKind.BinaryExpr> {
  constructor(
    readonly left: Expr,
    readonly op: BinaryOp,
    readonly right: Expr
  ) {
    super(NodeKind.BinaryExpr, arguments);
    this.ensure(left, "left", ["Expr"]);
    this.ensure(right, "right", ["Expr"]);
  }

  public clone(): this {
    return new BinaryExpr(
      this.left.clone(),
      this.op,
      this.right.clone()
    ) as this;
  }
}

export type PostfixUnaryOp = "--" | "++";
export type UnaryOp = "!" | "-" | "~" | PostfixUnaryOp;

export class UnaryExpr extends BaseExpr<NodeKind.UnaryExpr> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super(NodeKind.UnaryExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new UnaryExpr(this.op, this.expr.clone()) as this;
  }
}

export class PostfixUnaryExpr extends BaseExpr<NodeKind.PostfixUnaryExpr> {
  constructor(readonly op: PostfixUnaryOp, readonly expr: Expr) {
    super(NodeKind.PostfixUnaryExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new PostfixUnaryExpr(this.op, this.expr.clone()) as this;
  }
}

// literals

export class NullLiteralExpr extends BaseExpr<NodeKind.NullLiteralExpr> {
  readonly value = null;
  constructor() {
    super(NodeKind.NullLiteralExpr, arguments);
  }

  public clone(): this {
    return new NullLiteralExpr() as this;
  }
}

export class UndefinedLiteralExpr extends BaseExpr<NodeKind.UndefinedLiteralExpr> {
  readonly value = undefined;

  constructor() {
    super(NodeKind.UndefinedLiteralExpr, arguments);
  }

  public clone(): this {
    return new UndefinedLiteralExpr() as this;
  }
}

export class BooleanLiteralExpr extends BaseExpr<NodeKind.BooleanLiteralExpr> {
  constructor(readonly value: boolean) {
    super(NodeKind.BooleanLiteralExpr, arguments);
    this.ensure(value, "value", ["boolean"]);
  }

  public clone(): this {
    return new BooleanLiteralExpr(this.value) as this;
  }
}

export class BigIntExpr extends BaseExpr<NodeKind.BigIntExpr> {
  constructor(readonly value: bigint) {
    super(NodeKind.BigIntExpr, arguments);
    this.ensure(value, "value", ["bigint"]);
  }

  public clone(): this {
    return new BigIntExpr(this.value) as this;
  }
}

export class NumberLiteralExpr extends BaseExpr<NodeKind.NumberLiteralExpr> {
  constructor(readonly value: number) {
    super(NodeKind.NumberLiteralExpr, arguments);
    this.ensure(value, "value", ["number"]);
  }

  public clone(): this {
    return new NumberLiteralExpr(this.value) as this;
  }
}

export class StringLiteralExpr extends BaseExpr<NodeKind.StringLiteralExpr> {
  constructor(readonly value: string) {
    super(NodeKind.StringLiteralExpr, arguments);
    this.ensure(value, "value", ["string"]);
  }

  public clone(): this {
    return new StringLiteralExpr(this.value) as this;
  }
}

export class ArrayLiteralExpr extends BaseExpr<NodeKind.ArrayLiteralExpr> {
  constructor(readonly items: Expr[]) {
    super(NodeKind.ArrayLiteralExpr, arguments);
    this.ensureArrayOf(items, "items", ["Expr"]);
  }

  public clone(): this {
    return new ArrayLiteralExpr(this.items.map((item) => item.clone())) as this;
  }
}

export type ObjectElementExpr =
  | GetAccessorDecl
  | MethodDecl
  | PropAssignExpr
  | SetAccessorDecl
  | SpreadAssignExpr;

export namespace ObjectElementExpr {
  export const Kinds = [
    NodeKind.GetAccessorDecl,
    NodeKind.MethodDecl,
    NodeKind.PropAssignExpr,
    NodeKind.SetAccessorDecl,
    NodeKind.SpreadAssignExpr,
  ];
}

export class ObjectLiteralExpr extends BaseExpr<NodeKind.ObjectLiteralExpr> {
  constructor(readonly properties: ObjectElementExpr[]) {
    super(NodeKind.ObjectLiteralExpr, arguments);
    this.ensureArrayOf(properties, "properties", ObjectElementExpr.Kinds);
  }

  public clone(): this {
    return new ObjectLiteralExpr(
      this.properties.map((prop) => prop.clone())
    ) as this;
  }

  public getProperty(name: string) {
    return this.properties.find((prop) => {
      if (isPropAssignExpr(prop)) {
        if (isIdentifier(prop.name) || isPrivateIdentifier(prop.name)) {
          return prop.name.name === name;
        } else if (isStringLiteralExpr(prop.name)) {
          return prop.name.value === name;
        } else if (isNumberLiteralExpr(prop.name)) {
          // compare by string
          return prop.name.value.toString(10) === name;
        } else if (isStringLiteralExpr(prop.name.expr)) {
          return prop.name.expr.value === name;
        }
      }
      return false;
    });
  }
}

export type PropName =
  | Identifier
  | PrivateIdentifier
  | ComputedPropertyNameExpr
  | StringLiteralExpr
  | NumberLiteralExpr;

export namespace PropName {
  export const Kinds = [
    NodeKind.Identifier,
    NodeKind.PrivateIdentifier,
    NodeKind.ComputedPropertyNameExpr,
    NodeKind.StringLiteralExpr,
    NodeKind.NumberLiteralExpr,
  ];
}

export class PropAssignExpr extends BaseExpr<
  NodeKind.PropAssignExpr,
  ObjectLiteralExpr
> {
  constructor(readonly name: PropName, readonly expr: Expr) {
    super(NodeKind.PropAssignExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new PropAssignExpr(this.name.clone(), this.expr.clone()) as this;
  }
}

export class ComputedPropertyNameExpr extends BaseExpr<
  NodeKind.ComputedPropertyNameExpr,
  PropAssignExpr
> {
  constructor(readonly expr: Expr) {
    super(NodeKind.ComputedPropertyNameExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new ComputedPropertyNameExpr(this.expr.clone()) as this;
  }
}

export class SpreadAssignExpr extends BaseExpr<
  NodeKind.SpreadAssignExpr,
  ObjectLiteralExpr
> {
  constructor(readonly expr: Expr) {
    super(NodeKind.SpreadAssignExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new SpreadAssignExpr(this.expr.clone()) as this;
  }
}

export class SpreadElementExpr extends BaseExpr<
  NodeKind.SpreadElementExpr,
  ObjectLiteralExpr
> {
  constructor(readonly expr: Expr) {
    super(NodeKind.SpreadElementExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new SpreadElementExpr(this.expr.clone()) as this;
  }
}

/**
 * Interpolates a TemplateExpr to a string `this ${is} a template expression`
 */
export class TemplateExpr extends BaseExpr<NodeKind.TemplateExpr> {
  constructor(readonly exprs: Expr[]) {
    super(NodeKind.TemplateExpr, arguments);
    this.ensureArrayOf(exprs, "expr", ["Expr"]);
  }

  public clone(): this {
    return new TemplateExpr(this.exprs.map((expr) => expr.clone())) as this;
  }
}

export class TaggedTemplateExpr extends BaseExpr<NodeKind.TaggedTemplateExpr> {
  constructor(readonly tag: Expr, readonly exprs: Expr[]) {
    super(NodeKind.TaggedTemplateExpr, arguments);
    this.ensureArrayOf(exprs, "expr", ["Expr"]);
  }

  public clone(): this {
    return new TaggedTemplateExpr(
      this.tag.clone(),
      this.exprs.map((expr) => expr.clone())
    ) as this;
  }
}

export class TypeOfExpr extends BaseExpr<NodeKind.TypeOfExpr> {
  constructor(readonly expr: Expr) {
    super(NodeKind.TypeOfExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new TypeOfExpr(this.expr.clone()) as this;
  }
}

export class AwaitExpr extends BaseExpr<NodeKind.AwaitExpr> {
  constructor(readonly expr: Expr) {
    super(NodeKind.AwaitExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new AwaitExpr(this.expr.clone()) as this;
  }
}

export class PromiseExpr extends BaseExpr<NodeKind.PromiseExpr> {
  constructor(readonly expr: Expr) {
    super(NodeKind.PromiseExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new PromiseExpr(this.expr.clone()) as this;
  }
}

export class PromiseArrayExpr extends BaseExpr<NodeKind.PromiseArrayExpr> {
  constructor(readonly expr: Expr) {
    super(NodeKind.PromiseArrayExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new PromiseArrayExpr(this.expr.clone()) as this;
  }
}

export class ThisExpr<T = any> extends BaseExpr<NodeKind.ThisExpr> {
  constructor(
    /**
     * Produce the value of `this`
     */
    readonly ref: () => T
  ) {
    super(NodeKind.ThisExpr, arguments);
    this.ensure(ref, "ref", ["function"]);
  }
  public clone(): this {
    return new ThisExpr(this.ref) as this;
  }
}

export class SuperKeyword extends BaseNode<NodeKind.SuperKeyword> {
  // `super` is not an expression - a reference to it does not yield a value
  // it only supports the following interactions
  // 1. call in a constructor - `super(..)`
  // 2. call a method on it - `super.method(..)`.
  readonly nodeKind = "Node";
  constructor() {
    super(NodeKind.SuperKeyword, arguments);
  }
  public clone(): this {
    return new SuperKeyword() as this;
  }
}

export class ImportKeyword extends BaseNode<NodeKind.ImportKeyword> {
  readonly nodeKind = "Node";
  constructor() {
    super(NodeKind.ImportKeyword, arguments);
  }
  public clone(): this {
    return new ImportKeyword() as this;
  }
}

export class YieldExpr extends BaseExpr<NodeKind.YieldExpr> {
  constructor(
    /**
     * The expression to yield (or delegate) to.
     */
    readonly expr: Expr | undefined,
    /**
     * Is a `yield*` delegate expression.
     */
    readonly delegate: boolean
  ) {
    super(NodeKind.YieldExpr, arguments);
    this.ensure(expr, "expr", ["undefined", "Expr"]);
    this.ensure(delegate, "delegate", ["boolean"]);
  }
  public clone(): this {
    return new YieldExpr(this.expr?.clone(), this.delegate) as this;
  }
}

export class RegexExpr extends BaseExpr<NodeKind.RegexExpr> {
  constructor(readonly regex: RegExp) {
    super(NodeKind.RegexExpr, arguments);
  }

  public clone(): this {
    return new RegexExpr(this.regex) as this;
  }
}

export class VoidExpr extends BaseExpr<NodeKind.VoidExpr> {
  constructor(
    /**
     * The expression to yield (or delegate) to.
     */
    readonly expr: Expr
  ) {
    super(NodeKind.VoidExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
  public clone(): this {
    return new VoidExpr(this.expr?.clone()) as this;
  }
}

export class DeleteExpr extends BaseExpr<NodeKind.DeleteExpr> {
  constructor(readonly expr: PropAccessExpr | ElementAccessExpr) {
    super(NodeKind.DeleteExpr, arguments);
    this.ensure(expr, "expr", [
      NodeKind.PropAccessExpr,
      NodeKind.ElementAccessExpr,
    ]);
  }
  public clone(): this {
    return new DeleteExpr(this.expr?.clone()) as this;
  }
}

export class ParenthesizedExpr extends BaseExpr<NodeKind.ParenthesizedExpr> {
  constructor(readonly expr: Expr) {
    super(NodeKind.ParenthesizedExpr, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }

  public clone(): this {
    return new ParenthesizedExpr(this.expr.clone()) as this;
  }

  public unwrap(): Expr | undefined {
    if (isParenthesizedExpr(this.expr)) {
      return this.expr.unwrap();
    }
    return this.expr;
  }
}

export class OmittedExpr extends BaseExpr<NodeKind.OmittedExpr> {
  constructor() {
    super(NodeKind.OmittedExpr, arguments);
  }
  public clone(): this {
    return new OmittedExpr() as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
