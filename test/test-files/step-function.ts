import { App, Stack } from "aws-cdk-lib";
import { StepFunction } from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

// unsupported arithmetic
new StepFunction(stack, "input.i + 2", (input: { i: number }) => input.i + 2);
new StepFunction(stack, "input.i - 2", (input: { i: number }) => input.i - 2);
new StepFunction(stack, "input.i * 2", (input: { i: number }) => input.i * 2);
new StepFunction(stack, "input.i / 2", (input: { i: number }) => input.i / 2);
new StepFunction(stack, "-input.i", (input: { i: number }) => -input.i);

// supported arithmetic
new StepFunction(stack, "1 + 2", () => 1 + 2);
new StepFunction(stack, "-1", () => -1);
