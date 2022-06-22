import { App, Stack } from "aws-cdk-lib";
import { StepFunction, Function } from "../../src";

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

// Unsupported - non-awaited promise

const func = new Function<undefined, string>(stack, "func", async () => {
  return "hello";
});

new StepFunction(stack, "no await", async () => {
  const c = func();
  return c;
});

new StepFunction(stack, "deferred await", async () => {
  const c = func();
  const cc = await c;
  return cc;
});

// Supported - Await

new StepFunction(stack, "await", async () => {
  const c = await func();
  return c;
});

new StepFunction(stack, "await return", async () => {
  return func();
});

new StepFunction(stack, "return", async () => {
  return func();
});

// Unsupported - async map without promise all

new StepFunction(stack, "no promise all", async () => {
  return [1, 2].map(async () => func());
});

new StepFunction(stack, "no promise all await", async () => {
  const c = Promise.all([1, 2].map(async () => func()));
  return c;
});
