import { aws_lambda } from "aws-cdk-lib";
import { CallExpr, isVariableReference } from "./expression";
import { VTL } from "./vtl";
import { ASL } from "./asl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";
import { IntegrationHandler } from "./integration";

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
export class Function<P, O> implements IntegrationHandler {
  readonly kind = "Function" as const;

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: ConditionalFunction<P, O>;

  constructor(readonly resource: aws_lambda.IFunction) {}

  vtl(call: CallExpr, context: VTL) {
    const payloadArg = call.getArgument("payload");
    const payload = payloadArg?.expr ? context.eval(payloadArg.expr) : "$null";

    const request = context.var(
      `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
    );
    return context.json(request);
  }

  asl(call: CallExpr, context: ASL) {
    const payloadArg = call.getArgument("payload");
    this.resource.grantInvoke(context.role);
    return {
      Type: "Task" as const,
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: this.resource.functionName,
        [`Payload${
          payloadArg?.expr && isVariableReference(payloadArg.expr) ? ".$" : ""
        }`]: payloadArg ? ASL.toJson(payloadArg.expr) : null,
      },
      ResultSelector: "$.Payload",
    };
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
