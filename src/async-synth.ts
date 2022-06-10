import { App } from "aws-cdk-lib";
import { SynthesisOptions } from "aws-cdk-lib/core/lib/private/synthesis";
import { Function } from "./function";

/**
 * Experimental hack that waits for async code in CDK construct instantiation to complete before
 * calling app.synth().
 */
export const asyncSynth = async (app: App, options?: SynthesisOptions) => {
  await new Promise(setImmediate);
  await Promise.allSettled(Function.promises);
  return app.synth(options);
};
