import type {
  FunctionDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import { Expr, FunctionExpr, Identifier } from "./expression";
import { isTryStmt } from "./guards";
import { BaseNode, FunctionlessNode } from "./node";

/**
 * A {@link Stmt} (Statement) is unit of execution that does not yield any value. They are translated
 * to `#set`, `$util.qr` and `#return` directives.
 */
export type Stmt =
  | BreakStmt
  | BlockStmt
  | CatchClause
  | ContinueStmt
  | DoStmt
  | ExprStmt
  | ForInStmt
  | ForOfStmt
  | ForStmt
  | IfStmt
  | ReturnStmt
  | ThrowStmt
  | TryStmt
  | VariableStmt
  | WhileStmt;

export abstract class BaseStmt<
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

export class ExprStmt extends BaseStmt<"ExprStmt"> {
  constructor(readonly expr: Expr) {
    super("ExprStmt");
    expr.setParent(this);
  }

  public clone(): this {
    return new ExprStmt(this.expr.clone()) as this;
  }
}

export type VariableStmtParent = FunctionDecl | FunctionExpr;

export class VariableStmt extends BaseStmt<"VariableStmt", VariableStmtParent> {
  constructor(readonly declList: VariableDeclList) {
    super("VariableStmt");
    declList.setParent(this);
  }

  public clone(): this {
    return new VariableStmt(this.declList.clone()) as this;
  }
}

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

  public clone(): this {
    return new BlockStmt(this.statements.map((stmt) => stmt.clone())) as this;
  }

  public isFinallyBlock(): this is FinallyBlock {
    return isTryStmt(this.parent) && this.parent.finallyBlock === this;
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
      return undefined;
    } else {
      return this.statements[this.statements.length - 1] as any;
    }
  }
}

export class ReturnStmt extends BaseStmt<"ReturnStmt"> {
  constructor(readonly expr: Expr) {
    super("ReturnStmt");
    expr.setParent(this);
  }

  public clone(): this {
    return new ReturnStmt(this.expr.clone()) as this;
  }
}

export class IfStmt extends BaseStmt<"IfStmt"> {
  constructor(readonly when: Expr, readonly then: Stmt, readonly _else?: Stmt) {
    super("IfStmt");
    when.setParent(this as never);
    then.setParent(this);
    if (_else) {
      _else.setParent(this);
    }
  }

  public clone(): this {
    return new IfStmt(
      this.when.clone(),
      this.then.clone(),
      this._else?.clone()
    ) as this;
  }
}

export class ForOfStmt extends BaseStmt<"ForOfStmt"> {
  constructor(
    readonly variableDecl: VariableDecl | Identifier,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super("ForOfStmt");
    variableDecl.setParent(this);
    expr.setParent(this as never);
    body.setParent(this);
  }

  public clone(): this {
    return new ForOfStmt(
      this.variableDecl.clone(),
      this.expr.clone(),
      this.body.clone()
    ) as this;
  }
}

export class ForInStmt extends BaseStmt<"ForInStmt"> {
  constructor(
    readonly variableDecl: VariableDecl | Identifier,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super("ForInStmt");
    variableDecl.setParent(this);
    expr.setParent(this as never);
    body.setParent(this);
  }

  public clone(): this {
    return new ForInStmt(
      this.variableDecl.clone(),
      this.expr.clone(),
      this.body.clone()
    ) as this;
  }
}

export class ForStmt extends BaseStmt<"ForStmt"> {
  constructor(
    readonly body: BlockStmt,
    readonly variableDecl?: VariableDeclList | Expr,
    readonly condition?: Expr,
    readonly incrementor?: Expr
  ) {
    super("ForStmt");
    variableDecl?.setParent(this);
    condition?.setParent(this);
    incrementor?.setParent(this);
    body.setParent(this);
  }

  public clone(): this {
    return new ForStmt(
      this.body.clone(),
      this.variableDecl?.clone(),
      this.condition?.clone(),
      this.incrementor?.clone()
    ) as this;
  }
}

export class BreakStmt extends BaseStmt<"BreakStmt"> {
  constructor() {
    super("BreakStmt");
  }

  public clone(): this {
    return new BreakStmt() as this;
  }
}

export class ContinueStmt extends BaseStmt<"ContinueStmt"> {
  constructor() {
    super("ContinueStmt");
  }

  public clone(): this {
    return new ContinueStmt() as this;
  }
}

export interface FinallyBlock extends BlockStmt {
  parent: TryStmt & {
    finallyBlock: FinallyBlock;
  };
}

export class TryStmt extends BaseStmt<"TryStmt"> {
  constructor(
    readonly tryBlock: BlockStmt,
    readonly catchClause?: CatchClause,
    readonly finallyBlock?: FinallyBlock
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

  public clone(): this {
    return new TryStmt(
      this.tryBlock.clone(),
      this.catchClause?.clone(),
      this.finallyBlock?.clone()
    ) as this;
  }
}

export class CatchClause extends BaseStmt<"CatchClause", TryStmt> {
  constructor(
    readonly variableDecl: VariableDecl | undefined,
    readonly block: BlockStmt
  ) {
    super("CatchClause");
    if (variableDecl) {
      variableDecl.setParent(this);
    }
    block.setParent(this);
  }

  public clone(): this {
    return new CatchClause(
      this.variableDecl?.clone(),
      this.block.clone()
    ) as this;
  }
}

export class ThrowStmt extends BaseStmt<"ThrowStmt"> {
  constructor(readonly expr: Expr) {
    super("ThrowStmt");
    expr.setParent(this as never);
  }

  public clone(): this {
    return new ThrowStmt(this.expr.clone()) as this;
  }
}

export class WhileStmt extends BaseStmt<"WhileStmt"> {
  constructor(readonly condition: Expr, readonly block: BlockStmt) {
    super("WhileStmt");
    condition.setParent(this);
    block.setParent(this);
  }

  public clone(): this {
    return new WhileStmt(this.condition.clone(), this.block.clone()) as this;
  }
}

export class DoStmt extends BaseStmt<"DoStmt"> {
  constructor(readonly block: BlockStmt, readonly condition: Expr) {
    super("DoStmt");
    block.setParent(this);
    condition.setParent(this);
  }

  public clone(): this {
    return new DoStmt(this.block.clone(), this.condition.clone()) as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
