import { aws_lambda } from "aws-cdk-lib";
import { AnyFunction } from "./function";
import { Invoke } from "./statement";

export function isLambda(a: any): a is Lambda<AnyFunction> {
  return a?.kind === "Lambda";
}

export type AnyLambda = Lambda<AnyFunction>;

export class Lambda<F extends AnyFunction> {
  readonly kind: "Lambda" = "Lambda";

  constructor(
    readonly resource: aws_lambda.IFunction,
    /**
     * Names of the arguments in order.
     * If this is omitted, then it will be injected by a TS transform.
     */
    readonly args: string[] = []
  ) {
    function lambda(...args: any[]) {
      return new Invoke(
        self,
        "InvokeFunction",
        args.reduce(
          (args, arg, i) => ({
            ...args,
            [self.args[i]]: arg,
          }),
          {}
        )
      );
    }
    const self = Object.assign(lambda, this);
    return self;
  }
}
export interface Lambda<F extends AnyFunction> {
  (...args: Parameters<F>): ReturnType<F>;
}
