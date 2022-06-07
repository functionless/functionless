import { $AWS } from "./aws";
import { ParameterDecl } from "./declaration";
import { AnyLambda } from "./function";
import { BaseNode, FunctionlessNode, isNode, typeGuard } from "./node";
import type {
  BlockStmt,
  ExprStmt,
  ReturnStmt,
  VariableStmt,
} from "./statement";
import { AnyStepFunction } from "./step-function";
import { AnyTable } from "./table";
import { AnyFunction } from "./util";

/**
 * An {@link Expr} (Expression) is a Node that will be interpreted to a value.
 */
export type Expr =
  | Argument
  | ArrayLiteralExpr
  | AwaitExpr
  | BinaryExpr
  | BooleanLiteralExpr
  | CallExpr
  | ConditionExpr
  | ComputedPropertyNameExpr
  | ElementAccessExpr
  | FunctionExpr
  | Identifier
  | NewExpr
  | NullLiteralExpr
  | NumberLiteralExpr
  | ObjectLiteralExpr
  | PropAccessExpr
  | PropAssignExpr
  | ReferenceExpr
  | SpreadAssignExpr
  | SpreadElementExpr
  | StringLiteralExpr
  | TemplateExpr
  | TypeOfExpr
  | UnaryExpr
  | UndefinedLiteralExpr;

export function isExpr(a: any): a is Expr {
  return (
    isNode(a) &&
    (isArgument(a) ||
      isArrayLiteralExpr(a) ||
      isAwaitExpr(a) ||
      isBinaryExpr(a) ||
      isBooleanLiteral(a) ||
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

export abstract class BaseExpr<
  Kind extends FunctionlessNode["kind"],
  Parent extends FunctionlessNode | undefined =
    | ExprStmt
    | VariableStmt
    | ReturnStmt
    | Expr
    | undefined
> extends BaseNode<Kind, Parent> {
  readonly nodeKind: "Expr" = "Expr";
}

export const isFunctionExpr = typeGuard("FunctionExpr");

export class FunctionExpr<
  F extends AnyFunction = AnyFunction
> extends BaseExpr<"FunctionExpr"> {
  readonly _functionBrand?: F;
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super("FunctionExpr");
    parameters.forEach((param) => param.setParent(this));
    body.setParent(this);
  }

  public clone(): this {
    return new FunctionExpr(
      this.parameters.map((p) => p.clone()),
      this.body.clone()
    ) as this;
  }
}

export const isReferenceExpr = typeGuard("ReferenceExpr");

export type CanReference =
  | AnyTable
  | AnyLambda
  | AnyStepFunction
  | typeof $AWS
  | unknown;

export class ReferenceExpr extends BaseExpr<"ReferenceExpr"> {
  constructor(readonly name: string, readonly ref: () => CanReference) {
    super("ReferenceExpr");
  }

  public clone(): this {
    return new ReferenceExpr(this.name, this.ref) as this;
  }
}

export type VariableReference = Identifier | PropAccessExpr | ElementAccessExpr;

export function isVariableReference(expr: Expr): expr is VariableReference {
  return (
    isIdentifier(expr) || isPropAccessExpr(expr) || isElementAccessExpr(expr)
  );
}

export const isIdentifier = typeGuard("Identifier");

export class Identifier extends BaseExpr<"Identifier"> {
  constructor(readonly name: string) {
    super("Identifier");
  }

  public clone(): this {
    return new Identifier(this.name) as this;
  }

  public lookup(): VariableStmt | ParameterDecl | undefined {
    return this.getLexicalScope().get(this.name);
  }
}

export const isPropAccessExpr = typeGuard("PropAccessExpr");

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

export const isElementAccessExpr = typeGuard("ElementAccessExpr");

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

export const isArgument = typeGuard("Argument");

export class Argument extends BaseExpr<"Argument", CallExpr | NewExpr> {
  constructor(readonly expr?: Expr, readonly name?: string) {
    super("Argument");
    expr?.setParent(this);
  }

  public clone(): this {
    return new Argument(this.expr?.clone(), this.name) as this;
  }
}

export const isCallExpr = typeGuard("CallExpr");

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

export const isNewExpr = typeGuard("NewExpr");

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

export const isConditionExpr = typeGuard("ConditionExpr");

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

export const isBinaryExpr = typeGuard("BinaryExpr");

export type BinaryOp =
  | "="
  | "/"
  | "*"
  | "+"
  | "-"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "&&"
  | "||"
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

export const isUnaryExpr = typeGuard("UnaryExpr");

export type UnaryOp = "!" | "-";

export class UnaryExpr extends BaseExpr<"UnaryExpr"> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super("UnaryExpr");
    expr.setParent(this);
  }

  public clone(): this {
    return new UnaryExpr(this.op, this.expr.clone()) as this;
  }
}

// literals

export const isNullLiteralExpr = typeGuard("NullLiteralExpr");

export class NullLiteralExpr extends BaseExpr<"NullLiteralExpr"> {
  readonly value = null;
  constructor() {
    super("NullLiteralExpr");
  }

  public clone(): this {
    return new NullLiteralExpr() as this;
  }
}

export const isUndefinedLiteralExpr = typeGuard("UndefinedLiteralExpr");

export class UndefinedLiteralExpr extends BaseExpr<"UndefinedLiteralExpr"> {
  readonly value = undefined;

  constructor() {
    super("UndefinedLiteralExpr");
  }

  public clone(): this {
    return new UndefinedLiteralExpr() as this;
  }
}

export const isBooleanLiteral = typeGuard("BooleanLiteralExpr");

export class BooleanLiteralExpr extends BaseExpr<"BooleanLiteralExpr"> {
  constructor(readonly value: boolean) {
    super("BooleanLiteralExpr");
  }

  public clone(): this {
    return new BooleanLiteralExpr(this.value) as this;
  }
}

export const isNumberLiteralExpr = typeGuard("NumberLiteralExpr");

export class NumberLiteralExpr extends BaseExpr<"NumberLiteralExpr"> {
  constructor(readonly value: number) {
    super("NumberLiteralExpr");
  }

  public clone(): this {
    return new NumberLiteralExpr(this.value) as this;
  }
}

export const isStringLiteralExpr = typeGuard("StringLiteralExpr");

export class StringLiteralExpr extends BaseExpr<"StringLiteralExpr"> {
  constructor(readonly value: string) {
    super("StringLiteralExpr");
  }

  public clone(): this {
    return new StringLiteralExpr(this.value) as this;
  }
}

export const isArrayLiteralExpr = typeGuard("ArrayLiteralExpr");

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

export const isObjectElementExpr = typeGuard(
  "PropAssignExpr",
  "SpreadAssignExpr"
);

export const isObjectLiteralExpr = typeGuard("ObjectLiteralExpr");

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
      if (prop.kind === "PropAssignExpr") {
        if (prop.name.kind === "Identifier") {
          return prop.name.name === name;
        } else if (prop.name.kind === "StringLiteralExpr") {
          return prop.name.value === name;
        } else if (prop.name.expr.kind === "StringLiteralExpr") {
          return prop.name.expr.value === name;
        }
      }
      return false;
    });
  }
}

export const isPropAssignExpr = typeGuard("PropAssignExpr");

export class PropAssignExpr extends BaseExpr<
  "PropAssignExpr",
  ObjectLiteralExpr
> {
  constructor(
    readonly name: Identifier | ComputedPropertyNameExpr | StringLiteralExpr,
    readonly expr: Expr
  ) {
    super("PropAssignExpr");
    name.setParent(this);
    expr.setParent(this);
  }

  public clone(): this {
    return new PropAssignExpr(this.name.clone(), this.expr.clone()) as this;
  }
}

export const isComputedPropertyNameExpr = typeGuard("ComputedPropertyNameExpr");

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

export const isSpreadAssignExpr = typeGuard("SpreadAssignExpr");

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

export const isSpreadElementExpr = typeGuard("SpreadElementExpr");

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

export const isTemplateExpr = typeGuard("TemplateExpr");

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

export const isTypeOfExpr = typeGuard("TypeOfExpr");

export class TypeOfExpr extends BaseExpr<"TypeOfExpr"> {
  constructor(readonly expr: Expr) {
    super("TypeOfExpr");

    expr.setParent(this);
  }

  public clone(): this {
    return new TypeOfExpr(this.expr.clone()) as this;
  }
}

export const isAwaitExpr = typeGuard("AwaitExpr");

export class AwaitExpr extends BaseExpr<"AwaitExpr"> {
  constructor(readonly expr: Expr) {
    super("AwaitExpr");

    expr.setParent(this);
  }

  public clone(): this {
    return new AwaitExpr(this.expr.clone()) as this;
  }
}
