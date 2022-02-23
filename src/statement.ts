import { Environment } from "./environment";
import { BaseExpr, Expr } from "./expression";
import { AnyLambda } from "./lambda";
import { AnyTable } from "./table";

export type Stmt = ExprStmt | Invoke | VariableDecl;

export const isStmt = guard("ExprStmt", "Invoke", "VariableDecl");

export const StmtIndex = Symbol.for("functionless.StmtIndex");

class BaseStmt<Kind extends string> extends BaseExpr<Kind> {
  readonly [StmtIndex]: number;

  constructor(kind: Kind) {
    super(kind);

    this[StmtIndex] = Environment.get().addStatement(this as unknown as Stmt);
  }
}

export const isVariableDecl = guard("VariableDecl");

export class VariableDecl extends BaseStmt<"VariableDecl"> {
  constructor(readonly name: string, readonly expr: Expr) {
    super("VariableDecl");
  }
}

export const isInvoke = guard("Invoke");

export class Invoke<
  Target extends AnyLambda | AnyTable = AnyLambda | AnyTable,
  Payload = any
> extends BaseStmt<"Invoke"> {
  constructor(
    readonly target: Target,
    readonly method: string,
    readonly payload: Payload
  ) {
    super("Invoke");
  }
}

export const isExprStmt = guard("ExprStmt");

export class ExprStmt extends BaseStmt<"ExprStmt"> {
  constructor(readonly expr: Expr) {
    super("ExprStmt");
  }
}

function guard<Kind extends Stmt["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<Stmt, { kind: Kind }> {
  return (a: any): a is Extract<Stmt, { kind: Kind }> =>
    kinds.find((kind) => a.kind === kind) !== undefined;
}
