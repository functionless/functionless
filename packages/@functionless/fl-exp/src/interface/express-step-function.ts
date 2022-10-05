import type * as functionless from "functionless";

export type ExpressStepFunctionHandler<
  In extends Record<string, unknown> = any,
  Out = any
> = (input: In) => Promise<Out>;

export const ExpressStepFunctionKind = "fl.ExpressStepFunction";

export interface ExpressStepFunction<
  F extends ExpressStepFunctionHandler = ExpressStepFunctionHandler
> {
  (...args: Parameters<F>): ReturnType<F>;
  kind: typeof ExpressStepFunctionKind;
  handler: F;
  props?: functionless.StepFunctionProps;
}

export function isExpressStepFunction<F extends ExpressStepFunctionHandler>(
  decl: any
): decl is ExpressStepFunction<F> {
  return decl?.kind === ExpressStepFunctionKind;
}

export function ExpressStepFunction<F extends ExpressStepFunctionHandler>(
  handler: F
): ExpressStepFunction<F>;

export function ExpressStepFunction<F extends ExpressStepFunctionHandler>(
  props: functionless.StepFunctionProps,
  handler: F
): ExpressStepFunction<F>;

export function ExpressStepFunction<F extends ExpressStepFunctionHandler>(
  handlerOrProps: F | functionless.StepFunctionProps,
  handlerOrUndefined?: F
): ExpressStepFunction<F> {
  const handler =
    typeof handlerOrProps === "function" ? handlerOrProps : handlerOrUndefined!;
  const props = typeof handlerOrProps === "object" ? handlerOrProps : undefined;
  return <ExpressStepFunction<F>>{
    kind: ExpressStepFunctionKind,
    handler,
    props,
  };
}
