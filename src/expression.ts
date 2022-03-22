import { AnyStepFunction } from "./step-function";
import { ParameterDecl } from "./declaration";
import { AnyLambda } from "./function";
import { BaseNode, isNode, setParent, typeGuard } from "./node";
import { BlockStmt } from "./statement";
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

export const isFunctionExpr = typeGuard("FunctionExpr");

export class FunctionExpr<
  F extends AnyFunction = AnyFunction
> extends BaseNode<"FunctionExpr"> {
  readonly _functionBrand?: F;
  constructor(readonly parameters: ParameterDecl[], readonly body: BlockStmt) {
    super("FunctionExpr");
    setParent(this, parameters);
    body.parent = this;
  }
}

export const isReferenceExpr = typeGuard("ReferenceExpr");

export type CanReference = AnyTable | AnyLambda | AnyStepFunction | typeof $AWS;

export class ReferenceExpr extends BaseNode<"ReferenceExpr"> {
  constructor(readonly name: string, readonly ref: () => CanReference) {
    super("ReferenceExpr");
  }
}

export const isIdentifier = typeGuard("Identifier");

export class Identifier extends BaseNode<"Identifier"> {
  constructor(readonly name: string) {
    super("Identifier");
  }
}

export const isPropAccessExpr = typeGuard("PropAccessExpr");

export class PropAccessExpr extends BaseNode<"PropAccessExpr"> {
  constructor(readonly expr: Expr, readonly name: string) {
    super("PropAccessExpr");
    setParent(this, expr);
  }
}

export const isElementAccessExpr = typeGuard("ElementAccessExpr");

export class ElementAccessExpr extends BaseNode<"ElementAccessExpr"> {
  constructor(readonly expr: Expr, readonly element: Expr) {
    super("ElementAccessExpr");
    setParent(this, expr);
  }
}

export const isCallExpr = typeGuard("CallExpr");

export class CallExpr extends BaseNode<"CallExpr"> {
  constructor(
    readonly expr: Expr,
    readonly args: {
      [argName: string]: Expr;
    }
  ) {
    super("CallExpr");
    expr.parent = this;
    for (const arg of Object.values(args)) {
      if (arg) {
        arg.parent = this;
      }
    }
  }
}

export const isNewExpr = typeGuard("NewExpr");

export class NewExpr extends BaseNode<"NewExpr"> {
  constructor(
    readonly expr: Expr,
    readonly args: {
      [argName: string]: Expr;
    }
  ) {
    super("NewExpr");
    expr.parent = this;
    for (const arg of Object.values(args)) {
      if (arg) {
        arg.parent = this;
      }
    }
  }
}

export const isConditionExpr = typeGuard("ConditionExpr");

export class ConditionExpr extends BaseNode<"ConditionExpr"> {
  constructor(readonly when: Expr, readonly then: Expr, readonly _else: Expr) {
    super("ConditionExpr");
    when.parent = this;
    then.parent = this;
    if (_else) {
      _else.parent = this;
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

export class BinaryExpr extends BaseNode<"BinaryExpr"> {
  constructor(
    readonly left: Expr,
    readonly op: BinaryOp,
    readonly right: Expr
  ) {
    super("BinaryExpr");
    left.parent = this;
    right.parent = this;
  }
}

export const isUnaryExpr = typeGuard("UnaryExpr");

export type UnaryOp = "!";

export class UnaryExpr extends BaseNode<"UnaryExpr"> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super("UnaryExpr");
    expr.parent = this;
  }
}

// literals

export const isNullLiteralExpr = typeGuard("NullLiteralExpr");

export class NullLiteralExpr extends BaseNode<"NullLiteralExpr"> {
  readonly value = null;
  constructor() {
    super("NullLiteralExpr");
  }
}

export const isBooleanLiteral = typeGuard("BooleanLiteralExpr");

export class BooleanLiteralExpr extends BaseNode<"BooleanLiteralExpr"> {
  constructor(readonly value: boolean) {
    super("BooleanLiteralExpr");
  }
}

export const isNumberLiteralExpr = typeGuard("NumberLiteralExpr");

export class NumberLiteralExpr extends BaseNode<"NumberLiteralExpr"> {
  constructor(readonly value: number) {
    super("NumberLiteralExpr");
  }
}

export const isStringLiteralExpr = typeGuard("StringLiteralExpr");

export class StringLiteralExpr extends BaseNode<"StringLiteralExpr"> {
  constructor(readonly value: string) {
    super("StringLiteralExpr");
  }
}

export const isArrayLiteralExpr = typeGuard("ArrayLiteralExpr");

export class ArrayLiteralExpr extends BaseNode<"ArrayLiteralExpr"> {
  constructor(readonly items: Expr[]) {
    super("ArrayLiteralExpr");
    setParent(this, items);
  }
}

export type ObjectElementExpr = PropAssignExpr | SpreadAssignExpr;

export const isObjectElementExpr = typeGuard(
  "PropAssignExpr",
  "SpreadAssignExpr"
);

export const isObjectLiteralExpr = typeGuard("ObjectLiteralExpr");

export class ObjectLiteralExpr extends BaseNode<"ObjectLiteralExpr"> {
  constructor(readonly properties: ObjectElementExpr[]) {
    super("ObjectLiteralExpr");
    setParent(this, properties);
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

export class PropAssignExpr extends BaseNode<"PropAssignExpr"> {
  constructor(readonly name: Expr, readonly expr: Expr) {
    super("PropAssignExpr");
    expr.parent = this;
  }
}

export const isSpreadAssignExpr = typeGuard("SpreadAssignExpr");

export class SpreadAssignExpr extends BaseNode<"SpreadAssignExpr"> {
  constructor(readonly expr: Expr) {
    super("SpreadAssignExpr");
    expr.parent = this;
  }
}

export const isSpreadElementExpr = typeGuard("SpreadElementExpr");

export class SpreadElementExpr extends BaseNode<"SpreadElementExpr"> {
  constructor(readonly expr: Expr) {
    super("SpreadElementExpr");
    expr.parent = this;
  }
}

export const isTemplateExpr = typeGuard("SpreadAssignExpr");

/**
 * Interpolates a TemplateExpr to a string `this ${is} a template expression`
 */
export class TemplateExpr extends BaseNode<"TemplateExpr"> {
  constructor(readonly exprs: Expr[]) {
    super("TemplateExpr");
    setParent(this, exprs);
  }
}
