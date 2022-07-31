import { FunctionLike } from "./declaration";
import { Err } from "./error";
import { AnyAsyncFunction, AnyFunction } from "./util";

/**
 * A macro (compile-time) function that converts an ArrowFunction or FunctionExpression to a {@link FunctionDecl}.
 *
 * Use this function to quickly grab the {@link FunctionDecl} (AST) representation of TypeScript syntax and
 * then perform interpretations of that representation.
 *
 * Valid uses  include an in-line ArrowFunction or FunctionExpression:
 * ```ts
 * const decl1 = reflect((arg: string) => {})
 * const decl2 = reflect(function (arg: string) {})
 * ```
 *
 * Illegal uses include references to functions or computed functions:
 * ```ts
 * const functionRef = () => {}
 * const decl1 = reflect(functionRef)
 *
 * function computeFunction() {
 *   return () => "hello"
 * }
 * const decl2 = reflect(computeFunction())
 * ```
 *
 * @param func an in-line ArrowFunction or FunctionExpression. It must be in-line and cannot reference
 *             a variable or a computed function/closure.
 */
export function reflect<F extends AnyFunction | AnyAsyncFunction>(
  func: F
): FunctionLike<F> | Err | undefined {
  if (func.name.startsWith("bound ")) {
    // native bound function
    const targetFunc = (<any>func)[ReflectionSymbols.TargetFunction];
    if (targetFunc) {
      return reflect(targetFunc);
    } else {
      throw new Error(
        `bound function not compiled with Functionless, cannot introspect on its form`
      );
    }
  }

  return (<any>func)[ReflectionSymbols.AST]?.() as
    | FunctionLike<F>
    | Err
    | undefined;
}

const Global: any = global;

// @ts-ignore
const reflectCache: WeakMap<Function, FunctionLike | Err> = (Global[
  Symbol.for("functionless:Reflect")
] = Global[Symbol.for("functionless:Reflect")] ?? new WeakMap());

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;

export const ReflectionSymbolNames = {
  AST: "functionless:AST",
  BoundThis: "functionless:BoundThis",
  BoundArgs: "functionless:BoundArgs",
  TargetFunction: "functionless:TargetFunction",
} as const;

export const ReflectionSymbols = {
  AST: Symbol.for(ReflectionSymbolNames.AST),
  BoundThis: Symbol.for(ReflectionSymbolNames.BoundThis),
  BoundArgs: Symbol.for(ReflectionSymbolNames.BoundArgs),
  TargetFunction: Symbol.for(ReflectionSymbolNames.TargetFunction),
} as const;
