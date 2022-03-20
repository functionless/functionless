import { aws_lambda } from "aws-cdk-lib";
import { CallExpr } from "./expression";
import { VTL } from "./vtl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";

export function isFunction(a: any): a is Function {
  return a?.kind === "Function";
}

export type AnyLambda = Function;

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
export class Function<P = undefined, O = void> {
  readonly kind: "Function" = "Function";

  constructor(readonly resource: aws_lambda.IFunction) {
    return Object.assign(lambda, this);

    function lambda(call: CallExpr, vtl: VTL): string {
      // first argument is the payload
      const [payloadKey] = Object.keys(call.args);

      const payload = vtl.eval(call.args[payloadKey]);

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

export interface Function<P = undefined, O = void> {
  (...args: Parameters<ConditionalFunction<P, O>>): ReturnType<
    ConditionalFunction<P, O>
  >;
}
