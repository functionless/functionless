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
  StepFunctionError,
  $SFN,
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
    Key: {
      id: { S: "sas" },
    },
  };

  await table.attributes.get(event);
});

new StepFunction(stack, "obj ref", async () => {
  const event = {
    Function: func,
  };

  await $AWS.Lambda.Invoke(event);
});

// supported - object literal in $AWS calls

new StepFunction(stack, "obj ref", async () => {
  await table.attributes.get({
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

new StepFunction(stack, "obj ref", async () => {
  const x =
    (
      await table.attributes.get({
        Key: {
          id: { S: "" },
        },
      })
    ).Item?.id.S ?? null;
  return x;
});

/**
 * Unsupported
 * 10025 - Step Functions invalid collection access
 * @see ErrorCodes.StepFunctions_Invalid_collection_access
 */

new StepFunction(stack, "obj ref", async (input: { key: string }) => {
  const obj = { a: "" } as Record<string, any>;
  return obj[input.key];
});

/**
 * Supported - workarounds
 * 10025 - Step Functions invalid collection access
 * @see ErrorCodes.StepFunctions_Invalid_collection_access
 */

new StepFunction(stack, "obj ref", async (input: { n: number }) => {
  const arr = [1, 2, 3];
  return arr[input.n];
});

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

const func2 = new Function<
  { x: number | undefined; y: number | undefined },
  string
>(stack, "func", async () => {
  return "hello";
});

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

// supported errors

// eslint-disable-next-line import/order
import * as functionless from "../../src";

new StepFunction(stack, "supported errors", async (input: { key: string }) => {
  if (input.key === "1") {
    throw new Error();
  } else if (input.key === "2") {
    throw Error();
  } else if (input.key === "3") {
    throw new Error("message");
  } else if (input.key === "4") {
    throw Error("message");
  } else if (input.key === "5") {
    // import { StepFunctionError } from "@functionless/aws-lib-constructs";
    throw new StepFunctionError("ErrorName", { reason: "you suck" });
  } else if (input.key === "6") {
    // import * as functionless from "@functionless/aws-lib-constructs";
    throw new functionless.StepFunctionError("ErrorName", {
      reason: "you suck",
    });
  }
});

// unsupported errors

new StepFunction(
  stack,
  "unsupported errors",
  async (input: { key: string }) => {
    if (input.key === "1") {
      // reference is not allowed
      throw new Error(input.key);
    } else if (input.key === "2") {
      throw new CustomError("error");
    } else if (input.key === "3") {
      // non-constant value as first arg
      throw new StepFunctionError(input.key, { reason: "reason" });
    } else if (input.key === "4") {
      // non-constant value as second arg
      throw new StepFunctionError("ErrorName", { reason: input.key });
    } else {
      throw new StepFunctionError("ErrorName", input.key);
    }
  }
);

class CustomError {
  constructor(readonly prop: string) {}
}

/**
 * Unsupported - Object `{... rest}`
 * @see ErrorCodes.StepFunctions_does_not_support_destructuring_object_with_rest
 */

new StepFunction(stack, "sfn", async ({ ...rest }) => {
  return rest;
});
new StepFunction(stack, "sfn", async (input: { [key: string]: string }) => {
  const { ...rest } = input;
  return rest;
});

/**
 * Supported - Array `[...rest]`
 */

new StepFunction(
  stack,
  "sfn",
  async ({ arr: [...rest] }: { arr: string[] }) => {
    return rest;
  }
);
new StepFunction(stack, "sfn", async (input: { arr: string[] }) => {
  const [...rest] = input.arr;
  return rest;
});

/**
 * Unsupported
 */

const someFunctionReference = () => {
  return true;
};

new StepFunction(stack, "fn", async () => {
  [1, 2, 3].filter(someFunctionReference);
  [1, 2, 3].map(someFunctionReference);
  [1, 2, 3].forEach(someFunctionReference);
  // valid - ensure that $SFN isn't caught by this validation
  await $SFN.forEach([], () => {});
});

/**
 * Supported - Filter
 * @see ErrorCodes.StepFunction_invalid_filter_syntax
 */

new StepFunction(stack, "fn", async (input: { value: number }) => {
  [1, 2, 3].filter((_, index, array) => array[0] === index);
  [1, 2, 3].filter((val) => input.value === val);
  [1, 2, 3].filter((item) => {
    const value = 1;
    return item === value;
  });
  [{}].filter((item) => {
    // @ts-ignore
    return item === {};
  });
});

new StepFunction(stack, "fn", async (input: { arr: { name: string }[] }) => {
  [1, 2, 3].filter((item) => item > 1);
  input.arr.filter((item) => item.name === "some string");
  input.arr.filter(({ name }) => name === "some string");
});

/**
 * Unsupported - Mis-matched element access
 * @see ErrorCodes.StepFunctions_mismatched_index_type
 */

new StepFunction(stack, "fn", async () => {
  const obj = { 1: "value" };
  const arr = [1];

  // invalid - numeric object property access in SFN is invalid, key must be a string
  obj[1];

  // invalid - string array access in SFN is invalid, index must be a number
  arr["0"];
});

/**
 * Support - element access
 */

new StepFunction(stack, "fn", async () => {
  const obj = { 1: "value" };
  const arr = [1];

  // valid
  obj["1"];
  // valid
  arr[0];
});

/**
 * Support - spread
 */

new StepFunction(stack, "fn", async (input) => {
  return { a: 1, ...input, b: 2 };
});
