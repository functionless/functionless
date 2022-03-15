import { aws_lambda } from "aws-cdk-lib";
import { CallExpr, isLiteralExpr } from "./expression";
import { isVTL, VTL } from "./vtl";
import { ASL, isASL, Task } from "./asl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";
import { makeCallable } from "./callable";

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

  constructor(readonly resource: aws_lambda.IFunction) {
    return makeCallable(this, (call: CallExpr, context: VTL | ASL): any => {
      if (isVTL(context)) {
        const payload = context.var(`{}`);
        for (const [argName, argVal] of Object.entries(call.args)) {
          context.qr(`${payload}.put('${argName}', ${context.eval(argVal)})`);
        }
        const request = context.var(
          `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
        );
        return context.json(request);
      } else if (isASL(context)) {
        this.resource.grantInvoke(context.role);
        const task: Partial<Task> = {
          Type: "Task",
          Resource: this.resource.functionArn,
          Parameters: Object.entries(call.args).reduce(
            (args, [argName, argExpr]) => ({
              ...args,
              [`${argName}${isLiteralExpr(argExpr) ? "" : ".$"}`]:
                context.evalJson(argExpr!),
            }),
            {}
          ),
        };
        return task;
      } else {
        console.error(`invalid Function call context`, context);
        throw new Error(`invalid Function call context: ${context}`);
      }
    });
  }
}
export interface Function<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F>;
}
