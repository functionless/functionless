import { App, Stack } from "aws-cdk-lib";
import { StepFunction } from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

// arithmetic is not supported by Amazon States Language
new StepFunction(stack, "F", () => 1 + 2);
