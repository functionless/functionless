export * from "./synth";

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
