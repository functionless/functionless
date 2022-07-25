import { GraphqlApi } from "@aws-cdk/aws-appsync-alpha";
import { App, aws_events, Stack } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import {
  StepFunction,
  Function,
  EventBus,
  // @ts-ignore - for ts-docs
  ErrorCodes,
  AppsyncResolver,
  $AWS,
  Table,
} from "../../src";
import { Event } from "../../src/event-bridge";
import { PutEventInput } from "../../src/event-bridge/event-bus";

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
new StepFunction(stack, "input.i % 2", (input: { i: number }) => input.i % 2);
new StepFunction(
  stack,
  "input.i += 2",
  (input: { i: number }) => (input.i += 2)
);
new StepFunction(
  stack,
  "input.i *= 2",
  (input: { i: number }) => (input.i *= 2)
);
new StepFunction(
  stack,
  "input.i -= 2",
  (input: { i: number }) => (input.i -= 2)
);
new StepFunction(
  stack,
  "input.i /= 2",
  (input: { i: number }) => (input.i /= 2)
);
new StepFunction(
  stack,
  "input.i %= 2",
  (input: { i: number }) => (input.i %= 2)
);
new StepFunction(stack, "input.i++", (input: { i: number }) => input.i++);
new StepFunction(stack, "++input.i", (input: { i: number }) => ++input.i);
new StepFunction(stack, "input.i--", (input: { i: number }) => input.i--);
new StepFunction(stack, "--input.i", (input: { i: number }) => --input.i);
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
new StepFunction(stack, "11 % 2", () => 11 % 2);
new StepFunction(stack, "-1", () => -1);
new StepFunction(stack, "(1 + 2)", () => 1 + 2);
new StepFunction(stack, '!"hello"', () => !"hello");
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

/**
 * Unsupported - Event bus putEvent non-object literal
 */
const bus = new EventBus(stack, "bus");
new StepFunction(stack, "usebus", async () => {
  const event: PutEventInput<Event<{}>> = {
    source: "",
    detail: {},
    "detail-type": "",
  };
  await bus.putEvents(event);
});

new StepFunction(stack, "usebus", async () => {
  const events: PutEventInput<Event<{}>>[] = [
    { source: "", detail: {}, "detail-type": "" },
  ];
  await bus.putEvents({ source: "", detail: {}, "detail-type": "" }, ...events);
});

new StepFunction(stack, "usebus", async () => {
  const event: PutEventInput<Event<{}>> = {
    source: "",
    detail: {},
    "detail-type": "",
  };
  await bus.putEvents({ ...event });
});

new StepFunction(stack, "usebus", async () => {
  const source = "source";
  await bus.putEvents({ [source]: "", detail: {}, "detail-type": "" });
});

new StepFunction(stack, "usebus", async () => {
  const source = "source";
  await bus.putEvents(
    { source: "", detail: {}, "detail-type": "" },
    { [source]: "", detail: {}, "detail-type": "" }
  );
});

/**
 * Supported
 */

new StepFunction(stack, "usebus", async () => {
  await bus.putEvents({ "detail-type": "", source: "", detail: {} });
});

/**
 * Unsupported - non-constant error arguments
 */

new StepFunction<{ arg: string }, void>(stack, "error", async (input) => {
  throw Error(input.arg);
});

/**
 * Support - constant error arguments
 */

new StepFunction(stack, "error", async () => {
  throw Error("arg");
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

// support reference from surrounding class

export class MyClass {
  readonly func2: Function<string, string>;

  constructor(readonly func: Function<string, string>) {
    this.func2 = func;

    new StepFunction(stack, "sfn", async () => {
      await this.func("");
      await this.func2("");
    });
  }
}

/**
 * Unsupported
 * 10022 - Step Functions does not support undefined assignment
 * @see ErrorCodes.Step_Functions_does_not_support_undefined_assignment
 */

const funcUndefined = new Function<undefined, undefined>(
  stack,
  "func",
  async () => {
    return undefined;
  }
);

new StepFunction(stack, "undefined", async () => {
  const x = undefined;
  return x;
});

new StepFunction(stack, "obj lit", async () => {
  const x = { y: undefined };
  return x;
});

new StepFunction(stack, "task", async () => {
  const x = await funcUndefined();
  return x;
});

new StepFunction(stack, "arr", async () => {
  return [undefined];
});

new StepFunction(stack, "ternary", async () => {
  return true ? undefined : func();
});

new StepFunction(stack, "ternary task", async () => {
  return true ? funcUndefined() : func();
});

new StepFunction(stack, "obj lit task", async () => {
  return { y: await funcUndefined() };
});

/**
 * Supported - workarounds
 * 10022 - Step Functions does not support undefined assignment
 * @see ErrorCodes.Step_Functions_does_not_support_undefined_assignment
 */

new StepFunction(stack, "obj ref", async () => {
  const x = null;
  return x;
});

new StepFunction(stack, "obj ref", async () => {
  const x = { y: null };
  return x;
});

new StepFunction(stack, "obj ref", async () => {
  const x = (await funcUndefined()) ?? null;
  return x;
});

/**
 * Unsupported
 * 10025 - Step Functions invalid collection access
 * @see ErrorCodes.StepFunctions_Invalid_collection_access
 */

new StepFunction(stack, "obj ref", async (input: { n: number }) => {
  const arr = [1, 2, 3];
  return arr[input.n];
});

new StepFunction(stack, "obj ref", async (input: { key: string }) => {
  const obj = { a: "" } as Record<string, any>;
  return obj[input.key];
});

/**
 * Supported - workarounds
 * 10025 - Step Functions invalid collection access
 * @see ErrorCodes.StepFunctions_Invalid_collection_access
 */

const arrayAccessFunc = new Function<
  { arr: number[]; n: number },
  number | undefined
>(stack, "fn", async (input) => {
  return input.arr[input.n];
});

const objAccessFunc = new Function<
  { obj: Record<string, any>; key: string },
  number | undefined
>(stack, "fn", async (input) => {
  return input.obj[input.key];
});

new StepFunction(stack, "obj ref", async (input: { n: number }) => {
  const arr = [1, 2, 3];
  return arrayAccessFunc({ arr, n: input.n });
});

new StepFunction(stack, "obj ref", async (input: { key: string }) => {
  const obj = { a: "" } as Record<string, any>;
  return objAccessFunc({ obj, key: input.key });
});

/**
 * Supported
 */

const func2 = new Function<{ x: number; y: number }, string>(
  stack,
  "func",
  async () => {
    return "hello";
  }
);

new StepFunction(stack, "obj ref", async () => {
  const arr = [1, 2, 3];
  for (const i in arr) {
    await func2({ x: arr[i], y: arr[i] });
  }
});

new StepFunction(stack, "obj ref", async () => {
  const arr = [1, 2, 3];
  for (const i in arr) {
    for (const j in arr) {
      await func2({ x: arr[i], y: arr[j] });
    }
  }
});

/**
 * Unsupported
 * 10026 - Step Functions property names must be constant
 * @see ErrorCodes.StepFunctions_property_names_must_be_constant
 */

new StepFunction(stack, "obj ref", async (input: { key: string }) => {
  return {
    [input.key]: "",
  };
});

/**
 * Supported - Workaround
 * 10026 - Step Functions property names must be constant
 * @see ErrorCodes.StepFunctions_property_names_must_be_constant
 */

const objAssignFunc = new Function<
  { obj: Record<string, string>; key: string; value: string },
  Record<string, string>
>(stack, "fn", async (input) => {
  return { ...input.obj, [input.key]: input.value };
});

new StepFunction(stack, "obj ref", async (input: { key: string }) => {
  return objAssignFunc({ obj: {}, key: input.key, value: "" });
});
