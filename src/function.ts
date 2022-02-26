import { aws_lambda } from "aws-cdk-lib";
import { Call } from "./expression";
import { VTL } from "./vtl";

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

    function lambda(call: Call, vtl: VTL): string {
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
export interface Lambda<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F>;
}
