import { Expr } from "./expression";
import { BaseNode, isNode, typeGuard } from "./node";

/**
 * A {@link Stmt} (Statement) is unit of execution that does not yield any value. They are translated
 * to `#set`, `$util.qr` and `#return` directives.
 */
export type Stmt =
  | BreakStmt
  | BlockStmt
  | ExprStmt
  | ForInStmt
  | ForOfStmt
  | IfStmt
  | ReturnStmt
  | VariableStmt;

export function isStmt(a: any): a is Stmt {
  return (
    isNode(a) &&
    (isBlock(a) ||
      isExprStmt(a) ||
      isForInStmt(a) ||
      isForOfStmt(a) ||
      isReturn(a) ||
      isVariableStmt(a))
  );
}

export const isExprStmt = typeGuard("ExprStmt");

export class ExprStmt extends BaseNode<"ExprStmt"> {
  constructor(readonly expr: Expr) {
    super("ExprStmt");
    expr.parent = this;
  }
}

export const isVariableStmt = typeGuard("VariableStmt");

export class VariableStmt<
  E extends Expr | undefined = Expr | undefined
> extends BaseNode<"VariableStmt"> {
  constructor(readonly name: string, readonly expr: E) {
    super("VariableStmt");
    if (expr) {
      expr.parent = this;
    }
  }
}

export const isBlock = typeGuard("BlockStmt");

export class BlockStmt extends BaseNode<"BlockStmt"> {
  constructor(readonly statements: Stmt[]) {
    super("BlockStmt");
    let prev = undefined;
    for (const expr of statements) {
      expr.parent = this;
      expr.prev = prev;
      prev = expr;
    }
  }
}

export const isReturn = typeGuard("ReturnStmt");

export class ReturnStmt extends BaseNode<"ReturnStmt"> {
  constructor(readonly expr: Expr) {
    super("ReturnStmt");
    expr.parent = this;
  }
}

export const isIfStmt = typeGuard("IfStmt");

export class IfStmt extends BaseNode<"IfStmt"> {
  constructor(
    readonly when: Expr,
    readonly then: BlockStmt,
    readonly _else?: IfStmt | BlockStmt
  ) {
    super("IfStmt");
    when.parent = this;
    then.parent = this;
    if (_else) {
      _else.parent = this;
    }
  }
}

export const isForOfStmt = typeGuard("ForOfStmt");

export class ForOfStmt extends BaseNode<"ForOfStmt"> {
  constructor(
    readonly i: VariableStmt,
    readonly expr: Expr,
    readonly body: BlockStmt
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
    readonly i: VariableStmt,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super("ForInStmt");
    i.parent = this;
    expr.parent = this;
    body.parent = this;
  }
}

export const isBreakStmt = typeGuard("BreakStmt");

export class BreakStmt extends BaseNode<"BreakStmt"> {
  constructor() {
    super("BreakStmt");
  }
}
