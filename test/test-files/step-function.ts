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
new StepFunction(
  stack,
  "const a = input.i + 1; return a;",
  (input: { i: number }) => {
    const a = input.i + 1;
    return a;
  }
);

// supported arithmetic
new StepFunction(stack, "1 + 2", () => 1 + 2);
new StepFunction(stack, "-1", () => -1);
new StepFunction(stack, "(1 + 2)", () => 1 + 2);
new StepFunction(stack, '("hello")', () => "hello");
new StepFunction(stack, '("hello" + " world")', () => "hello" + " world");
new StepFunction(stack, '("hello" + 1)', () => "hello" + 1);
new StepFunction(stack, '(1 + "hello")', () => 1 + "hello");
new StepFunction(stack, '("hello" + true)', () => "hello" + true);
new StepFunction(stack, '(false + "hello")', () => false + "hello");
new StepFunction(stack, '(null + "hello")', () => null + "hello");
new StepFunction(stack, '("hello" + null)', () => "hello" + null);
new StepFunction(
  stack,
  '("hello" + { place: "world" })',
  () => "hello" + { place: "world" }
);
new StepFunction(stack, '("hello" + ["world"])', () => "hello" + ["world"]);

const array = ["world"];
new StepFunction(stack, '("hello" + ref)', () => "hello" + array);

const object = { place: "world" };
new StepFunction(
  stack,
  '("hello" + { place: "world" })',
  () => "hello" + object
);

// Nested

// Supported
new StepFunction(
  stack,
  "test",
  {
    stateMachineName: `aNamedMachine${stack.region + 2}`,
  },
  () => {}
);

// Unsupported - the nested state machine should fail.
new StepFunction(
  stack,
  "test",
  {
    stateMachineName:
      new StepFunction(stack, "tested", (input: { i: number }) => {
        return input.i + 1;
      }).resource.stateMachineName + "-plus",
  },
  () => {}
);
