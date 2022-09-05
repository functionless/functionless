import type {
  FunctionDecl,
  VariableDecl,
  VariableDeclList,
} from "./declaration";
import { Expr, FunctionExpr, Identifier } from "./expression";
import { isTryStmt } from "./guards";
import { BaseNode, FunctionlessNode } from "./node";
import { NodeKind } from "./node-kind";
import { Span } from "./span";

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
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.ExprStmt, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class VariableStmt extends BaseStmt<NodeKind.VariableStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly declList: VariableDeclList
  ) {
    super(NodeKind.VariableStmt, span, arguments);
    this.ensure(declList, "declList", [NodeKind.VariableDeclList]);
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
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly statements: Stmt[]
  ) {
    super(NodeKind.BlockStmt, span, arguments);
    this.ensureArrayOf(statements, "statements", [
      "Stmt",
      NodeKind.FunctionDecl,
      NodeKind.ClassDecl,
    ]);
    statements.forEach((stmt, i) => {
      stmt.prev = i > 0 ? statements[i - 1] : undefined;
      stmt.next = i + 1 < statements.length ? statements[i + 1] : undefined;
    });
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
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr | undefined
  ) {
    super(NodeKind.ReturnStmt, span, arguments);
    this.ensure(expr, "expr", ["undefined", "Expr"]);
  }
}

export class IfStmt extends BaseStmt<NodeKind.IfStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly when: Expr,
    readonly then: Stmt,
    readonly _else?: Stmt
  ) {
    super(NodeKind.IfStmt, span, arguments);
    this.ensure(when, "when", ["Expr"]);
    this.ensure(then, "then", ["Stmt"]);
    this.ensure(_else, "else", ["undefined", "Stmt"]);
  }
}

export class ForOfStmt extends BaseStmt<NodeKind.ForOfStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly initializer: VariableDecl | Identifier,
    readonly expr: Expr,
    readonly body: BlockStmt,
    /**
     * Whether this is a for-await-of statement
     * ```ts
     * for await (const a of b) { .. }
     * ```
     */
    readonly isAwait: boolean
  ) {
    super(NodeKind.ForOfStmt, span, arguments);
    this.ensure(initializer, "initializer", [
      NodeKind.VariableDecl,
      NodeKind.Identifier,
    ]);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensure(isAwait, "isAwait", ["boolean"]);
  }
}

export class ForInStmt extends BaseStmt<NodeKind.ForInStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly initializer: VariableDecl | Identifier,
    readonly expr: Expr,
    readonly body: BlockStmt
  ) {
    super(NodeKind.ForInStmt, span, arguments);
  }
}

export class ForStmt extends BaseStmt<NodeKind.ForStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly body: BlockStmt,
    readonly initializer?: VariableDeclList | Expr,
    readonly condition?: Expr,
    readonly incrementor?: Expr
  ) {
    super(NodeKind.ForStmt, span, arguments);
    this.ensure(body, "body", [NodeKind.BlockStmt]);
    this.ensure(initializer, "initializer", [
      "undefined",
      "Expr",
      NodeKind.VariableDeclList,
    ]);
    this.ensure(condition, "condition", ["undefined", "Expr"]);
    this.ensure(incrementor, "incrementor", ["undefined", "Expr"]);
  }
}

export class BreakStmt extends BaseStmt<NodeKind.BreakStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly label?: Identifier
  ) {
    super(NodeKind.BreakStmt, span, arguments);
    this.ensure(label, "label", ["undefined", NodeKind.Identifier]);
  }
}

export class ContinueStmt extends BaseStmt<NodeKind.ContinueStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly label?: Identifier
  ) {
    super(NodeKind.ContinueStmt, span, arguments);
    this.ensure(label, "label", ["undefined", NodeKind.Identifier]);
  }
}

export interface FinallyBlock extends BlockStmt {
  parent: TryStmt & {
    finallyBlock: FinallyBlock;
  };
}

export class TryStmt extends BaseStmt<NodeKind.TryStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly tryBlock: BlockStmt,
    readonly catchClause?: CatchClause,
    readonly finallyBlock?: FinallyBlock
  ) {
    super(NodeKind.TryStmt, span, arguments);
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
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly variableDecl: VariableDecl | undefined,
    readonly block: BlockStmt
  ) {
    super(NodeKind.CatchClause, span, arguments);
    this.ensure(variableDecl, "variableDecl", [
      "undefined",
      NodeKind.VariableDecl,
    ]);
    this.ensure(block, "block", [NodeKind.BlockStmt]);
  }
}

export class ThrowStmt extends BaseStmt<NodeKind.ThrowStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr
  ) {
    super(NodeKind.ThrowStmt, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
  }
}

export class WhileStmt extends BaseStmt<NodeKind.WhileStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly condition: Expr,
    readonly block: BlockStmt
  ) {
    super(NodeKind.WhileStmt, span, arguments);
    this.ensure(condition, "condition", ["Expr"]);
    this.ensure(block, "block", [NodeKind.BlockStmt]);
  }
}

export class DoStmt extends BaseStmt<NodeKind.DoStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly block: BlockStmt,
    readonly condition: Expr
  ) {
    super(NodeKind.DoStmt, span, arguments);
    this.ensure(block, "block", [NodeKind.BlockStmt]);
    this.ensure(condition, "condition", ["Expr"]);
  }
}

export class LabelledStmt extends BaseStmt<NodeKind.LabelledStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly label: Identifier,
    readonly stmt: Stmt
  ) {
    super(NodeKind.LabelledStmt, span, arguments);
    this.ensure(label, "label", [NodeKind.Identifier]);
    this.ensure(stmt, "stmt", ["Stmt"]);
  }
}

export class DebuggerStmt extends BaseStmt<NodeKind.DebuggerStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span
  ) {
    super(NodeKind.DebuggerStmt, span, arguments);
  }
}

export class SwitchStmt extends BaseStmt<NodeKind.SwitchStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr,
    readonly clauses: SwitchClause[]
  ) {
    super(NodeKind.SwitchStmt, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensureArrayOf(clauses, "clauses", NodeKind.SwitchClause);
  }
}

export type SwitchClause = CaseClause | DefaultClause;

export class CaseClause extends BaseStmt<NodeKind.CaseClause> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr,
    readonly statements: Stmt[]
  ) {
    super(NodeKind.CaseClause, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensureArrayOf(statements, "statements", ["Stmt"]);
  }
}

export class DefaultClause extends BaseStmt<NodeKind.DefaultClause> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly statements: Stmt[]
  ) {
    super(NodeKind.DefaultClause, span, arguments);
    this.ensureArrayOf(statements, "statements", ["Stmt"]);
  }
}

export class EmptyStmt extends BaseStmt<NodeKind.EmptyStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span
  ) {
    super(NodeKind.EmptyStmt, span, arguments);
  }
}

export class WithStmt extends BaseStmt<NodeKind.WithStmt> {
  constructor(
    /**
     * Range of text in the source file where this Node resides.
     */
    span: Span,
    readonly expr: Expr,
    readonly stmt: Stmt
  ) {
    super(NodeKind.WithStmt, span, arguments);
    this.ensure(expr, "expr", ["Expr"]);
    this.ensure(stmt, "stmt", ["Stmt"]);
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
