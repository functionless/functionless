import { Decl } from "./declaration";
import { Expr } from "./expression";
import { Stmt } from "./statement";

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
      throw new Error(`expected `);
    }
    return this as any;
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
