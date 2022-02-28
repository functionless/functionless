import { AnyFunction } from "./function";
import { AnyLambda } from "./function";
import { AnyTable } from "./table";

export declare function reflect<F extends AnyFunction>(
  func: F
): FunctionDecl<F>;

class BaseNode<Kind extends string> {
  // Expr that contains this one (surrounding scope)
  parent: Node | undefined;
  // Expr that is directly adjacent and above this one (same scope)
  prev: Node | undefined;
  constructor(readonly kind: Kind) {}
}

// export type Literal =
//   | undefined
//   | null
//   | boolean
//   | number
//   | string
//   | (Expr | Literal)[]
//   | readonly (Expr | Literal)[]
//   | {
//       [key: string]: Expr | Literal;
//     };

export type Node = Expr | Stmt;

export type Stmt =
  | Block
  | ExprStmt
  | ForInStmt
  | ForOfStmt
  | ParameterDecl
  | Return
  | VariableDecl;

export type Expr =
  | ArrayLiteral
  | Binary
  | BooleanLiteral
  | Call
  | ConditionExpr
  | ConditionStmt
  | ElementAccess
  | FunctionDecl
  | Identifier
  | NullLiteral
  | NumberLiteral
  | ObjectLiteral
  | PropAssign
  | PropRef
  | Reference
  | StringLiteral
  | SpreadAssignment
  | Unary;

export function isNode(a: any): a is Expr {
  return typeof a?.kind === "string";
}
export function isExpr(a: any) {
  return (
    isNode(a) &&
    (isArrayLiteral(a) ||
      isBinary(a) ||
      isBooleanLiteral(a) ||
      isCall(a) ||
      isConditionExpr(a) ||
      isConditionStmt(a) ||
      isElementAccess(a) ||
      isFunctionDecl(a) ||
      isIdentifier(a) ||
      isNullLiteral(a) ||
      isNumberLiteral(a) ||
      isPropAssign(a) ||
      isObjectLiteral(a) ||
      isPropRef(a) ||
      isReference(a) ||
      isStringLiteral(a) ||
      isUnary(a))
  );
}

export function isStmt(a: any): a is Stmt {
  return (
    isNode(a) &&
    (isBlock(a) ||
      isExprStmt(a) ||
      isForInStmt(a) ||
      isForOfStmt(a) ||
      isParameterDecl(a) ||
      isReturn(a) ||
      isVariableDecl(a))
  );
}

export const isExprStmt = typeGuard("ExprStmt");

export class ExprStmt extends BaseNode<"ExprStmt"> {
  constructor(readonly expr: Expr) {
    super("ExprStmt");
    expr.parent = this;
  }
}

export const isFunctionDecl = typeGuard("FunctionDecl");

export class FunctionDecl<
  F extends AnyFunction = AnyFunction
> extends BaseNode<"FunctionDecl"> {
  readonly _functionBrand?: F;
  constructor(readonly parameters: ParameterDecl[], readonly body: Block) {
    super("FunctionDecl");
    setParent(this, parameters);
    body.parent = this;
  }
}

export const isParameterDecl = typeGuard("ParameterDecl");

export class ParameterDecl extends BaseNode<"ParameterDecl"> {
  constructor(readonly name: string) {
    super("ParameterDecl");
  }
}

export const isBlock = typeGuard("Block");

export class Block extends BaseNode<"Block"> {
  constructor(readonly statements: Stmt[]) {
    super("Block");
    let prev = undefined;
    for (const expr of statements) {
      expr.parent = this;
      expr.prev = prev;
      prev = expr;
    }
  }
}

export const isReference = typeGuard("Reference");

export class Reference extends BaseNode<"Reference"> {
  constructor(readonly ref: () => AnyTable | AnyLambda) {
    super("Reference");
  }
}

export const isVariableDecl = typeGuard("VariableDecl");

export class VariableDecl<
  E extends Expr | undefined = Expr | undefined
> extends BaseNode<"VariableDecl"> {
  constructor(readonly name: string, readonly expr: E) {
    super("VariableDecl");
    if (expr) {
      expr.parent = this;
    }
  }
}

export const isIdentifier = typeGuard("Identifier");

export class Identifier extends BaseNode<"Identifier"> {
  constructor(readonly name: string) {
    super("Identifier");
  }
}

export const isPropRef = typeGuard("PropRef");

export class PropRef extends BaseNode<"PropRef"> {
  constructor(readonly expr: Expr, readonly name: string) {
    super("PropRef");
    setParent(this, expr);
  }
}

export const isElementAccess = typeGuard("ElementAccess");

export class ElementAccess extends BaseNode<"ElementAccess"> {
  constructor(readonly expr: Expr, readonly element: Expr) {
    super("ElementAccess");
    setParent(this, expr);
  }
}

export const isCall = typeGuard("Call");

export class Call extends BaseNode<"Call"> {
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

export const isReturn = typeGuard("Return");

export class Return extends BaseNode<"Return"> {
  constructor(readonly expr: Expr) {
    super("Return");
    expr.parent = this;
  }
}

export const isConditionStmt = typeGuard("ConditionStmt");

export class ConditionStmt extends BaseNode<"ConditionStmt"> {
  constructor(
    readonly when: Expr,
    readonly then: Block,
    readonly _else?: Block
  ) {
    super("ConditionStmt");
    when.parent = this;
    then.parent = this;
    if (_else) {
      _else.parent = this;
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

export const isBinary = typeGuard("Binary");

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

export class Binary extends BaseNode<"Binary"> {
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

export class Unary extends BaseNode<"Unary"> {
  constructor(readonly op: UnaryOp, readonly expr: Expr) {
    super("Unary");
    expr.parent = this;
  }
}

// literals

export const isNullLiteral = typeGuard("NullLiteral");

export class NullLiteral extends BaseNode<"NullLiteral"> {
  constructor() {
    super("NullLiteral");
  }
}

export const isBooleanLiteral = typeGuard("BooleanLiteral");

export class BooleanLiteral extends BaseNode<"BooleanLiteral"> {
  constructor(readonly value: boolean) {
    super("BooleanLiteral");
  }
}

export const isNumberLiteral = typeGuard("NumberLiteral");

export class NumberLiteral extends BaseNode<"NumberLiteral"> {
  constructor(readonly value: number) {
    super("NumberLiteral");
  }
}

export const isStringLiteral = typeGuard("StringLiteral");

export class StringLiteral extends BaseNode<"StringLiteral"> {
  constructor(readonly value: string) {
    super("StringLiteral");
  }
}

export const isArrayLiteral = typeGuard("ArrayLiteral");

export class ArrayLiteral extends BaseNode<"ArrayLiteral"> {
  constructor(readonly items: Expr[]) {
    super("ArrayLiteral");
    setParent(this, items);
  }
}

export type ObjectElement = PropAssign | SpreadAssignment;

export const isObjectLiteral = typeGuard("ObjectLiteral");

export class ObjectLiteral extends BaseNode<"ObjectLiteral"> {
  constructor(readonly properties: ObjectElement[]) {
    super("ObjectLiteral");
    setParent(this, properties);
  }

  public getProperty(name: string) {
    return this.properties.find(
      (prop) => prop.kind === "PropAssign" && prop.name === name
    );
  }
}

function setParent(parent: Node, value: Node | Node[]) {
  if (value) {
    if (isNode(value)) {
      value.parent = parent;
    } else if (Array.isArray(value)) {
      value.forEach((v) => setParent(parent, v));
    } else if (typeof value === "object") {
      // Object.values(value).forEach((v) => setParent(parent, v));
    }
  }
}

export const isPropAssign = typeGuard("PropAssign");

export class PropAssign extends BaseNode<"PropAssign"> {
  constructor(readonly name: string, readonly expr: Expr) {
    super("PropAssign");
    expr.parent = this;
  }
}

export const isSpreadAssignment = typeGuard("SpreadAssignment");

export class SpreadAssignment extends BaseNode<"SpreadAssignment"> {
  constructor(readonly expr: Expr) {
    super("SpreadAssignment");
    expr.parent = this;
  }
}

export const isForOfStmt = typeGuard("ForOfStmt");

export class ForOfStmt extends BaseNode<"ForOfStmt"> {
  constructor(
    readonly i: VariableDecl,
    readonly expr: Expr,
    readonly body: Block
  ) {
    super("ForOfStmt");
    i.parent = this;
    expr.parent = this;
    body.parent = this;
  }
}

export const isForInStmt = typeGuard("ForInStmt");

export class ForInStmt extends BaseNode<"ForInStmt"> {
  constructor(
    readonly i: VariableDecl,
    readonly expr: Expr,
    readonly body: Block
  ) {
    super("ForInStmt");
    i.parent = this;
    expr.parent = this;
    body.parent = this;
  }
}

// generates type guards
function typeGuard<Kind extends Node["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<Node, { kind: Kind }> {
  return (a: any): a is Extract<Node, { kind: Kind }> =>
    kinds.find((kind) => a.kind === kind) !== undefined;
}
