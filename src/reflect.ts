import type { Err } from "./error";
import type { FunctionLike } from "./node";
import type { AnyFunction } from "./util";

/**
 * Returns the {@link func}'s AST form as a {@link FunctionLike} data object
 * if the {@link func} instance was registered with {@link associateAST}.
 *
 * If the {@link func} was not registered with {@link associateAST}, then
 * `undefined` is returned.
 */
export function reflect<F extends AnyFunction>(
  func: F
): FunctionLike<F> | Err | undefined {
  return closuresMap.get(func) as FunctionLike<F> | Err | undefined;
}

const globalObj: any = global;

const closuresSymbol = Symbol.for("functionless.closures");

// ensure there is a globally recognized map of closures->AST
const closuresMap: WeakMap<AnyFunction, FunctionLike | Err> = (globalObj[
  closuresSymbol
] = globalObj[closuresSymbol] ?? new WeakMap());

/**
 * Associates the {@link func} with its {@link FunctionLike} {@link ast} form.
 */
export function associateAST<F extends AnyFunction>(
  func: F,
  ast: FunctionLike<F> | Err
): F {
  closuresMap.set(func, ast);
  return func;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
