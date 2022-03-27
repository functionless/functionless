import { FunctionDecl } from "./declaration";
import { Expr, FunctionExpr } from "./expression";
import { BaseNode, FunctionlessNode, isNode, typeGuard } from "./node";

/**
 * A {@link Stmt} (Statement) is unit of execution that does not yield any value. They are translated
 * to `#set`, `$util.qr` and `#return` directives.
 */
export type Stmt =
  | BreakStmt
  | BlockStmt
  | CatchClause
  | DoStmt
  | ExprStmt
  | ForInStmt
  | ForOfStmt
  | IfStmt
  | ReturnStmt
  | ThrowStmt
  | TryStmt
  | VariableStmt
  | WhileStmt;

export function isStmt(a: any): a is Stmt {
  return (
    isNode(a) &&
    (isBreakStmt(a) ||
      isBlockStmt(a) ||
      isCatchClause(a) ||
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

export class BaseStmt<
  Kind extends FunctionlessNode["kind"],
  Parent extends FunctionlessNode | undefined = BlockStmt | IfStmt
> extends BaseNode<Kind, Parent> {
  readonly nodeKind: "Stmt" = "Stmt";

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
    expr.setParent(this);
  }
}

export const isVariableStmt = typeGuard("VariableStmt");

export type VariableStmtParent =
  | ForInStmt
  | ForOfStmt
  | FunctionDecl
  | FunctionExpr
  | CatchClause;

export class VariableStmt<
  E extends Expr | undefined = Expr | undefined
> extends BaseStmt<"VariableStmt", VariableStmtParent> {
  constructor(readonly name: string, readonly expr: E) {
    super("VariableStmt");
    if (expr) {
      expr.setParent(this);
    }
  }
}

export const isBlockStmt = typeGuard("BlockStmt");

export type BlockStmtParent =
  | CatchClause
  | DoStmt
  | ForInStmt
  | ForOfStmt
  | FunctionDecl
  | FunctionExpr
  | IfStmt
  | TryStmt
  | WhileStmt;

export class BlockStmt extends BaseStmt<"BlockStmt", BlockStmtParent> {
  constructor(readonly statements: Stmt[]) {
    super("BlockStmt");
    statements.forEach((stmt, i) => {
      stmt.setParent(this as never);
      stmt.prev = i > 0 ? statements[i - 1] : undefined;
      stmt.next = i + 1 < statements.length ? statements[i + 1] : undefined;
    });
  }

  public isFinallyBlock(): this is {
    parent: TryStmt & {
      finallyBlock: BlockStmt;
    };
  } {
    return this.parent.kind === "TryStmt" && this.parent.finallyBlock === this;
  }

  public isEmpty(): this is {
    readonly statements: [];
  } {
    return this.statements.length === 0;
  }

  public isNotEmpty(): this is {
    readonly statements: [Stmt, ...Stmt[]];
  } {
    return this.statements.length > 0;
  }

  public get firstStmt(): Stmt | undefined {
    return this.statements[0];
  }

  public get lastStmt(): Stmt | undefined {
    if (this.isEmpty()) {
      return undefined!;
    } else {
      return this.statements[this.statements.length - 1] as any;
    }
  }
}

export const isReturn = typeGuard("ReturnStmt");

export class ReturnStmt extends BaseStmt<"ReturnStmt"> {
  constructor(readonly expr: Expr) {
    super("ReturnStmt");
    expr.setParent(this);
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
    when.setParent(this as never);
    then.setParent(this);
    if (_else) {
      _else.setParent(this);
    }
  }
}

export const isForOfStmt = typeGuard("ForOfStmt");

export class ForOfStmt extends BaseStmt<"ForOfStmt"> {
  constructor(
    readonly variableDecl: VariableStmt,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super("ForOfStmt");
    variableDecl.setParent(this);
    expr.setParent(this as never);
    body.setParent(this);
  }
}

export const isForInStmt = typeGuard("ForInStmt");

export class ForInStmt extends BaseStmt<"ForInStmt"> {
  constructor(
    readonly variableDecl: VariableStmt,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super("ForInStmt");
    variableDecl.setParent(this);
    expr.setParent(this as never);
    body.setParent(this);
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
    readonly catchClause: CatchClause,
    readonly finallyBlock?: BlockStmt
  ) {
    super("TryStmt");
    tryBlock.setParent(this);
    if (catchClause) {
      catchClause.setParent(this);
    }
    if (finallyBlock) {
      finallyBlock.setParent(this);
    }
  }
}

export const isCatchClause = typeGuard("CatchClause");

export class CatchClause extends BaseStmt<"CatchClause", TryStmt> {
  constructor(
    readonly variableDecl: VariableStmt | undefined,
    readonly block: BlockStmt
  ) {
    super("CatchClause");
    if (variableDecl) {
      variableDecl.setParent(this);
    }
    block.setParent(this);
  }
}

export const isThrowStmt = typeGuard("ThrowStmt");

export class ThrowStmt extends BaseStmt<"ThrowStmt"> {
  constructor(readonly expr: Expr) {
    super("ThrowStmt");
    expr.setParent(this as never);
  }
}

export const isWhileStmt = typeGuard("WhileStmt");

export class WhileStmt extends BaseStmt<"WhileStmt"> {
  constructor(readonly condition: Expr, readonly block: BlockStmt) {
    super("WhileStmt");
    condition.setParent(this);
    block.setParent(this);
  }
}

export const isDoStmt = typeGuard("DoStmt");

export class DoStmt extends BaseStmt<"DoStmt"> {
  constructor(readonly block: BlockStmt, readonly condition: Expr) {
    super("DoStmt");
    block.setParent(this);
    condition.setParent(this);
  }
}
