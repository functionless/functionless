import { aws_lambda } from "aws-cdk-lib";
import { CallExpr } from "./expression";
import { VTL } from "./vtl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";

export function isFunction<P = any, O = any>(a: any): a is Function<P, O> {
  return a?.kind === "Function";
}

export type AnyLambda = Function<any, any>;

/**
 * Wraps an {@link aws_lambda.Function} with a type-safe interface that can be
 * called from within an {@link AppsyncResolver}.
 *
 * For example:
 * ```ts
 * const getPerson = new Function<string, Person>(
 *   new aws_lambda.Function(..)
 * );
 *
 * new AppsyncResolver(() => {
 *   return getPerson("value");
 * })
 * ```
 */
export class Function<P, O> {
  readonly kind = "Function" as const;

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: ConditionalFunction<P, O>;

  constructor(readonly resource: aws_lambda.IFunction) {
    return Object.assign(lambda, this);

    function lambda(call: CallExpr, vtl: VTL): string {
      const payloadArg = call.getArgument("payload");
      const payload = payloadArg ? vtl.eval(payloadArg.expr) : "$null";

      const request = vtl.var(
        `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
      );
      return vtl.json(request);
    }
  }
}

type ConditionalFunction<P, O> = P extends undefined
  ? () => O
  : (payload: P) => O;

export interface Function<P, O> {
  (...args: Parameters<ConditionalFunction<P, O>>): ReturnType<
    ConditionalFunction<P, O>
  >;
}
