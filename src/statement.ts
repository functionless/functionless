import { Expr } from "./expression";
import { BaseNode, isNode, typeGuard } from "./node";

export type Stmt =
  | BlockStmt
  | ExprStmt
  | ForInStmt
  | ForOfStmt
  | ReturnStmt
  | VariableDecl;

export function isStmt(a: any): a is Stmt {
  return (
    isNode(a) &&
    (isBlock(a) ||
      isExprStmt(a) ||
      isForInStmt(a) ||
      isForOfStmt(a) ||
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
    readonly _else?: BlockStmt
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
    readonly i: VariableDecl,
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
    readonly i: VariableDecl,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super("ForInStmt");
    i.parent = this;
    expr.parent = this;
    body.parent = this;
  }
}
