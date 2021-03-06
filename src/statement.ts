import type {
  FunctionDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import { Expr, FunctionExpr, Identifier } from "./expression";
import { isTryStmt } from "./guards";
import { BaseNode, FunctionlessNode } from "./node";
import { NodeKind } from "./node-kind";

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
  Kind extends NodeKind,
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

export class ExprStmt extends BaseStmt<NodeKind.ExprStmt> {
  constructor(readonly expr: Expr) {
    super(NodeKind.ExprStmt, arguments);
  }

  public clone(): this {
    return new ExprStmt(this.expr.clone()) as this;
  }
}

export class VariableStmt extends BaseStmt<NodeKind.VariableStmt> {
  constructor(readonly declList: VariableDeclList) {
    super(NodeKind.VariableStmt, arguments);
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

export class BlockStmt extends BaseStmt<NodeKind.BlockStmt, BlockStmtParent> {
  constructor(readonly statements: Stmt[]) {
    super(NodeKind.BlockStmt, arguments);
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

export class ReturnStmt extends BaseStmt<NodeKind.ReturnStmt> {
  constructor(readonly expr: Expr) {
    super(NodeKind.ReturnStmt, arguments);
  }

  public clone(): this {
    return new ReturnStmt(this.expr.clone()) as this;
  }
}

export class IfStmt extends BaseStmt<NodeKind.IfStmt> {
  constructor(readonly when: Expr, readonly then: Stmt, readonly _else?: Stmt) {
    super(NodeKind.IfStmt, arguments);
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

export class ForOfStmt extends BaseStmt<NodeKind.ForOfStmt> {
  constructor(
    readonly initializer: VariableDecl | Identifier,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super(NodeKind.ForOfStmt, arguments);
  }

  public clone(): this {
    return new ForOfStmt(
      this.initializer.clone(),
      this.expr.clone(),
      this.body.clone()
    ) as this;
  }
}

export class ForInStmt extends BaseStmt<NodeKind.ForInStmt> {
  constructor(
    readonly initializer: VariableDecl | Identifier,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super(NodeKind.ForInStmt, arguments);
  }

  public clone(): this {
    return new ForInStmt(
      this.initializer.clone(),
      this.expr.clone(),
      this.body.clone()
    ) as this;
  }
}

export class ForStmt extends BaseStmt<NodeKind.ForStmt> {
  constructor(
    readonly body: BlockStmt,
    readonly initializer?: VariableDeclList | Expr,
    readonly condition?: Expr,
    readonly incrementor?: Expr
  ) {
    super(NodeKind.ForStmt, arguments);
    // validate
  }

  public clone(): this {
    return new ForStmt(
      this.body.clone(),
      this.initializer?.clone(),
      this.condition?.clone(),
      this.incrementor?.clone()
    ) as this;
  }
}

export class BreakStmt extends BaseStmt<NodeKind.BreakStmt> {
  constructor() {
    super(NodeKind.BreakStmt, arguments);
  }

  public clone(): this {
    return new BreakStmt() as this;
  }
}

export class ContinueStmt extends BaseStmt<NodeKind.ContinueStmt> {
  constructor() {
    super(NodeKind.ContinueStmt, arguments);
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

export class TryStmt extends BaseStmt<NodeKind.TryStmt> {
  constructor(
    readonly tryBlock: BlockStmt,
    readonly catchClause?: CatchClause,
    readonly finallyBlock?: FinallyBlock
  ) {
    super(NodeKind.TryStmt, arguments);
    this.ensure(tryBlock, "tryBlock", [NodeKind.BlockStmt]);
    this.ensure(catchClause, "catchClause", [
      "undefined",
      NodeKind.CatchClause,
    ]);
    this.ensure(finallyBlock, "finallyBlock", [
      "undefined",
      NodeKind.BlockStmt,
    ]);
  }
}

export class CatchClause extends BaseStmt<NodeKind.CatchClause, TryStmt> {
  constructor(
    readonly variableDecl: VariableDecl | undefined,
    readonly block: BlockStmt
  ) {
    super(NodeKind.CatchClause, arguments);
    this.ensure(variableDecl, "variableDecl", [
      "undefined",
      NodeKind.VariableDecl,
    ]);
    this.ensure(block, "block", [NodeKind.BlockStmt]);
  }
}

export class ThrowStmt extends BaseStmt<NodeKind.ThrowStmt> {
  constructor(readonly expr: Expr) {
    super(NodeKind.ThrowStmt, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class WhileStmt extends BaseStmt<NodeKind.WhileStmt> {
  constructor(readonly condition: Expr, readonly block: BlockStmt) {
    super(NodeKind.WhileStmt, arguments);
    this.ensure(condition, "condition", ["Expr"]);
    this.ensure(block, "block", [NodeKind.BlockStmt]);
  }
}

export class DoStmt extends BaseStmt<NodeKind.DoStmt> {
  constructor(readonly block: BlockStmt, readonly condition: Expr) {
    super(NodeKind.DoStmt, arguments);
    this.ensure(block, "block", [NodeKind.BlockStmt]);
    this.ensure(condition, "condition", ["Expr"]);
  }
}

export class LabelledStmt extends BaseStmt<NodeKind.LabelledStmt> {
  constructor(readonly label: string, readonly stmt: Stmt) {
    super(NodeKind.LabelledStmt, arguments);
    this.ensure(label, "label", ["string"]);
    this.ensure(stmt, "stmt", ["Stmt"]);
  }
}

export class DebuggerStmt extends BaseStmt<NodeKind.DebuggerStmt> {
  constructor() {
    super(NodeKind.DebuggerStmt, arguments);
  }
}

export class SwitchStmt extends BaseStmt<NodeKind.SwitchStmt> {
  constructor(readonly clauses: SwitchClause[]) {
    super(NodeKind.SwitchStmt, arguments);
    this.ensureArrayOf(clauses, "clauses", NodeKind.SwitchClause);
  }
}

export type SwitchClause = CaseClause | DefaultClause;

export class CaseClause extends BaseStmt<NodeKind.CaseClause> {
  constructor(readonly expr: Expr, readonly statements: Stmt[]) {
    super(NodeKind.CaseClause, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensureArrayOf(statements, "statements", ["Stmt"]);
  }
}

export class DefaultClause extends BaseStmt<NodeKind.DefaultClause> {
  constructor(readonly statements: Stmt[]) {
    super(NodeKind.DefaultClause, arguments);
    this.ensureArrayOf(statements, "statements", ["Stmt"]);
  }
}

export class EmptyStmt extends BaseStmt<NodeKind.EmptyStmt> {
  constructor() {
    super(NodeKind.EmptyStmt, arguments);
  }
}

export class WithStmt extends BaseStmt<NodeKind.WithStmt> {
  constructor(readonly expr: Expr, readonly stmt: Stmt) {
    super(NodeKind.WithStmt, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensure(stmt, "stmt", ["Stmt"]);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
