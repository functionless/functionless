import { AnyFunction } from "./function";
import { AnyLambda } from "./lambda";
import { AnyTable } from "./table";

class BaseExpr<Kind extends string> {
  // @ts-ignore
  parent: Expr;
  constructor(readonly kind: Kind) {}
}

export type Literal =
  | undefined
  | null
  | boolean
  | number
  | string
  | Expr[]
  | readonly Expr[]
  | {
      [key: string]: Expr;
    };

export type Expr =
  | ArrayLiteral
  | Binary
  | Block
  | BooleanLiteral
  | Call
  | FunctionDecl
  | Identifier
  | If
  | Map
  | NullLiteral
  | NumberLiteral
  | ObjectElement
  | ObjectLiteral
  | PropRef
  | Reference
  | Return
  | StringLiteral
  | Unary
  | VariableDecl;

export function isExpr(a: any): a is Expr {
  return typeof a?.kind === "string";
}

export class FunctionDecl<
  F extends AnyFunction = AnyFunction
> extends BaseExpr<"FunctionDecl"> {
  readonly _functionBrand?: F;
  constructor(readonly argNames: string[], readonly body: Block) {
    super("FunctionDecl");
    body.parent = this;
  }
}

export const isBlock = typeGuard("Block");

export class Block extends BaseExpr<"Block"> {
  constructor(readonly exprs: Expr[]) {
    super("Block");
    for (const expr of exprs) {
      expr.parent = this;
    }
  }
}

export const isReference = typeGuard("Reference");

export class Reference extends BaseExpr<"Reference"> {
  constructor(readonly name: AnyTable | AnyLambda) {
    super("Reference");
  }
}

export const isVariableDecl = typeGuard("VariableDecl");

export class VariableDecl extends BaseExpr<"VariableDecl"> {
  constructor(readonly name: string, readonly expr: Expr) {
    super("VariableDecl");
    expr.parent = this;
  }
}

export const isIdentifier = typeGuard("Identifier");

export class Identifier extends BaseExpr<"Identifier"> {
  constructor(readonly id: string) {
    super("Identifier");
  }
}

export const isPropRef = typeGuard("PropRef");

export class PropRef extends BaseExpr<"PropRef"> {
  constructor(readonly expr: Expr, readonly id: string) {
    super("PropRef");
    expr.parent = this;
  }
}

export const isCall = typeGuard("Call");

export class Call extends BaseExpr<"Call"> {
  constructor(
    readonly expr: Expr,
    readonly args: {
      [argName: string]: Expr;
    }
  ) {
    super("Call");
    expr.parent = this;
    for (const arg of Object.values(args)) {
      arg.parent = this;
    }
  }
}

export const isMap = typeGuard("Map");

export class Map extends BaseExpr<"Map"> {
  constructor(readonly expr: Expr) {
    super("Map");
    expr.parent = this;
  }
}

export const isReturn = typeGuard("Return");

export class Return extends BaseExpr<"Return"> {
  constructor(readonly expr: Expr) {
    super("Return");
    expr.parent = this;
  }
}

export const isIf = typeGuard("If");

export class If extends BaseExpr<"If"> {
  constructor(readonly when: Expr, readonly then: Expr, readonly _else?: Expr) {
    super("If");
    when.parent = this;
    then.parent = this;
    if (_else) {
      _else.parent = this;
    }
  }
}

export const isBinary = typeGuard("Binary");

export type BinaryOp = "==" | "!=" | "<" | "<=" | ">" | ">=" | "&&" | "||";

export class Binary extends BaseExpr<"Binary"> {
  constructor(
    readonly left: Expr,
    readonly op: BinaryOp,
    readonly right: Expr
  ) {
    super("Binary");
    left.parent = this;
    right.parent = this;
  }
}

export const isUnary = typeGuard("Unary");

export type UnaryOp = "!";

export class Unary extends BaseExpr<"Unary"> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super("Unary");
    expr.parent = this;
  }
}

// literals

export const isNullLiteral = typeGuard("NullLiteral");

export class NullLiteral extends BaseExpr<"NullLiteral"> {
  constructor() {
    super("NullLiteral");
  }
}

export const isBooleanLiteral = typeGuard("BooleanLiteral");

export class BooleanLiteral extends BaseExpr<"BooleanLiteral"> {
  constructor(readonly value: string) {
    super("BooleanLiteral");
  }
}

export const isNumberLiteral = typeGuard("NumberLiteral");

export class NumberLiteral extends BaseExpr<"NumberLiteral"> {
  constructor(readonly value: string) {
    super("NumberLiteral");
  }
}

export const isStringLiteral = typeGuard("StringLiteral");

export class StringLiteral extends BaseExpr<"StringLiteral"> {
  constructor(readonly value: string) {
    super("StringLiteral");
  }
}

export const isArrayLiteral = typeGuard("ArrayLiteral");

export class ArrayLiteral extends BaseExpr<"ArrayLiteral"> {
  constructor(readonly items: Expr[]) {
    super("ArrayLiteral");
  }
}

export type ObjectElement = PropertyAssignment | SpreadAssignment;

export const isObjectLiteral = typeGuard("ObjectLiteral");

export class ObjectLiteral extends BaseExpr<"ObjectLiteral"> {
  constructor(readonly properties: ObjectElement[]) {
    super("ObjectLiteral");
    for (const prop of properties) {
      prop.parent = this;
    }
  }
}

export const isPropertyAssignment = typeGuard("PropertyAssignment");

export class PropertyAssignment extends BaseExpr<"PropertyAssignment"> {
  constructor(readonly name: string, readonly expr: Expr) {
    super("PropertyAssignment");
    expr.parent = this;
  }
}

export const isSpreadAssignment = typeGuard("SpreadAssignment");

export class SpreadAssignment extends BaseExpr<"SpreadAssignment"> {
  constructor(readonly expr: Expr) {
    super("SpreadAssignment");
    expr.parent = this;
  }
}

// generates type guards
function typeGuard<Kind extends Expr["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<Expr, { kind: Kind }> {
  return (a: any): a is Extract<Expr, { kind: Kind }> =>
    kinds.find((kind) => a.kind === kind) !== undefined;
}
