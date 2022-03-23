import type { Decl } from "./declaration";
import type { Expr } from "./expression";
import type { CatchClause, Stmt } from "./statement";

export type FunctionlessNode = Decl | Expr | Stmt;

export function isNode(a: any): a is Expr {
  return typeof a?.kind === "string";
}

export class BaseNode<Kind extends string> {
  /**
   * Node that contains this one (surrounding scope).
   */
  parent: FunctionlessNode | undefined;

  constructor(readonly kind: Kind) {}

  public as<K extends FunctionlessNode["kind"]>(
    kind: K
  ): Extract<this, { kind: K }> {
    // @ts-ignore
    if (this.kind !== kind) {
      throw new Error(`expected to be a ${kind} but was ${this.kind}`);
    }
    return this as any;
  }

  public findNearestParent<K extends FunctionlessNode["kind"]>(
    kind: K
  ): Extract<FunctionlessNode, { kind: K }> | undefined {
    if (this.parent?.kind === kind) {
      return this.parent as Extract<FunctionlessNode, { kind: K }>;
    } else {
      return this.parent?.findNearestParent(kind);
    }
  }

  /**
   * Finds the {@link CatchClause} that this Node should throw to.
   */
  public findThrowCatchClause(): CatchClause | undefined {
    const scope = this.parent;
    if (scope === undefined) {
      return undefined;
    } else if (scope.kind === "TryStmt") {
      return scope.catchClause;
    } else if (scope.kind === "CatchClause") {
      // skip the try-block
      return scope.parent.findThrowCatchClause();
    } else {
      return scope.findThrowCatchClause();
    }
  }
}

export function setParent(
  parent: FunctionlessNode,
  value: BaseNode<string> | BaseNode<string>[]
) {
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

// generates type guards
export function typeGuard<Kind extends FunctionlessNode["kind"]>(
  ...kinds: Kind[]
): (a: any) => a is Extract<FunctionlessNode, { kind: Kind }> {
  return (a: any): a is Extract<FunctionlessNode, { kind: Kind }> =>
    kinds.find((kind) => a?.kind === kind) !== undefined;
}
