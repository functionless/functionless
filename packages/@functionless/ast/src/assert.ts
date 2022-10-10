import { FunctionlessNode } from "./node";
import { NodeInstance } from "./node-ctor";
import { getNodeKindName, NodeKind } from "./node-kind";
import { ConstantValue, isPrimitive, PrimitiveValue } from "./util";

export function assertPrimitive(val: any, message?: string): PrimitiveValue {
  if (isPrimitive(val)) {
    return val;
  }

  throw Error(
    message ?? `Expected value to be a primitve, found ${typeof val}`
  );
}

export function assertConstantValue(val: any, message?: string): ConstantValue {
  if (isPrimitive(val)) {
    return val;
  } else if (typeof val === "object") {
    if (Array.isArray(val)) {
      return val.map((i) => assertConstantValue(i));
    } else {
      return Object.entries(val).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: assertConstantValue(value),
        }),
        {}
      );
    }
  }

  throw Error(
    message ?? `Expected value to be a constant, found ${typeof val}`
  );
}

export function assertNodeKind<Kind extends NodeKind[]>(
  node: FunctionlessNode | undefined,
  ...kinds: Kind
): NodeInstance<Kind[number]> {
  if (node) {
    for (const kind of kinds) {
      if (node?.kind === kind) {
        return <NodeInstance<Kind[number]>>node;
      }
    }
  }
  throw Error(
    `Expected node of type ${kinds.map(getNodeKindName).join(", ")} and found ${
      node ? getNodeKindName(node.kind) : "undefined"
    }`
  );
}
