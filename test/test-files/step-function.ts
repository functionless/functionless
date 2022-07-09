import { GraphqlApi } from "@aws-cdk/aws-appsync-alpha";
import { App, aws_events, Stack } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import {
  StepFunction,
  Function,
  EventBus,
  AppsyncResolver,
  $AWS,
  Table,
} from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

const table = new Table<{ id: string }, "id">(stack, "table", {
  partitionKey: {
    name: "id",
    type: AttributeType.STRING,
  },
});

const func = new Function<undefined, string>(stack, "func", async () => {
  return "hello";
});

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

new StepFunction(stack, "no await", async () => {
  const c = func();
  return c;
});

new StepFunction(stack, "deferred await", async () => {
  const c = func();
  const cc = await c;
  return cc;
});

new StepFunction(stack, "promise then", async () => {
  return func().then((x) => x);
});

new StepFunction(stack, "promise catch", async () => {
  return func().catch((x) => x);
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

new StepFunction(stack, "return", async () => func());

// Unsupported - async map without promise all

new StepFunction(stack, "no promise all", async () => {
  return [1, 2].map(async () => func());
});

new StepFunction(stack, "no promise all await", async () => {
  const c = Promise.all([1, 2].map(async () => func()));
  return c;
});

new StepFunction(stack, "promise all only on promise array", async () => {
  const c = [1, 2];
  return Promise.all(c);
});

// unsupported - new resources in closure

new StepFunction(stack, "new step function", async () => {
  new StepFunction(stack, "", () => {});
});

new StepFunction(stack, "new function", async () => {
  new Function(stack, "", async () => {});
});

new StepFunction(stack, "new bus", async () => {
  new EventBus(stack, "");
});

new StepFunction(stack, "new resolver", async () => {
  new AppsyncResolver(
    stack,
    "",
    {
      api: new GraphqlApi(stack, "", { name: "api" }),
      typeName: "type",
      fieldName: "field",
    },
    () => {}
  );
});

new StepFunction(stack, "cdk resource", () => {
  new aws_events.EventBus(stack, "");
});

// unsupported object references in $AWS calls

new StepFunction(stack, "obj ref", async () => {
  const event = {
    Table: table,
    Key: {
      id: { S: "sas" },
    },
  };

  await $AWS.DynamoDB.GetItem(event);
});

new StepFunction(stack, "obj ref", async () => {
  const event = {
    Function: func,
    Payload: undefined,
  };

  await $AWS.Lambda.Invoke(event);
});

// supported - object literal in $AWS calls

new StepFunction(stack, "obj ref", async () => {
  await $AWS.DynamoDB.GetItem({
    Table: table,
    Key: {
      id: { S: "sas" },
    },
  });
});

new StepFunction(stack, "obj ref", async () => {
  await $AWS.Lambda.Invoke({
    Function: func,
    Payload: undefined,
  });
});

// unsupported - cannot find reference to integration outside of scope.

new StepFunction(stack, "obj ref", async () => {
  const getIntegration = (): typeof func => {
    return func;
  };
  const x = getIntegration();
  await x();
});
