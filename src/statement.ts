import { Expr } from "./expression";
import { BaseNode, isNode, typeGuard } from "./node";

/**
 * A {@link Stmt} (Statement) is unit of execution that does not yield any value. They are translated
 * to `#set`, `$util.qr` and `#return` directives.
 */
export type Stmt =
  | BreakStmt
  | BlockStmt
  | CatchClause
  | ExprStmt
  | ForInStmt
  | ForOfStmt
  | IfStmt
  | ReturnStmt
  | ThrowStmt
  | TryStmt
  | VariableStmt;

export function isStmt(a: any): a is Stmt {
  return (
    isNode(a) &&
    (isBreakStmt(a) ||
      isBlockStmt(a) ||
      isCatchStmt(a) ||
      isExprStmt(a) ||
      isForInStmt(a) ||
      isForOfStmt(a) ||
      isIfStmt(a) ||
      isReturn(a) ||
      isThrowStmt(a) ||
      isTryStmt(a) ||
      isVariableStmt(a))
  );
}

export class BaseStmt<Kind extends string> extends BaseNode<Kind> {
  /**
   * Node that is prior to this node.
   */
  prev: Stmt | undefined;
  /**
   * Node that is subsequent to this node.
   */
  next: Stmt | undefined;
}

export const isExprStmt = typeGuard("ExprStmt");

export class ExprStmt extends BaseStmt<"ExprStmt"> {
  constructor(readonly expr: Expr) {
    super("ExprStmt");
    expr.parent = this;
  }
}

export const isVariableStmt = typeGuard("VariableStmt");

export class VariableStmt<
  E extends Expr | undefined = Expr | undefined
> extends BaseStmt<"VariableStmt"> {
  constructor(readonly name: string, readonly expr: E) {
    super("VariableStmt");
    if (expr) {
      expr.parent = this;
    }
  }
}

export const isBlockStmt = typeGuard("BlockStmt");

export class BlockStmt extends BaseStmt<"BlockStmt"> {
  constructor(readonly statements: Stmt[]) {
    super("BlockStmt");
    statements.forEach((expr, i) => {
      expr.parent = this;
      expr.prev = i > 0 ? statements[i - 1] : undefined;
      expr.next = i + 1 < statements.length ? statements[i + 1] : undefined;
    });
  }
}

export const isReturn = typeGuard("ReturnStmt");

export class ReturnStmt extends BaseStmt<"ReturnStmt"> {
  constructor(readonly expr: Expr) {
    super("ReturnStmt");
    expr.parent = this;
  }
}

export const isIfStmt = typeGuard("IfStmt");

export class IfStmt extends BaseStmt<"IfStmt"> {
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

export class ForOfStmt extends BaseStmt<"ForOfStmt"> {
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

export class ForInStmt extends BaseStmt<"ForInStmt"> {
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

export class BreakStmt extends BaseStmt<"BreakStmt"> {
  constructor() {
    super("BreakStmt");
  }
}

export const isTryStmt = typeGuard("TryStmt");

export class TryStmt extends BaseStmt<"TryStmt"> {
  constructor(
    readonly tryBlock: BlockStmt,
    readonly catchClause?: CatchClause,
    readonly finallyBlock?: BlockStmt
  ) {
    super("TryStmt");
    tryBlock.parent = this;
    if (catchClause) {
      catchClause.parent = this;
    }
    if (finallyBlock) {
      finallyBlock.parent = this;
    }
  }
}

export const isCatchStmt = typeGuard("CatchClause");

export class CatchClause extends BaseStmt<"CatchClause"> {
  constructor(
    readonly variableDecl: VariableStmt | undefined,
    readonly block: BlockStmt
  ) {
    super("CatchClause");
    if (variableDecl) {
      variableDecl.parent = this;
    }
    block.parent = this;
  }
}

export const isThrowStmt = typeGuard("ThrowStmt");

export class ThrowStmt extends BaseStmt<"ThrowStmt"> {
  constructor(readonly expr: Expr) {
    super("ThrowStmt");
    expr.parent = this;
  }
}
