import { aws_lambda } from "aws-cdk-lib";
import { Call } from "./expression";
import { synthVTL, VTLContext } from "./vtl";

export type AnyFunction = (...args: any[]) => any;

export function isLambda(a: any): a is Lambda<AnyFunction> {
  return a?.kind === "Lambda";
}

export type AnyLambda = Lambda<AnyFunction>;

export class Lambda<F extends AnyFunction> {
  readonly kind: "Lambda" = "Lambda";

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

    function lambda(call: Call, context: VTLContext): string {
      const payload = Object.entries(call.args)
        .map(([argName, argVal]) => {
          const val = synthVTL(argVal, context);
          return `"${argName}": ${
            val.startsWith("$") ? `$util.toJson(${val})` : val
          }`;
        })
        .join(",\n    ");
      return `{
  "version": "2018-05-29",
  "operation": "Invoke",
  "payload": { 
    ${payload}
  }
}`;
    }
  }
}
export interface Lambda<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F>;
}
