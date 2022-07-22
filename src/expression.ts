import type {
  BindingElem,
  ClassMember,
  Decl,
  ParameterDecl,
  VariableDecl,
} from "./declaration";
import { isIdentifier, isPropAssignExpr, isStringLiteralExpr } from "./guards";
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
  | BinaryExpr
  | BooleanLiteralExpr
  | CallExpr
  | ClassExpr
  | ComputedPropertyNameExpr
  | ConditionExpr
  | ElementAccessExpr
  | FunctionExpr
  | Identifier
  | NewExpr
  | NullLiteralExpr
  | NumberLiteralExpr
  | ObjectLiteralExpr
  | PostfixUnaryExpr
  | PrivateIdentifier
  | PromiseArrayExpr
  | PromiseExpr
  | PropAccessExpr
  | PropAssignExpr
  | ReferenceExpr
  | SpreadAssignExpr
  | SpreadElementExpr
  | StringLiteralExpr
  | TemplateExpr
  | ThisExpr
  | TypeOfExpr
  | UnaryExpr
  | UndefinedLiteralExpr;

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
    super("ArrowFunctionExpr");
    parameters.forEach((param) => param.setParent(this));
    body.setParent(this);
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
    super("FunctionExpr");
    parameters.forEach((param) => param.setParent(this));
    body.setParent(this);
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
    super("ClassExpr");
    members.forEach((m) => m.setParent(this));
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
    super("ReferenceExpr");
  }

  public clone(): this {
    return new ReferenceExpr(this.name, this.ref) as this;
  }
}

export type VariableReference = Identifier | PropAccessExpr | ElementAccessExpr;

export class Identifier extends BaseExpr<"Identifier"> {
  constructor(readonly name: string) {
    super("Identifier");
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
    super("PrivateIdentifier");
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
    readonly name: string,
    readonly type?: string
  ) {
    super("PropAccessExpr");
    expr.setParent(this);
  }

  public clone(): this {
    return new PropAccessExpr(this.expr.clone(), this.name, this.type) as this;
  }
}

export class ElementAccessExpr extends BaseExpr<"ElementAccessExpr"> {
  constructor(
    readonly expr: Expr,
    readonly element: Expr,
    readonly type?: string
  ) {
    super("ElementAccessExpr");
    expr.setParent(this);
    element.setParent(this);
  }

  public clone(): this {
    return new ElementAccessExpr(
      this.expr.clone(),
      this.element.clone(),
      this.type
    ) as this;
  }
}

export class Argument extends BaseExpr<"Argument", CallExpr | NewExpr> {
  constructor(readonly expr?: Expr, readonly name?: string) {
    super("Argument");
    expr?.setParent(this);
  }

  public clone(): this {
    return new Argument(this.expr?.clone(), this.name) as this;
  }
}

export class CallExpr extends BaseExpr<"CallExpr"> {
  constructor(readonly expr: Expr, readonly args: Argument[]) {
    super("CallExpr");
    expr.setParent(this);
    args.forEach((arg) => arg.setParent(this));
  }

  public getArgument(name: string): Argument | undefined {
    return this.args.find((arg) => arg.name === name);
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
    super("NewExpr");
    expr.setParent(this);
    for (const arg of Object.values(args)) {
      if (arg) {
        arg.setParent(this);
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
    super("ConditionExpr");
    when.setParent(this);
    then.setParent(this);
    if (_else) {
      _else.setParent(this);
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
    super("BinaryExpr");
    left.setParent(this);
    right.setParent(this);
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
export type UnaryOp = "!" | "-" | PostfixUnaryOp;

export class UnaryExpr extends BaseExpr<"UnaryExpr"> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super("UnaryExpr");
    expr.setParent(this);
  }

  public clone(): this {
    return new UnaryExpr(this.op, this.expr.clone()) as this;
  }
}

export class PostfixUnaryExpr extends BaseExpr<"PostfixUnaryExpr"> {
  constructor(readonly op: PostfixUnaryOp, readonly expr: Expr) {
    super("PostfixUnaryExpr");
    expr.setParent(this);
  }

  public clone(): this {
    return new PostfixUnaryExpr(this.op, this.expr.clone()) as this;
  }
}

// literals

export class NullLiteralExpr extends BaseExpr<"NullLiteralExpr"> {
  readonly value = null;
  constructor() {
    super("NullLiteralExpr");
  }

  public clone(): this {
    return new NullLiteralExpr() as this;
  }
}

export class UndefinedLiteralExpr extends BaseExpr<"UndefinedLiteralExpr"> {
  readonly value = undefined;

  constructor() {
    super("UndefinedLiteralExpr");
  }

  public clone(): this {
    return new UndefinedLiteralExpr() as this;
  }
}

export class BooleanLiteralExpr extends BaseExpr<"BooleanLiteralExpr"> {
  constructor(readonly value: boolean) {
    super("BooleanLiteralExpr");
  }

  public clone(): this {
    return new BooleanLiteralExpr(this.value) as this;
  }
}

export class NumberLiteralExpr extends BaseExpr<"NumberLiteralExpr"> {
  constructor(readonly value: number) {
    super("NumberLiteralExpr");
  }

  public clone(): this {
    return new NumberLiteralExpr(this.value) as this;
  }
}

export class StringLiteralExpr extends BaseExpr<"StringLiteralExpr"> {
  constructor(readonly value: string) {
    super("StringLiteralExpr");
  }

  public clone(): this {
    return new StringLiteralExpr(this.value) as this;
  }
}

export class ArrayLiteralExpr extends BaseExpr<"ArrayLiteralExpr"> {
  constructor(readonly items: Expr[]) {
    super("ArrayLiteralExpr");
    items.forEach((item) => item.setParent(this));
  }

  public clone(): this {
    return new ArrayLiteralExpr(this.items.map((item) => item.clone())) as this;
  }
}

export type ObjectElementExpr = PropAssignExpr | SpreadAssignExpr;

export class ObjectLiteralExpr extends BaseExpr<"ObjectLiteralExpr"> {
  constructor(readonly properties: ObjectElementExpr[]) {
    super("ObjectLiteralExpr");
    properties.forEach((prop) => prop.setParent(this));
  }

  public clone(): this {
    return new ObjectLiteralExpr(
      this.properties.map((prop) => prop.clone())
    ) as this;
  }
  public getProperty(name: string) {
    return this.properties.find((prop) => {
      if (isPropAssignExpr(prop)) {
        if (isIdentifier(prop.name)) {
          return prop.name.name === name;
        } else if (isStringLiteralExpr(prop.name)) {
          return prop.name.value === name;
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
  | ComputedPropertyNameExpr
  | StringLiteralExpr;

export class PropAssignExpr extends BaseExpr<
  "PropAssignExpr",
  ObjectLiteralExpr
> {
  constructor(readonly name: PropName, readonly expr: Expr) {
    super("PropAssignExpr");
    name.setParent(this);
    expr.setParent(this);
  }

  /**
   * @returns the name of this property if it is statically known (an Identifier or StringLiteralExpr).
   */
  public tryGetName(): string | undefined {
    if (isIdentifier(this.name)) {
      return this.name.name;
    } else if (isStringLiteralExpr(this.name)) {
      return this.name.value;
    }
    return undefined;
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
    super("ComputedPropertyNameExpr");
    expr.setParent(this);
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
    super("SpreadAssignExpr");
    expr.setParent(this);
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
    super("SpreadElementExpr");
    expr.setParent(this);
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
    super("TemplateExpr");
    exprs.forEach((expr) => expr.setParent(this));
  }

  public clone(): this {
    return new TemplateExpr(this.exprs.map((expr) => expr.clone())) as this;
  }
}

export class TypeOfExpr extends BaseExpr<"TypeOfExpr"> {
  constructor(readonly expr: Expr) {
    super("TypeOfExpr");

    expr.setParent(this);
  }

  public clone(): this {
    return new TypeOfExpr(this.expr.clone()) as this;
  }
}

export class AwaitExpr extends BaseExpr<"AwaitExpr"> {
  constructor(readonly expr: Expr) {
    super("AwaitExpr");

    expr.setParent(this);
  }

  public clone(): this {
    return new AwaitExpr(this.expr.clone()) as this;
  }
}

export class PromiseExpr extends BaseExpr<"PromiseExpr"> {
  constructor(readonly expr: Expr) {
    super("PromiseExpr");

    expr.setParent(this);
  }

  public clone(): this {
    return new PromiseExpr(this.expr.clone()) as this;
  }
}

export class PromiseArrayExpr extends BaseExpr<"PromiseArrayExpr"> {
  constructor(readonly expr: Expr) {
    super("PromiseArrayExpr");

    expr.setParent(this);
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
    super("ThisExpr");
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
    super("SuperKeyword");
  }
  public clone(): this {
    return new SuperKeyword() as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
