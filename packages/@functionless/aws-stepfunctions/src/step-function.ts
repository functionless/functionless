import type { aws_stepfunctions } from "aws-cdk-lib";

export type StepFunctionHandler<
  In extends Record<string, unknown> = any,
  Out = any
> = (input: In) => Promise<Out>;

export const StepFunctionKind = "fl.StepFunction";

export interface StepFunctionProps
  extends Omit<
    aws_stepfunctions.StateMachineProps,
    "definition" | "stateMachineType"
  > {}

export interface StepFunction<
  F extends StepFunctionHandler = StepFunctionHandler
> {
  (...args: Parameters<F>): ReturnType<F>;

  kind: typeof StepFunctionKind;
  handler: F;
  props?: StepFunctionProps;
}

export function isStepFunction<F extends StepFunctionHandler>(
  decl: any
): decl is StepFunction<F> {
  return decl?.kind === StepFunctionKind;
}

export function StepFunction<F extends StepFunctionHandler>(
  handler: F
): StepFunction<F>;

export function StepFunction<F extends StepFunctionHandler>(
  props: StepFunctionProps,
  handler: F
): StepFunction<F>;

export function StepFunction<F extends StepFunctionHandler>(
  handlerOrProps: F | StepFunctionProps,
  handlerOrUndefined?: F
): StepFunction<F> {
  const handler =
    typeof handlerOrProps === "function" ? handlerOrProps : handlerOrUndefined!;
  const props = typeof handlerOrProps === "object" ? handlerOrProps : undefined;

  async function entrypoint(input: any) {
    handler(input);
    return {
      executionArn: "dummy-arn",
      startDate: new Date(),
    };
  }

  Object.assign(entrypoint, <StepFunction<F>>{
    kind: StepFunctionKind,
    handler,
    props,
  });

  return entrypoint as any;
}

export namespace StepFunction {
  export async function waitSeconds(seconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, seconds * 1000));
  }
}
