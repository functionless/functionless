import type * as functionless from "functionless";
import { memoize } from "../memoize";
import Lambda from "aws-sdk/clients/lambda";
import { getEnvironmentVariableName } from "../util";

export type FunctionHandler<In = any, Out = any> = (input: In) => Promise<Out>;

export const LambdaFunctionKind = "fl.Function";

export interface LambdaFunction<F extends FunctionHandler = FunctionHandler> {
  (...args: Parameters<F>): ReturnType<F>;

  kind: typeof LambdaFunctionKind;
  handler: F;
  props: functionless.FunctionProps;
}

export function isLambdaFunction<F extends FunctionHandler>(
  decl: any
): decl is LambdaFunction<F> {
  return decl?.kind === LambdaFunctionKind;
}

const lambdaClient = memoize(() => new Lambda());

// @ts-ignore - this is the public interface for the consumer, the compiler will inject the ID
export function LambdaFunction<F extends (input: any) => Promise<any>>(
  handler: F
): LambdaFunction<F>;

export function LambdaFunction<F extends (input: any) => Promise<any>>(
  props: functionless.FunctionProps,
  handler: F
): LambdaFunction<F>;

export function LambdaFunction(
  handlerOrProps: (input: any) => Promise<any> | functionless.FunctionProps,
  handlerOrUndefined: (input: any) => Promise<any> | undefined,
  /**
   * Injected by the compiler.
   */
  resourceId?: string
) {
  const handler =
    typeof handlerOrUndefined === "function"
      ? handlerOrUndefined
      : handlerOrProps;
  const props = typeof handlerOrProps === "object" ? handlerOrProps : undefined;

  async function func(input: any) {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    if (process.env.RESOURCE_ID === resourceId || process.env.FL_LOCAL) {
      // this Function was invoked, so run its handler path
      return handler(input);
    } else {
      // this function was called from within another Lambda, so invoke it
      return lambdaClient()
        .invoke({
          FunctionName: getFunctionName(),
          Payload: JSON.stringify(input),
        })
        .promise();
    }
  }

  function getFunctionName(): string {
    // eslint-disable-next-line turbo/no-undeclared-env-vars
    return process.env[`${getEnvironmentVariableName(resourceId!)}_NAME`]!;
  }

  Object.assign(func, {
    kind: "fl.Function",
    handler,
    props,
    resourceId,
  });

  return func as any;
}
