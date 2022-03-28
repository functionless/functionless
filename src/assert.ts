import { FunctionlessNode } from "./node";

export function assertNever(value: never): never {
  throw new Error(`reached unreachable branch with value: ${value}`);
}

export function assertNodeKind<T extends FunctionlessNode>(
  node: FunctionlessNode,
  kind: T["kind"]
): T {
  if (node.kind !== kind) {
    throw Error(`Expected node of type ${kind} and found ${node.kind}`);
  }
  return <T>node;
}
