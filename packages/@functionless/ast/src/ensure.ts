import type { Decl } from "./declaration";
import type { Expr } from "./expression";
import { isDecl, isExpr, isNode, isStmt } from "./guards";
import type { FunctionlessNode } from "./node";
import type { NodeInstance } from "./node-ctor";
import { getNodeKindName, NodeKind } from "./node-kind";
import type { Stmt } from "./statement";

/**
 *
 */
export type Assertion =
  | "undefined"
  | "null"
  | "bigint"
  | "boolean"
  | "number"
  | "string"
  | "function"
  | "Node"
  | "Expr"
  | "Stmt"
  | "Decl"
  | NodeKind;

export type AssertionToInstance<A extends Assertion> = ({
  undefined: undefined;
  null: null;
  boolean: boolean;
  bigint: bigint;
  number: number;
  string: string;
  function: (...args: any[]) => any;
  Node: FunctionlessNode;
  Expr: Expr;
  Stmt: Stmt;
  Decl: Decl;
} & {
  [kind in NodeKind]: NodeInstance<kind>;
})[A];

export function ensureArrayOf<Assert extends Assertion>(
  nodeKind: NodeKind,
  arr: any[],
  fieldName: string,
  assertions: Assert[] | readonly Assert[]
): asserts arr is AssertionToInstance<Assert>[] {
  if (!arr.every((item) => is(item, assertions))) {
    throw new Error(
      `The field '${fieldName}' of a '${getNodeKindName(
        nodeKind
      )}' must be an array of type: ${assertions
        .map((assertion) =>
          typeof assertion === "number" ? getNodeKindName(assertion) : assertion
        )
        .join(", ")}`
    );
  }
}

export function ensure<Assert extends Assertion>(
  nodeKind: NodeKind,
  item: any,
  fieldName: string,
  assertions: Assert[] | readonly Assert[]
): asserts item is AssertionToInstance<Assert> {
  if (!is(item, assertions)) {
    throw new Error(
      `The field '${fieldName}' of a '${getNodeKindName(
        nodeKind
      )}' must be of type: ${assertions
        .map((kind) =>
          typeof kind === "number" ? getNodeKindName(kind) : kind
        )
        .join(", ")}`
    );
  }
}

function is<Assert extends Assertion>(
  item: any,
  assertions: Assert[] | readonly Assert[]
): item is AssertionToInstance<Assert> {
  return assertions.some((assertion) => {
    if (typeof assertion === "string") {
      if (assertion === "undefined") {
        return item === undefined;
      } else if (assertion === "Expr") {
        return isExpr(item);
      } else if (assertion === "Decl") {
        return isDecl(item);
      } else if (assertion === "Stmt") {
        return isStmt(item);
      } else if (assertion === "Node") {
        return isNode(item);
      } else {
        return typeof item === assertion;
      }
    } else {
      return isNode(item) && item.kind === assertion;
    }
  });
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
