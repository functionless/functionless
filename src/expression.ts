import { AnyStepFunction } from "./step-function";
import { ParameterDecl } from "./declaration";
import { AnyLambda } from "./function";
import { BaseNode, FunctionlessNode, isNode, typeGuard } from "./node";
import type {
  BlockStmt,
  ExprStmt,
  ReturnStmt,
  VariableStmt,
} from "./statement";
import { AnyTable } from "./table";
import { $AWS } from "./aws";
import { AnyFunction } from "./util";

/**
 * An {@link Expr} (Expression) is a Node that will be interpreted to a value.
 */
export type Expr =
  | ArrayLiteralExpr
  | BinaryExpr
  | BooleanLiteralExpr
  | CallExpr
  | ConditionExpr
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
  | UnaryExpr;

export function isExpr(a: any): a is Expr {
  return (
    isNode(a) &&
    (isArrayLiteralExpr(a) ||
      isBinaryExpr(a) ||
      isBooleanLiteral(a) ||
      isCallExpr(a) ||
      isConditionExpr(a) ||
      isFunctionExpr(a) ||
      isElementAccessExpr(a) ||
      isIdentifier(a) ||
      isNewExpr(a) ||
      isNullLiteralExpr(a) ||
      isNumberLiteralExpr(a) ||
      isPropAssignExpr(a) ||
      isObjectLiteralExpr(a) ||
      isPropAccessExpr(a) ||
      isReferenceExpr(a) ||
      isStringLiteralExpr(a) ||
      isUnaryExpr(a))
  );
}

export const isLiteralExpr = typeGuard(
  "ArrayLiteralExpr",
  "BooleanLiteralExpr",
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

export class BaseExpr<
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
}

export const isReferenceExpr = typeGuard("ReferenceExpr");

export type CanReference = AnyTable | AnyLambda | AnyStepFunction | typeof $AWS;

export class ReferenceExpr extends BaseExpr<"ReferenceExpr"> {
  constructor(readonly name: string, readonly ref: () => CanReference) {
    super("ReferenceExpr");
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
}

export const isPropAccessExpr = typeGuard("PropAccessExpr");

export class PropAccessExpr extends BaseExpr<"PropAccessExpr"> {
  constructor(readonly expr: Expr, readonly name: string) {
    super("PropAccessExpr");
    expr.setParent(this);
  }
}

export const isElementAccessExpr = typeGuard("ElementAccessExpr");

export class ElementAccessExpr extends BaseExpr<"ElementAccessExpr"> {
  constructor(readonly expr: Expr, readonly element: Expr) {
    super("ElementAccessExpr");
    expr.setParent(this);
    element.setParent(this);
  }
}

export const isCallExpr = typeGuard("CallExpr");

export class CallExpr extends BaseExpr<"CallExpr"> {
  constructor(
    readonly expr: Expr,
    readonly args: {
      [argName: string]: Expr;
    }
  ) {
    super("CallExpr");
    expr.setParent(this);
    for (const arg of Object.values(args)) {
      if (arg) {
        arg.setParent(this);
      }
    }
  }
}

export const isNewExpr = typeGuard("NewExpr");

export class NewExpr extends BaseExpr<"NewExpr"> {
  constructor(
    readonly expr: Expr,
    readonly args: {
      [argName: string]: Expr;
    }
  ) {
    super("NewExpr");
    expr.setParent(this);
    for (const arg of Object.values(args)) {
      if (arg) {
        arg.setParent(this);
      }
    }
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
}

export const isBinaryExpr = typeGuard("BinaryExpr");

export type BinaryOp =
  | "="
  | "+"
  | "-"
  | "=="
  | "!="
  | "<"
  | "<="
  | ">"
  | ">="
  | "&&"
  | "||";

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
}

export const isUnaryExpr = typeGuard("UnaryExpr");

export type UnaryOp = "!";

export class UnaryExpr extends BaseExpr<"UnaryExpr"> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super("UnaryExpr");
    expr.setParent(this);
  }
}

// literals

export const isNullLiteralExpr = typeGuard("NullLiteralExpr");

export class NullLiteralExpr extends BaseExpr<"NullLiteralExpr"> {
  readonly value = null;
  constructor() {
    super("NullLiteralExpr");
  }
}

export const isBooleanLiteral = typeGuard("BooleanLiteralExpr");

export class BooleanLiteralExpr extends BaseExpr<"BooleanLiteralExpr"> {
  constructor(readonly value: boolean) {
    super("BooleanLiteralExpr");
  }
}

export const isNumberLiteralExpr = typeGuard("NumberLiteralExpr");

export class NumberLiteralExpr extends BaseExpr<"NumberLiteralExpr"> {
  constructor(readonly value: number) {
    super("NumberLiteralExpr");
  }
}

export const isStringLiteralExpr = typeGuard("StringLiteralExpr");

export class StringLiteralExpr extends BaseExpr<"StringLiteralExpr"> {
  constructor(readonly value: string) {
    super("StringLiteralExpr");
  }
}

export const isArrayLiteralExpr = typeGuard("ArrayLiteralExpr");

export class ArrayLiteralExpr extends BaseExpr<"ArrayLiteralExpr"> {
  constructor(readonly items: Expr[]) {
    super("ArrayLiteralExpr");
    items.forEach((item) => item.setParent(this));
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

  public getProperty(name: string) {
    return this.properties.find(
      (prop) =>
        prop.kind === "PropAssignExpr" &&
        ((prop.name.kind === "Identifier" && prop.name.name === name) ||
          (prop.name.kind === "StringLiteralExpr" && prop.name.value === name))
    );
  }
}

export const isPropAssignExpr = typeGuard("PropAssignExpr");

export class PropAssignExpr extends BaseExpr<
  "PropAssignExpr",
  ObjectLiteralExpr
> {
  constructor(readonly name: Expr, readonly expr: Expr) {
    super("PropAssignExpr");
    expr.setParent(this);
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
}

export const isTemplateExpr = typeGuard("SpreadAssignExpr");

/**
 * Interpolates a TemplateExpr to a string `this ${is} a template expression`
 */
export class TemplateExpr extends BaseExpr<"TemplateExpr"> {
  constructor(readonly exprs: Expr[]) {
    super("TemplateExpr");
    exprs.forEach((expr) => expr.setParent(this));
  }
}
