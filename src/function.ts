import { aws_lambda } from "aws-cdk-lib";
import { CallExpr } from "./expression";
import { VTL } from "./vtl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";

export type AnyFunction = (...args: any[]) => any;

export function isFunction(a: any): a is Function<AnyFunction> {
  return a?.kind === "Function";
}

export type AnyLambda = Function<AnyFunction>;

/**
 * Wraps an {@link aws_lambda.Function} with a type-safe interface that can be
 * called from within an {@link AppsyncResolver}.
 *
 * For example:
 * ```ts
 * const getPerson = new Function<(key: string) => Person>(
 *   new aws_lambda.Function(..)
 * );
 *
 * new AppsyncResolver(() => {
 *   return getPerson("value");
 * })
 * ```
 *
 * Note the explicitly provided function signature, `(key: string) => Person`. This
 * defines the function signature of the Lambda Function. The call, `getPerson("value")`
 * will be translated to a JSON object:
 * ```json
 * {
 *   "operation": "Invoke",
 *   "payload": {
 *     "key": "value"
 *   }
 * }
 * ```
 *
 * Make sure to implement your Lambda Function entry-points accordingly.
 */
export class Function<F extends AnyFunction> {
  readonly kind: "Function" = "Function";

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: F;

  constructor(
    readonly resource: aws_lambda.IFunction,
    /**
     * Names of the arguments in order.
     * If this is omitted, then it will be injected by a TS transform.
     */
    readonly args: string[] = []
  ) {
    return Object.assign(lambda, this);

    function lambda(call: CallExpr, vtl: VTL): string {
      const payload = vtl.var(`{}`);
      for (const [argName, argVal] of Object.entries(call.args)) {
        vtl.qr(`${payload}.put('${argName}', ${vtl.eval(argVal)})`);
      }
      const request = vtl.var(
        `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
      );
      return vtl.json(request);
    }
  }
}
export interface Function<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F>;
}
