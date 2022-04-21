import { aws_lambda } from "aws-cdk-lib";
import { CallExpr, isVariableReference } from "./expression";
import { isVTL, VTL } from "./vtl";
import { ASL, isASL, Task } from "./asl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";
import { makeCallable } from "./callable";
import { HoistedFunctionDecl, isHoistedFunctionDecl } from "./declaration";
import { Construct } from "constructs";
import { HandleFunction } from "./instrumentor";

export function isFunction<P = any, O = any>(a: any): a is Function<P, O> {
  return a?.kind === "Function";
}

export type AnyLambda = Function<any, any>;

export type FunctionClosure<P, O> = (payload: P) => Promise<O>;

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
  public static readonly FunctionlessType = "Function";
  readonly resource: aws_lambda.IFunction;

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: ConditionalFunction<P, O>;

  constructor(scope: Construct, id: string, func: HoistedFunctionDecl);
  constructor(scope: Construct, id: string, func: FunctionClosure<P, O>);
  constructor(resource: aws_lambda.IFunction);
  constructor(
    resource: aws_lambda.IFunction | Construct,
    id?: string,
    func?: HoistedFunctionDecl | FunctionClosure<P, O>
  ) {
    if (func && id) {
      if (isHoistedFunctionDecl(func)) {
        this.resource = new HandleFunction(resource, id, func.closure).resource;
      } else {
        throw Error(
          "Expected lambda to be passed a compiled function closure or a aws_lambda.IFunction"
        );
      }
    } else {
      this.resource = resource as aws_lambda.IFunction;
    }

    return makeCallable(this, (call: CallExpr, context: VTL | ASL): any => {
      const payloadArg = call.getArgument("payload");

      if (isVTL(context)) {
        const payload = payloadArg?.expr
          ? context.eval(payloadArg.expr)
          : "$null";

        const request = context.var(
          `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
        );
        return context.json(request);
      } else if (isASL(context)) {
        this.resource.grantInvoke(context.role);
        const task: Partial<Task> = {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: this.resource.functionName,
            [`Payload${
              payloadArg?.expr && isVariableReference(payloadArg.expr)
                ? ".$"
                : ""
            }`]: payloadArg ? ASL.toJson(payloadArg.expr) : null,
          },
          ResultSelector: "$.Payload",
        };
        return task;
      } else {
        console.error(`invalid Function call context`, context);
        throw new Error(`invalid Function call context: ${context}`);
      }
    });
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
