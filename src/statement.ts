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
  | DebuggerStmt
  | DoStmt
  | EmptyStmt
  | ExprStmt
  | ForInStmt
  | ForOfStmt
  | ForStmt
  | IfStmt
  | LabelledStmt
  | ReturnStmt
  | SwitchStmt
  | SwitchClause
  | ThrowStmt
  | TryStmt
  | VariableStmt
  | WhileStmt
  | WithStmt;

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
    super("ExprStmt", arguments);
  }

  public clone(): this {
    return new ExprStmt(this.expr.clone()) as this;
  }
}

export class VariableStmt extends BaseStmt<"VariableStmt"> {
  constructor(readonly declList: VariableDeclList) {
    super("VariableStmt", arguments);
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
  | ForStmt
  | FunctionDecl
  | FunctionExpr
  | IfStmt
  | TryStmt
  | WhileStmt;

export class BlockStmt extends BaseStmt<"BlockStmt", BlockStmtParent> {
  constructor(readonly statements: Stmt[]) {
    super("BlockStmt", arguments);
    statements.forEach((stmt, i) => {
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
    super("ReturnStmt", arguments);
  }

  public clone(): this {
    return new ReturnStmt(this.expr.clone()) as this;
  }
}

export class IfStmt extends BaseStmt<"IfStmt"> {
  constructor(readonly when: Expr, readonly then: Stmt, readonly _else?: Stmt) {
    super("IfStmt", arguments);
    if (_else) {
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
    super("ForOfStmt", arguments);
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
    super("ForInStmt", arguments);
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
    super("ForStmt", arguments);
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
    super("BreakStmt", arguments);
  }

  public clone(): this {
    return new BreakStmt() as this;
  }
}

export class ContinueStmt extends BaseStmt<"ContinueStmt"> {
  constructor() {
    super("ContinueStmt", arguments);
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
    super("TryStmt", arguments);
    if (catchClause) {
    }
    if (finallyBlock) {
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
    super("CatchClause", arguments);
    if (variableDecl) {
    }
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
    super("ThrowStmt", arguments);
  }

  public clone(): this {
    return new ThrowStmt(this.expr.clone()) as this;
  }
}

export class WhileStmt extends BaseStmt<"WhileStmt"> {
  constructor(readonly condition: Expr, readonly block: BlockStmt) {
    super("WhileStmt", arguments);
  }

  public clone(): this {
    return new WhileStmt(this.condition.clone(), this.block.clone()) as this;
  }
}

export class DoStmt extends BaseStmt<"DoStmt"> {
  constructor(readonly block: BlockStmt, readonly condition: Expr) {
    super("DoStmt", arguments);
  }

  public clone(): this {
    return new DoStmt(this.block.clone(), this.condition.clone()) as this;
  }
}

export class LabelledStmt extends BaseStmt<"LabelledStmt"> {
  constructor(readonly label: string, readonly stmt: Stmt) {
    super("LabelledStmt", arguments);
  }

  public clone(): this {
    return new LabelledStmt(this.label, this.stmt.clone()) as this;
  }
}

export class DebuggerStmt extends BaseStmt<"DebuggerStmt"> {
  constructor() {
    super("DebuggerStmt", arguments);
  }
  public clone(): this {
    return new DebuggerStmt() as this;
  }
}

export class SwitchStmt extends BaseStmt<"SwitchStmt"> {
  constructor(readonly clauses: SwitchClause[]) {
    super("SwitchStmt", arguments);
  }

  public clone(): this {
    return new SwitchStmt(this.clauses.map((clause) => clause.clone())) as this;
  }
}

export type SwitchClause = CaseClause | DefaultClause;

export class CaseClause extends BaseStmt<"CaseClause"> {
  constructor(readonly expr: Expr, readonly statements: Stmt[]) {
    super("CaseClause", arguments);
  }
  public clone(): this {
    return new CaseClause(
      this.expr.clone(),
      this.statements.map((stmt) => stmt.clone())
    ) as this;
  }
}

export class DefaultClause extends BaseStmt<"DefaultClause"> {
  constructor(readonly statements: Stmt[]) {
    super("DefaultClause", arguments);
  }
  public clone(): this {
    return new DefaultClause(
      this.statements.map((stmt) => stmt.clone())
    ) as this;
  }
}

export class EmptyStmt extends BaseStmt<"EmptyStmt"> {
  constructor() {
    super("EmptyStmt", arguments);
  }
  public clone(): this {
    return new EmptyStmt() as this;
  }
}

export class WithStmt extends BaseStmt<"WithStmt"> {
  constructor(readonly expr: Expr, readonly stmt: Stmt) {
    super("WithStmt", arguments);
  }

  public clone(): this {
    return new WithStmt(this.expr.clone(), this.stmt.clone()) as this;
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
