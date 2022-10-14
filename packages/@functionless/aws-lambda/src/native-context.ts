import { NativeRuntimeEnvironmentProps } from "./native-runtime-environment";

/**
 * This client is used at runtime. Keep the dependencies to a minimal and analyze the lambda bundles on output.
 */
export interface NativeRuntimeInitializer<T, O> {
  key: T;
  init: (key: string, props?: NativeRuntimeEnvironmentProps) => O;
}
