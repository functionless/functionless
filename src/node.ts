import { Decl } from "./declaration";
import { Err } from "./error";
import { Expr } from "./expression";
import { Stmt } from "./statement";

export type FunctionlessNode = Decl | Expr | Stmt | Err;

export function isNode(a: any): a is Expr {
  return typeof a?.kind === "string";
}

export class BaseNode<Kind extends string> {
  // Expr that contains this one (surrounding scope)
  parent: FunctionlessNode | undefined;
  // Expr that is directly adjacent and above this one (same scope)
  prev: FunctionlessNode | undefined;
  constructor(readonly kind: Kind) {}
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
    kinds.find((kind) => a.kind === kind) !== undefined;
}
