import type {
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
  Kind extends FunctionlessNode["kind"],
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
> extends BaseExpr<"ArrowFunctionExpr"> {
  readonly _functionBrand?: F;
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super("ArrowFunctionExpr", arguments);
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
> extends BaseExpr<"FunctionExpr"> {
  readonly _functionBrand?: F;
  constructor(
    readonly name: string | undefined,
    readonly parameters: ParameterDecl[],
    readonly body: BlockStmt
  ) {
    super("FunctionExpr", arguments);
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
  "ClassExpr",
  undefined
> {
  readonly _classBrand?: C;
  constructor(
    readonly name: string | undefined,
    readonly heritage: Expr | undefined,
    readonly members: ClassMember[]
  ) {
    super("ClassExpr", arguments);
  }
  public clone(): this {
    return new ClassExpr(
      this.name,
      this.heritage?.clone(),
      this.members.map((m) => m.clone())
    ) as this;
  }
}

export class ReferenceExpr<R = unknown> extends BaseExpr<"ReferenceExpr"> {
  constructor(readonly name: string, readonly ref: () => R) {
    super("ReferenceExpr", arguments);
  }

  public clone(): this {
    return new ReferenceExpr(this.name, this.ref) as this;
  }
}

export type VariableReference = Identifier | PropAccessExpr | ElementAccessExpr;

export class Identifier extends BaseExpr<"Identifier"> {
  constructor(readonly name: string) {
    super("Identifier", arguments);
  }

  public clone(): this {
    return new Identifier(this.name) as this;
  }

  public lookup(): Decl | undefined {
    return this.getLexicalScope().get(this.name);
  }
}

export class PrivateIdentifier extends BaseExpr<"PrivateIdentifier"> {
  constructor(readonly name: `#${string}`) {
    super("PrivateIdentifier", arguments);
  }

  public clone(): this {
    return new PrivateIdentifier(this.name) as this;
  }

  public lookup(): Decl | undefined {
    return this.getLexicalScope().get(this.name);
  }
}

export class PropAccessExpr extends BaseExpr<"PropAccessExpr"> {
  constructor(
    readonly expr: Expr,
    readonly name: Identifier | PrivateIdentifier,
    readonly isOptional: boolean
  ) {
    super("PropAccessExpr", arguments);
  }

  public clone(): this {
    return new PropAccessExpr(
      this.expr.clone(),
      this.name.clone(),
      this.isOptional
    ) as this;
  }
}

export class ElementAccessExpr extends BaseExpr<"ElementAccessExpr"> {
  constructor(readonly expr: Expr, readonly element: Expr) {
    super("ElementAccessExpr", arguments);
  }

  public clone(): this {
    return new ElementAccessExpr(
      this.expr.clone(),
      this.element.clone()
    ) as this;
  }
}

export class Argument extends BaseExpr<"Argument", CallExpr | NewExpr> {
  constructor(readonly expr?: Expr) {
    super("Argument", arguments);
  }

  public clone(): this {
    return new Argument(this.expr?.clone()) as this;
  }
}

export class CallExpr extends BaseExpr<"CallExpr"> {
  constructor(
    readonly expr: Expr | SuperKeyword | ImportKeyword,
    readonly args: Argument[]
  ) {
    super("CallExpr", arguments);
  }

  public clone(): this {
    return new CallExpr(
      this.expr.clone(),
      this.args.map((arg) => arg.clone())
    ) as this;
  }
}

export class NewExpr extends BaseExpr<"NewExpr"> {
  constructor(readonly expr: Expr, readonly args: Argument[]) {
    super("NewExpr", arguments);
    for (const arg of Object.values(args)) {
      if (arg) {
      }
    }
  }

  public clone(): this {
    return new NewExpr(
      this.expr.clone(),
      this.args.map((arg) => arg.clone())
    ) as this;
  }
}

export class ConditionExpr extends BaseExpr<"ConditionExpr"> {
  constructor(readonly when: Expr, readonly then: Expr, readonly _else: Expr) {
    super("ConditionExpr", arguments);
    if (_else) {
    }
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

export class BinaryExpr extends BaseExpr<"BinaryExpr"> {
  constructor(
    readonly left: Expr,
    readonly op: BinaryOp,
    readonly right: Expr
  ) {
    super("BinaryExpr", arguments);
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

export class UnaryExpr extends BaseExpr<"UnaryExpr"> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super("UnaryExpr", arguments);
  }

  public clone(): this {
    return new UnaryExpr(this.op, this.expr.clone()) as this;
  }
}

export class PostfixUnaryExpr extends BaseExpr<"PostfixUnaryExpr"> {
  constructor(readonly op: PostfixUnaryOp, readonly expr: Expr) {
    super("PostfixUnaryExpr", arguments);
  }

  public clone(): this {
    return new PostfixUnaryExpr(this.op, this.expr.clone()) as this;
  }
}

// literals

export class NullLiteralExpr extends BaseExpr<"NullLiteralExpr"> {
  readonly value = null;
  constructor() {
    super("NullLiteralExpr", arguments);
  }

  public clone(): this {
    return new NullLiteralExpr() as this;
  }
}

export class UndefinedLiteralExpr extends BaseExpr<"UndefinedLiteralExpr"> {
  readonly value = undefined;

  constructor() {
    super("UndefinedLiteralExpr", arguments);
  }

  public clone(): this {
    return new UndefinedLiteralExpr() as this;
  }
}

export class BooleanLiteralExpr extends BaseExpr<"BooleanLiteralExpr"> {
  constructor(readonly value: boolean) {
    super("BooleanLiteralExpr", arguments);
  }

  public clone(): this {
    return new BooleanLiteralExpr(this.value) as this;
  }
}

export class BigIntExpr extends BaseExpr<"BigIntExpr"> {
  constructor(readonly value: bigint) {
    super("BigIntExpr", arguments);
  }

  public clone(): this {
    return new BigIntExpr(this.value) as this;
  }
}

export class NumberLiteralExpr extends BaseExpr<"NumberLiteralExpr"> {
  constructor(readonly value: number) {
    super("NumberLiteralExpr", arguments);
  }

  public clone(): this {
    return new NumberLiteralExpr(this.value) as this;
  }
}

export class StringLiteralExpr extends BaseExpr<"StringLiteralExpr"> {
  constructor(readonly value: string) {
    super("StringLiteralExpr", arguments);
  }

  public clone(): this {
    return new StringLiteralExpr(this.value) as this;
  }
}

export class ArrayLiteralExpr extends BaseExpr<"ArrayLiteralExpr"> {
  constructor(readonly items: Expr[]) {
    super("ArrayLiteralExpr", arguments);
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

export class ObjectLiteralExpr extends BaseExpr<"ObjectLiteralExpr"> {
  constructor(readonly properties: ObjectElementExpr[]) {
    super("ObjectLiteralExpr", arguments);
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

export class PropAssignExpr extends BaseExpr<
  "PropAssignExpr",
  ObjectLiteralExpr
> {
  constructor(readonly name: PropName, readonly expr: Expr) {
    super("PropAssignExpr", arguments);
  }

  public clone(): this {
    return new PropAssignExpr(this.name.clone(), this.expr.clone()) as this;
  }
}

export class ComputedPropertyNameExpr extends BaseExpr<
  "ComputedPropertyNameExpr",
  PropAssignExpr
> {
  constructor(readonly expr: Expr) {
    super("ComputedPropertyNameExpr", arguments);
  }

  public clone(): this {
    return new ComputedPropertyNameExpr(this.expr.clone()) as this;
  }
}

export class SpreadAssignExpr extends BaseExpr<
  "SpreadAssignExpr",
  ObjectLiteralExpr
> {
  constructor(readonly expr: Expr) {
    super("SpreadAssignExpr", arguments);
  }

  public clone(): this {
    return new SpreadAssignExpr(this.expr.clone()) as this;
  }
}

export class SpreadElementExpr extends BaseExpr<
  "SpreadElementExpr",
  ObjectLiteralExpr
> {
  constructor(readonly expr: Expr) {
    super("SpreadElementExpr", arguments);
  }

  public clone(): this {
    return new SpreadElementExpr(this.expr.clone()) as this;
  }
}

/**
 * Interpolates a TemplateExpr to a string `this ${is} a template expression`
 */
export class TemplateExpr extends BaseExpr<"TemplateExpr"> {
  constructor(readonly exprs: Expr[]) {
    super("TemplateExpr", arguments);
  }

  public clone(): this {
    return new TemplateExpr(this.exprs.map((expr) => expr.clone())) as this;
  }
}

export class TaggedTemplateExpr extends BaseExpr<"TaggedTemplateExpr"> {
  constructor(readonly tag: Expr, readonly exprs: Expr[]) {
    super("TaggedTemplateExpr", arguments);
  }

  public clone(): this {
    return new TaggedTemplateExpr(
      this.tag.clone(),
      this.exprs.map((expr) => expr.clone())
    ) as this;
  }
}

export class TypeOfExpr extends BaseExpr<"TypeOfExpr"> {
  constructor(readonly expr: Expr) {
    super("TypeOfExpr", arguments);
  }

  public clone(): this {
    return new TypeOfExpr(this.expr.clone()) as this;
  }
}

export class AwaitExpr extends BaseExpr<"AwaitExpr"> {
  constructor(readonly expr: Expr) {
    super("AwaitExpr", arguments);
  }

  public clone(): this {
    return new AwaitExpr(this.expr.clone()) as this;
  }
}

export class PromiseExpr extends BaseExpr<"PromiseExpr"> {
  constructor(readonly expr: Expr) {
    super("PromiseExpr", arguments);
  }

  public clone(): this {
    return new PromiseExpr(this.expr.clone()) as this;
  }
}

export class PromiseArrayExpr extends BaseExpr<"PromiseArrayExpr"> {
  constructor(readonly expr: Expr) {
    super("PromiseArrayExpr", arguments);
  }

  public clone(): this {
    return new PromiseArrayExpr(this.expr.clone()) as this;
  }
}

export class ThisExpr<T = any> extends BaseExpr<"ThisExpr"> {
  constructor(
    /**
     * Produce the value of `this`
     */
    readonly ref: () => T
  ) {
    super("ThisExpr", arguments);
  }
  public clone(): this {
    return new ThisExpr(this.ref) as this;
  }
}

export class SuperKeyword extends BaseNode<"SuperKeyword"> {
  // `super` is not an expression - a reference to it does not yield a value
  // it only supports the following interactions
  // 1. call in a constructor - `super(..)`
  // 2. call a method on it - `super.method(..)`.
  readonly nodeKind = "Node";
  constructor() {
    super("SuperKeyword", arguments);
  }
  public clone(): this {
    return new SuperKeyword() as this;
  }
}

export class ImportKeyword extends BaseNode<"ImportKeyword"> {
  readonly nodeKind = "Node";
  constructor() {
    super("ImportKeyword", arguments);
  }
  public clone(): this {
    return new ImportKeyword() as this;
  }
}

export class YieldExpr extends BaseExpr<"YieldExpr"> {
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
    super("YieldExpr", arguments);
  }
  public clone(): this {
    return new YieldExpr(this.expr?.clone(), this.delegate) as this;
  }
}

export class RegexExpr extends BaseExpr<"RegexExpr"> {
  constructor(readonly regex: RegExp) {
    super("RegexExpr", arguments);
  }

  public clone(): this {
    return new RegexExpr(this.regex) as this;
  }
}

export class VoidExpr extends BaseExpr<"VoidExpr"> {
  constructor(
    /**
     * The expression to yield (or delegate) to.
     */
    readonly expr: Expr
  ) {
    super("VoidExpr", arguments);
  }
  public clone(): this {
    return new VoidExpr(this.expr?.clone()) as this;
  }
}

export class DeleteExpr extends BaseExpr<"DeleteExpr"> {
  constructor(readonly expr: PropAccessExpr | ElementAccessExpr) {
    super("DeleteExpr", arguments);
  }
  public clone(): this {
    return new DeleteExpr(this.expr?.clone()) as this;
  }
}

export class ParenthesizedExpr extends BaseExpr<"ParenthesizedExpr"> {
  constructor(readonly expr: Expr) {
    super("ParenthesizedExpr", arguments);
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

export class OmittedExpr extends BaseExpr<"OmittedExpr"> {
  constructor() {
    super("OmittedExpr", arguments);
  }
  public clone(): this {
    return new OmittedExpr() as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
