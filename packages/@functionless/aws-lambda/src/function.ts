import type { aws_lambda } from "aws-cdk-lib";
import { NativeRuntimeEnvironmentProps } from "./native-runtime-environment";

export type FunctionHandler<In = any, Out = any> = (input: In) => Promise<Out>;

export const LambdaFunctionKind = "fl.Function";

export interface LambdaFunction<F extends FunctionHandler = FunctionHandler> {
  (...args: Parameters<F>): ReturnType<F>;

  kind: typeof LambdaFunctionKind;
  handler: F;
  props?: FunctionProps;
}

export function isLambdaFunction<F extends FunctionHandler>(
  decl: any
): decl is LambdaFunction<F> {
  return decl?.kind === LambdaFunctionKind;
}

export interface FunctionProps
  extends Omit<
    aws_lambda.FunctionProps,
    "code" | "handler" | "runtime" | "onSuccess" | "onFailure"
  > {
  /**
   * Whether to generate source maps for serialized closures and
   * to set --enableSourceMaps on NODE_OPTIONS environment variable.
   *
   * Only supported when using {@link SerializerImpl.V2}.
   *
   * @default true
   */
  sourceMaps?: boolean;
  /**
   * Method which allows runtime computation of AWS client configuration.
   * ```ts
   * new Lambda(clientConfigRetriever('LAMBDA'))
   * ```
   *
   * @param clientName optionally return a different client config based on the {@link ClientName}.
   *
   */
  clientConfigRetriever?: NativeRuntimeEnvironmentProps["clientConfigRetriever"];
}

// @ts-ignore - this is the public interface for the consumer, the compiler will inject the ID
export function LambdaFunction<F extends (input: any) => Promise<any>>(
  handler: F
): LambdaFunction<F>;

export function LambdaFunction<F extends (input: any) => Promise<any>>(
  props: FunctionProps,
  handler: F
): LambdaFunction<F>;

export function LambdaFunction(
  handlerOrProps: (input: any) => Promise<any> | FunctionProps,
  handlerOrUndefined: (input: any) => Promise<any> | undefined
) {
  const handler =
    typeof handlerOrUndefined === "function"
      ? handlerOrUndefined
      : handlerOrProps;
  const props = typeof handlerOrProps === "object" ? handlerOrProps : undefined;

  const resource = (input: any) => handler(input);

  Object.assign(resource, {
    kind: LambdaFunctionKind,
    handler,
    props,
  });

  return resource;
}
