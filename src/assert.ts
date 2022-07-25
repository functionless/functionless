import { ErrorCodes, SynthError } from "./error-code";
import { FunctionlessNode } from "./node";
import { ConstantValue, PrimitiveValue, isPrimitive } from "./util";

export function assertNever(value: never): never {
  throw new SynthError(
    ErrorCodes.Unexpected_Error,
    `reached unreachable branch with value: ${
      typeof value === "string" ? value : JSON.stringify(value)
    }`
  );
}

export function assertString(value: any, message?: string): string {
  if (typeof value !== "string") {
    throw new Error(message ?? `Expected string, got ${value}`);
  }
  return value;
}

export function assertNumber(value: any, message?: string): number {
  if (typeof value !== "number") {
    throw new Error(message ?? `Expected number, got ${value}`);
  }
  return value;
}

export function assertDefined<T>(
  value?: T,
  message?: string
): Exclude<T, undefined> {
  if (value === undefined) {
    throw new Error(message ?? "Expected value to be present");
  }
  return value as Exclude<T, undefined>;
}

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

export function assertNodeKind<T extends FunctionlessNode>(
  node: FunctionlessNode | undefined,
  kind: T["kind"]
): T {
  if (node?.kind !== kind) {
    throw Error(
      `Expected node of type ${kind} and found ${
        node ? node.kind : "undefined"
      }`
    );
  }
  return <T>node;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
