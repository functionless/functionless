import type { Expr } from "@functionless/ast";
import type { AnyFunction } from "@functionless/ast";
import type { aws_lambda } from "aws-cdk-lib";
import type { NativeRuntimeEnvironment } from "./native-runtime-environment";

/**
 * Interface to consume to add an Integration to Native Lambda Functions.
 *
 * ```ts
 * new Function(this, 'func', () => {
 *    mySpecialIntegration()
 * })
 *
 * const mySpecialIntegration = makeIntegration<() => void>({
 *    native: {...} // an instance of NativeIntegration
 * })
 * ```
 */
export interface NativeIntegration<Func extends AnyFunction> {
  /**
   * Called by any {@link Function} that will invoke this integration during CDK Synthesis.
   * Add permissions, create connecting resources, validate.
   *
   * @param context - The function invoking this function.
   * @param args - The functionless encoded AST form of the arguments passed to the integration.
   */
  bind: (context: aws_lambda.IFunction, args: Expr[]) => void;
  /**
   * @param args The arguments passed to the integration function by the user.
   * @param preWarmContext contains singleton instances of client and other objects initialized outside of the native
   *                       function handler.
   */
  call: (
    args: Parameters<Func>,
    preWarmContext: NativeRuntimeEnvironment
  ) => ReturnType<Func>;
  /**
   * Method called outside of the handler to initialize things like the PreWarmContext
   */
  preWarm?: (preWarmContext: NativeRuntimeEnvironment) => void;
}
