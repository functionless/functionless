import { Stack } from "aws-cdk-lib";
import "jest";
import {
  $AWS,
  $SFN,
  EventBus,
  Event,
  ExpressStepFunction,
  StepFunction,
  SyncExecutionResult,
} from "../src";
import { StateMachine, States } from "../src/asl";
import { initStepFunctionApp, Person } from "./util";

test("empty function", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {}).definition;

  const expected: StateMachine<States> = {
    StartAt: "return null",
    States: {
      "return null": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("return identifier", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, string>(
    stack,
    "fn",
    (input) => {
      return input.id;
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: "return input.id",
    States: {
      "return input.id": {
        Type: "Pass",
        End: true,
        OutputPath: "$.id",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("return PropAccessExpr", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (input: { input: { id: string } }) => {
      return input.input.id;
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: "return input.input.id",
    States: {
      "return input.input.id": {
        Type: "Pass",
        End: true,
        OutputPath: "$.input.id",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("return optional PropAccessExpr", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { input: { id?: string } },
    string | undefined
  >(stack, "fn", (input) => {
    return input.input?.id;
  }).definition;

  const expected: StateMachine<States> = {
    StartAt: "return input.input.id",
    States: {
      "return input.input.id": {
        Type: "Pass",
        End: true,
        // this can cause an error in Step Functions
        // need to use Choice and isPresent to compute a temporary variable
        // wish: step functions would default a missing reference to null
        // or understand the concept of `undefined` and would delete the
        // OutputPath if `$.input.id`
        // see: https://twitter.com/samgoodwin89/status/1506170918216736771

        OutputPath: "$.input.id",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("return items.slice(1)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, string[]>(
    stack,
    "fn",
    (input) => {
      return input.items.slice(1);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.items.slice(1)",
    States: {
      "return input.items.slice(1)": {
        End: true,
        InputPath: "$.items[1:]",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return items.slice(1, undefined)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, string[]>(
    stack,
    "fn",
    (input) => {
      return input.items.slice(1, undefined);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.items.slice(1, undefined)",
    States: {
      "return input.items.slice(1, undefined)": {
        End: true,
        InputPath: "$.items[1:]",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return items.slice(-1)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, string[]>(
    stack,
    "fn",
    (input) => {
      return input.items.slice(-1);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.items.slice(-1)",
    States: {
      "return input.items.slice(-1)": {
        End: true,
        InputPath: "$.items[-1:]",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return items.slice(0, -1)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, string[]>(
    stack,
    "fn",
    (input) => {
      return input.items.slice(0, -1);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.items.slice(0, -1)",
    States: {
      "return input.items.slice(0, -1)": {
        End: true,
        InputPath: "$.items[0:-1]",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return items.slice(1, 3)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, string[]>(
    stack,
    "fn",
    (input) => {
      return input.items.slice(1, 3);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.items.slice(1, 3)",
    States: {
      "return input.items.slice(1, 3)": {
        End: true,
        InputPath: "$.items[1:3]",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return task({key: items.slice(1, 3)})", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { items: string[] },
    number | null
  >(stack, "fn", async (input) => {
    return task({ key: input.items.slice(1, 3) });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return task({key: input.items.slice(1, 3)})",
    States: {
      "return task({key: input.items.slice(1, 3)})": {
        Type: "Task",
        End: true,
        Resource: "arn:aws:states:::lambda:invoke",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: {
            "key.$": "$.items[1:3]",
          },
        },
        ResultPath: "$",
      },
    },
  });
});

test("let and set", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    let a;
    a = null;
    a = true;
    a = false;
    a = 0;
    a = -1;
    a = -100;
    a = 1 + 2;
    a = "hello";
    a = "hello" + " world";
    a = "hello" + 1;
    a = 1 + "hello";
    a = "hello" + true;
    a = false + "hello";
    a = null + "hello";
    a = "hello" + null;
    a = [null];
    a = [1];
    a = [-1];
    a = [true];
    a = [
      {
        key: "value",
      },
    ];
    a = {
      key: "value",
    };
    a = a;
    a = "hello" + { place: "world" };
    a = "hello" + ["world"];
    return a;
  }).definition;

  expect(definition).toEqual({
    StartAt: "a = null",
    States: {
      "a = null": {
        Next: "a = true",
        Parameters: {
          "$.a": null,
          "a.$": "$.a",
        },
        ResultPath: null,
        Type: "Pass",
      },
      "a = true": {
        Next: "a = false",
        Parameters: true,
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = false": {
        Next: "a = 0",
        Parameters: false,
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = 0": {
        Next: "a = -1",
        Parameters: 0,
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = -1": {
        Next: "a = -100",
        Parameters: -1,
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = -100": {
        Next: "a = 1 + 2",
        Parameters: -100,
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = 1 + 2": {
        Next: 'a = "hello"',
        Parameters: 3,
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = "hello"': {
        Next: 'a = "hello" + " world"',
        Parameters: "hello",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = "hello" + " world"': {
        Next: 'a = "hello" + 1',
        Parameters: "hello world",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = "hello" + 1': {
        Next: 'a = 1 + "hello"',
        Parameters: "hello1",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = 1 + "hello"': {
        Next: 'a = "hello" + true',
        Parameters: "1hello",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = "hello" + true': {
        Next: 'a = false + "hello"',
        Parameters: "hellotrue",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = false + "hello"': {
        Next: 'a = null + "hello"',
        Parameters: "falsehello",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = null + "hello"': {
        Next: 'a = "hello" + null',
        Parameters: "nullhello",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = "hello" + null': {
        Next: "a = [null]",
        Parameters: "hellonull",
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = [null]": {
        Next: "a = [1]",
        Parameters: [null],
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = [1]": {
        Next: "a = [-1]",
        Parameters: [1],
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = [-1]": {
        Next: "a = [true]",
        Parameters: [-1],
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = [true]": {
        Next: 'a = [{key: "value"}]',
        Parameters: [true],
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = [{key: "value"}]': {
        Next: 'a = {key: "value"}',
        Parameters: [
          {
            key: "value",
          },
        ],
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = {key: "value"}': {
        Next: "a = a",
        Parameters: {
          key: "value",
        },
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = a": {
        InputPath: "$.a",
        Next: 'a = "hello" + {place: "world"}',
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = "hello" + {place: "world"}': {
        Next: 'a = "hello" + ["world"]',
        Parameters: "hello[object Object]",
        ResultPath: "$.a",
        Type: "Pass",
      },
      'a = "hello" + ["world"]': {
        Next: "return a",
        Parameters: "helloworld",
        ResultPath: "$.a",
        Type: "Pass",
      },
      "return a": {
        End: true,
        OutputPath: "$.a",
        Type: "Pass",
      },
    },
  });
});

test("task(any)", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", async () => {
    await task(null);
    await task(true);
    await task(false);
    await task(0);
    await task(-1);
    await task(-100);
    await task(1 + 2);
    await task("hello");
    await task("hello" + " world");
    await task("hello" + 1);
    await task(1 + "hello");
    await task("hello" + true);
    await task(false + "hello");
    await task(null + "hello");
    await task("hello" + null);
    await task([null]);
    await task([1]);
    await task([-1]);
    await task([true]);
    await task([
      {
        key: "value",
      },
    ]);
    await task({
      key: "value",
    });
    await task("hello" + { place: "world" });
    await task("hello" + ["world"]);
  }).definition;

  expect(definition).toEqual({
    StartAt: "task(null)",
    States: {
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
      'task("hello" + " world")': {
        Next: 'task("hello" + 1)',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "hello world",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task("hello" + 1)': {
        Next: 'task(1 + "hello")',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "hello1",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task("hello" + null)': {
        Next: "task([null])",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "hellonull",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task("hello" + true)': {
        Next: 'task(false + "hello")',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "hellotrue",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task("hello")': {
        Next: 'task("hello" + " world")',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "hello",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task(-1)": {
        Next: "task(-100)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: -1,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task(-100)": {
        Next: "task(1 + 2)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: -100,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task(0)": {
        Next: "task(-1)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: 0,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task(1 + "hello")': {
        Next: 'task("hello" + true)',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "1hello",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task(1 + 2)": {
        Next: 'task("hello")',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: 3,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task([-1])": {
        Next: "task([true])",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: [-1],
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task([1])": {
        Next: "task([-1])",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: [1],
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task([null])": {
        Next: "task([1])",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: [null],
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task([true])": {
        Next: 'task([{key: "value"}])',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: [true],
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task([{key: "value"}])': {
        Next: 'task({key: "value"})',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: [
            {
              key: "value",
            },
          ],
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task(false + "hello")': {
        Next: 'task(null + "hello")',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "falsehello",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task(false)": {
        Next: "task(0)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: false,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task(null + "hello")': {
        Next: 'task("hello" + null)',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "nullhello",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task(null)": {
        Next: "task(true)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: null,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      "task(true)": {
        Next: "task(false)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: true,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task({key: "value"})': {
        Next: 'task("hello" + {place: "world"})',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: {
            key: "value",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task("hello" + {place: "world"})': {
        Next: 'task("hello" + ["world"])',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "hello[object Object]",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
      'task("hello" + ["world"])': {
        Next: "return null",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "helloworld",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        ResultSelector: "$.Payload",
        Type: "Task",
      },
    },
  });
});

test("spread constant array and object", () => {
  const array = [1, 2];
  const object = { hello: "world" };

  const definition = new StepFunction(stack, "fn", () => {
    return {
      array: [0, ...array, 3],
      object: {
        key: "value",
        ...object,
      },
    };
  }).definition;

  expect(definition).toEqual({
    StartAt:
      'return {array: [0, ...array, 3], object: {key: "value", ...object}}',
    States: {
      'return {array: [0, ...array, 3], object: {key: "value", ...object}}': {
        End: true,
        Parameters: {
          array: [0, 1, 2, 3],
          object: {
            hello: "world",
            key: "value",
          },
        },
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return void", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    return;
  }).definition;

  const expected: StateMachine<States> = {
    StartAt: "return null",
    States: {
      "return null": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("conditionally return void", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, void>(
    stack,
    "fn",
    (input) => {
      if (input.id === "hello") {
        return;
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(input.id == "hello")',
    States: {
      'if(input.id == "hello")': {
        Choices: [
          {
            Next: "return null",
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: "return null 1",
        Type: "Choice",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
      "return null 1": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("if-else", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, string>(
    stack,
    "fn",
    (input) => {
      if (input.id === "hello") {
        return "hello";
      } else {
        return "world";
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(input.id == "hello")',
    States: {
      'if(input.id == "hello")': {
        Choices: [
          {
            Next: 'return "hello"',
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: 'return "world"',
        Type: "Choice",
      },
      'return "world"': {
        End: true,
        Result: "world",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("if (typeof x === ??)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, string | null>(
    stack,
    "fn",
    (input) => {
      if (input.id === undefined) {
        return "null";
      } else if (typeof input.id === "undefined") {
        return "undefined";
      } else if (typeof input.id === "string") {
        return "string";
      } else if (typeof input.id === "boolean") {
        return "boolean";
      } else if (typeof input.id === "number") {
        return "number";
      } else if (typeof input.id === "bigint") {
        return "bigint";
      }
      return null;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "if(input.id == undefined)",
    States: {
      "if(input.id == undefined)": {
        Choices: [
          {
            Next: 'return "null"',
            Or: [
              {
                IsPresent: false,
                Variable: "$.id",
              },
              {
                IsNull: true,
                Variable: "$.id",
              },
            ],
          },
          {
            IsPresent: false,
            Next: 'return "undefined"',
            Variable: "$.id",
          },
          {
            And: [
              {
                IsPresent: true,
                Variable: "$.id",
              },
              {
                IsString: true,
                Variable: "$.id",
              },
            ],
            Next: 'return "string"',
          },
          {
            And: [
              {
                IsPresent: true,
                Variable: "$.id",
              },
              {
                IsBoolean: true,
                Variable: "$.id",
              },
            ],
            Next: 'return "boolean"',
          },
          {
            And: [
              {
                IsPresent: true,
                Variable: "$.id",
              },
              {
                IsNumeric: true,
                Variable: "$.id",
              },
            ],
            Next: 'return "number"',
          },
          {
            And: [
              {
                IsPresent: true,
                Variable: "$.id",
              },
              {
                IsNumeric: true,
                Variable: "$.id",
              },
            ],
            Next: 'return "bigint"',
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      'return "bigint"': {
        End: true,
        Result: "bigint",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "boolean"': {
        End: true,
        Result: "boolean",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "null"': {
        End: true,
        Result: "null",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "number"': {
        End: true,
        Result: "number",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "string"': {
        End: true,
        Result: "string",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "undefined"': {
        End: true,
        Result: "undefined",
        ResultPath: "$",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

test("put an event bus event", () => {
  interface BusDetails {
    value: string;
  }
  interface BusEvent extends Event<BusDetails> {}

  const bus = new EventBus<BusEvent>(stack, "testBus2");

  const definition = new ExpressStepFunction<{ id: string }, void>(
    stack,
    "fn",
    async (input) => {
      await bus.putEvents({
        "detail-type": "someEvent",
        source: "sfnTest",
        detail: {
          value: input.id,
        },
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt:
      'bus.putEvents({detail-type: "someEvent", source: "sfnTest", detail: {value:',
    States: {
      'bus.putEvents({detail-type: "someEvent", source: "sfnTest", detail: {value:':
        {
          Type: "Task",
          Resource: "arn:aws:states:::events:putEvents",
          Next: "return null",
          Parameters: {
            Entries: [
              {
                Detail: {
                  "value.$": "$.id",
                },
                DetailType: "someEvent",
                EventBusName: bus.bus.eventBusArn,
                Source: "sfnTest",
              },
            ],
          },
          ResultPath: null,
        },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("put multiple event bus events", () => {
  interface BusDetails {
    value: string;
    constant?: string;
  }
  interface BusEvent extends Event<BusDetails> {}

  const bus = new EventBus<BusEvent>(stack, "testBus");

  const definition = new ExpressStepFunction<{ id: string }, void>(
    stack,
    "fn",
    async (input) => {
      await bus.putEvents(
        {
          "detail-type": "someEvent",
          source: "sfnTest",
          detail: {
            value: input.id,
          },
        },
        {
          "detail-type": "someOtherEvent",
          source: "sfnTest",
          detail: {
            constant: "hi",
            value: input.id,
          },
        }
      );
    }
  ).definition;

  expect(definition).toEqual({
    StartAt:
      'bus.putEvents({detail-type: "someEvent", source: "sfnTest", detail: {value:',
    States: {
      'bus.putEvents({detail-type: "someEvent", source: "sfnTest", detail: {value:':
        {
          Type: "Task",
          Resource: "arn:aws:states:::events:putEvents",
          Next: "return null",
          Parameters: {
            Entries: [
              {
                Detail: {
                  "value.$": "$.id",
                },
                DetailType: "someEvent",
                EventBusName: bus.bus.eventBusArn,
                Source: "sfnTest",
              },
              {
                Detail: {
                  constant: "hi",
                  "value.$": "$.id",
                },
                DetailType: "someOtherEvent",
                EventBusName: bus.bus.eventBusArn,
                Source: "sfnTest",
              },
            ],
          },
          ResultPath: null,
        },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("if (typeof x !== ??)", () => {
  const definition = new ExpressStepFunction<{ id: any }, string | null>(
    stack,
    "fn",
    (input) => {
      if (input.id !== undefined) {
        return "null";
      } else if ("undefined" !== typeof input.id) {
        return "undefined";
      } else if (typeof input.id !== "string") {
        return "string";
      } else if (typeof input.id !== "boolean") {
        return "boolean";
      } else if (typeof input.id !== "number") {
        return "number";
      } else if (typeof input.id !== "bigint") {
        return "bigint";
      }
      return null;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "if(input.id != undefined)",
    States: {
      "if(input.id != undefined)": {
        Choices: [
          {
            And: [
              {
                IsPresent: true,
                Variable: "$.id",
              },
              {
                IsNull: false,
                Variable: "$.id",
              },
            ],
            Next: 'return "null"',
          },
          {
            IsPresent: true,
            Next: 'return "undefined"',
            Variable: "$.id",
          },
          {
            Next: 'return "string"',
            Or: [
              {
                IsPresent: false,
                Variable: "$.id",
              },
              {
                IsString: false,
                Variable: "$.id",
              },
            ],
          },
          {
            Next: 'return "boolean"',
            Or: [
              {
                IsPresent: false,
                Variable: "$.id",
              },
              {
                IsBoolean: false,
                Variable: "$.id",
              },
            ],
          },
          {
            Next: 'return "number"',
            Or: [
              {
                IsPresent: false,
                Variable: "$.id",
              },
              {
                IsNumeric: false,
                Variable: "$.id",
              },
            ],
          },
          {
            Next: 'return "bigint"',
            Or: [
              {
                IsPresent: false,
                Variable: "$.id",
              },
              {
                IsNumeric: false,
                Variable: "$.id",
              },
            ],
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      'return "bigint"': {
        End: true,
        Result: "bigint",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "boolean"': {
        End: true,
        Result: "boolean",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "null"': {
        End: true,
        Result: "null",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "number"': {
        End: true,
        Result: "number",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "string"': {
        End: true,
        Result: "string",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "undefined"': {
        End: true,
        Result: "undefined",
        ResultPath: "$",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("if-else-if", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, string | void>(
    stack,
    "fn",
    (input) => {
      if (input.id === "hello") {
        return "hello";
      } else if (input.id === "world") {
        return "world";
      }
      return;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(input.id == "hello")',
    States: {
      'if(input.id == "hello")': {
        Choices: [
          {
            Next: 'return "hello"',
            StringEquals: "hello",
            Variable: "$.id",
          },
          {
            Next: 'return "world"',
            StringEquals: "world",
            Variable: "$.id",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "world"': {
        End: true,
        Result: "world",
        ResultPath: "$",
        Type: "Pass",
      },
      "return null": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
    },
  });
});

test("for-loop and do nothing", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, void>(
    stack,
    "fn",
    (input) => {
      for (const item of input.items) {
        // @ts-ignore
        const a = item;
      }
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        ItemsPath: "$.items",
        Iterator: {
          StartAt: "a = item",
          States: {
            "a = item": {
              End: true,
              OutputPath: "$.result",
              Parameters: {
                "result.$": "$.item",
              },
              ResultPath: "$.a",
              Type: "Pass",
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("for i in items, items[i]", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, void>(
    stack,
    "fn",
    (input) => {
      for (const i in input.items) {
        // @ts-ignore
        const a = items[i];
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(i in input.items)",
    States: {
      "for(i in input.items)": {
        ItemsPath: "$.items",
        Iterator: {
          StartAt: "a = items[i]",
          States: {
            "a = items[i]": {
              End: true,
              OutputPath: "$.result",
              Parameters: {
                "result.$": "$.0_i",
              },
              ResultPath: "$.a",
              Type: "Pass",
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          // special prefixed value so that we can index the
          "0_i.$": "$$.Map.Item.Value",
          "i.$": "$$.Map.Item.Index",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("return a single Lambda Function call", () => {
  const { stack, getPerson } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { id: string },
    Person | undefined
  >(stack, "fn", async (input) => {
    return getPerson({ id: input.id });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return getPerson({id: input.id})",
    States: {
      "return getPerson({id: input.id})": {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        End: true,
        ResultPath: "$",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: getPerson.resource.functionName,
          Payload: {
            "id.$": "$.id",
          },
        },
      },
    },
  });
});

test("task(-1)", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, any>(
    stack,
    "fn",
    () => {
      return task(-1);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return task(-1)",
    States: {
      "return task(-1)": {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        End: true,
        ResultPath: "$",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: -1,
        },
      },
    },
  });
});

test("task(input.list[-1])", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (input: { list: { [-1]: string } }) => {
      return task(input.list[-1]);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return task(input.list[-1])",
    States: {
      "return task(input.list[-1])": {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        End: true,
        ResultPath: "$",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          "Payload.$": "$.list[-1]",
        },
      },
    },
  });
});

test("call Lambda Function, store as variable, return variable", () => {
  const { stack, getPerson } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { id: string },
    Person | undefined
  >(stack, "fn", async (input) => {
    const person = await getPerson({ id: input.id });
    return person;
  }).definition;

  expect(definition).toEqual({
    StartAt: "person = getPerson({id: input.id})",
    States: {
      "person = getPerson({id: input.id})": {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.person",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: getPerson.resource.functionName,
          Payload: {
            "id.$": "$.id",
          },
        },
        Next: "return person",
      },
      "return person": {
        Type: "Pass",
        OutputPath: "$.person",
        End: true,
      },
    },
  });
});

test("call Lambda Function, store as variable, return promise variable", () => {
  const { stack, getPerson } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { id: string },
    Person | undefined
  >(stack, "fn", async (input) => {
    const person = getPerson({ id: input.id });
    return person;
  }).definition;

  expect(definition).toEqual({
    StartAt: "person = getPerson({id: input.id})",
    States: {
      "person = getPerson({id: input.id})": {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.person",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: getPerson.resource.functionName,
          Payload: {
            "id.$": "$.id",
          },
        },
        Next: "return person",
      },
      "return person": {
        Type: "Pass",
        OutputPath: "$.person",
        End: true,
      },
    },
  });
});

test("return AWS.DynamoDB.GetItem", () => {
  const { stack, personTable } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { id: string },
    Person | undefined
  >(stack, "fn", async (input) => {
    const person = await $AWS.DynamoDB.GetItem({
      TableName: personTable,
      Key: {
        id: {
          S: input.id,
        },
      },
    });

    if (person.Item === undefined) {
      return undefined;
    }

    return {
      id: person.Item.id.S,
      name: person.Item.name.S,
    };
  }).definition;

  const expected: StateMachine<States> = {
    StartAt:
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: input",
    States: {
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: input":
        {
          Next: "if(person.Item == undefined)",
          ResultPath: "$.person",
          Resource: "arn:aws:states:::aws-sdk:dynamodb:getItem",
          Parameters: {
            TableName: personTable.resource.tableName,
            Key: {
              id: {
                "S.$": "$.id",
              },
            },
          },

          Type: "Task",
        },
      "if(person.Item == undefined)": {
        Choices: [
          {
            Or: [
              {
                Variable: "$.person.Item",
                IsPresent: false,
              },
              {
                Variable: "$.person.Item",
                IsNull: true,
              },
            ],
            Next: "return undefined",
          },
        ],
        Default: "return {id: person.Item.id.S, name: person.Item.name.S}",
        Type: "Choice",
      },
      "return undefined": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
      "return {id: person.Item.id.S, name: person.Item.name.S}": {
        End: true,
        Parameters: {
          "id.$": "$.person.Item.id.S",
          "name.$": "$.person.Item.name.S",
        },
        ResultPath: "$",
        Type: "Pass",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("call AWS.DynamoDB.GetItem, then Lambda and return LiteralExpr", () => {
  const { stack, personTable, computeScore } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { id: string },
    (Person & { score: number }) | undefined
  >(stack, "fn", async (input) => {
    const person = await $AWS.DynamoDB.GetItem({
      TableName: personTable,
      Key: {
        id: {
          S: input.id,
        },
      },
    });

    if (person.Item === undefined) {
      return undefined;
    }

    const score = await computeScore({
      id: person.Item.id.S,
      name: person.Item.name.S,
    });

    return {
      id: person.Item.id.S,
      name: person.Item.name.S,
      score,
    };
  }).definition;

  const expected: StateMachine<States> = {
    StartAt:
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: input",
    States: {
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: input":
        {
          Next: "if(person.Item == undefined)",
          ResultPath: "$.person",
          Parameters: {
            Key: {
              id: {
                "S.$": "$.id",
              },
            },
            TableName: personTable.resource.tableName,
          },
          Resource: "arn:aws:states:::aws-sdk:dynamodb:getItem",
          Type: "Task",
        },
      "if(person.Item == undefined)": {
        Choices: [
          {
            Or: [
              {
                Variable: "$.person.Item",
                IsPresent: false,
              },
              {
                Variable: "$.person.Item",
                IsNull: true,
              },
            ],
            Next: "return undefined",
          },
        ],
        Default:
          "score = computeScore({id: person.Item.id.S, name: person.Item.name.S})",
        Type: "Choice",
      },
      "return undefined": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
      "score = computeScore({id: person.Item.id.S, name: person.Item.name.S})":
        {
          Next: "return {id: person.Item.id.S, name: person.Item.name.S, score: score}",
          ResultPath: "$.score",
          ResultSelector: "$.Payload",
          Parameters: {
            FunctionName: computeScore.resource.functionName,
            Payload: {
              "id.$": "$.person.Item.id.S",
              "name.$": "$.person.Item.name.S",
            },
          },
          Resource: "arn:aws:states:::lambda:invoke",
          Type: "Task",
        },
      "return {id: person.Item.id.S, name: person.Item.name.S, score: score}": {
        End: true,
        ResultPath: "$",
        Parameters: {
          "id.$": "$.person.Item.id.S",
          "name.$": "$.person.Item.name.S",
          "score.$": "$.score",
        },
        Type: "Pass",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("for-loop over a list literal", () => {
  const { stack, computeScore } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, void>(
    stack,
    "fn",
    async (input) => {
      const people = ["sam", "brendan"];
      for (const name of people) {
        await computeScore({
          id: input.id,
          name,
        });
      }
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: 'people = ["sam", "brendan"]',
    States: {
      'people = ["sam", "brendan"]': {
        Type: "Pass",
        ResultPath: "$.people",
        Result: ["sam", "brendan"],
        Next: "for(name of people)",
      },
      "for(name of people)": {
        Type: "Map",
        ItemsPath: "$.people",
        ResultPath: null,
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "name.$": "$$.Map.Item.Value",
        },
        Iterator: {
          StartAt: "computeScore({id: input.id, name: name})",
          States: {
            "computeScore({id: input.id, name: name})": {
              Type: "Task",
              ResultPath: null,
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: computeScore.resource.functionName,
                Payload: {
                  "id.$": "$.id",
                  "name.$": "$.name",
                },
              },
              Resource: "arn:aws:states:::lambda:invoke",
            },
          },
        },
      },
      "return null": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("conditionally call DynamoDB and then void", () => {
  const { stack, personTable } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ id: string }, void>(
    stack,
    "fn",
    async (input): Promise<void> => {
      if (input.id === "hello") {
        await $AWS.DynamoDB.GetItem({
          TableName: personTable,
          Key: {
            id: {
              S: input.id,
            },
          },
        });
      }
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: 'if(input.id == "hello")',
    States: {
      'if(input.id == "hello")': {
        Choices: [
          {
            Next: "$AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: input.id}}})",
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "$AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: input.id}}})":
        {
          Next: "return null",
          Parameters: {
            Key: {
              id: {
                "S.$": "$.id",
              },
            },
            TableName: personTable.resource.tableName,
          },
          Resource: "arn:aws:states:::aws-sdk:dynamodb:getItem",
          ResultPath: null,
          Type: "Task",
        },
      "return null": {
        Type: "Pass",
        End: true,
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("waitFor literal number of seconds", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", (): string | void => {
    $SFN.waitFor(1);
  }).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.waitFor(1)",
    States: {
      "$SFN.waitFor(1)": {
        Next: "return null",
        Seconds: 1,
        Type: "Wait",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("waitFor reference number of seconds", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction<
    { seconds: number },
    string | void
  >(stack, "fn", (input) => {
    $SFN.waitFor(input.seconds);
  }).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.waitFor(input.seconds)",
    States: {
      "$SFN.waitFor(input.seconds)": {
        Next: "return null",
        SecondsPath: "$.seconds",
        Type: "Wait",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});
test("waitFor literal timestamp", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", (): string | void => {
    $SFN.waitUntil("2022-08-01T00:00:00Z");
  }).definition;

  expect(definition).toEqual({
    StartAt: '$SFN.waitUntil("2022-08-01T00:00:00Z")',
    States: {
      '$SFN.waitUntil("2022-08-01T00:00:00Z")': {
        Next: "return null",
        Timestamp: "2022-08-01T00:00:00Z",
        Type: "Wait",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("waitUntil reference timestamp", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction<{ until: string }, string | void>(
    stack,
    "fn",
    (input) => {
      $SFN.waitUntil(input.until);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.waitUntil(input.until)",
    States: {
      "$SFN.waitUntil(input.until)": {
        Next: "return null",
        TimestampPath: "$.until",
        Type: "Wait",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("throw new Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    throw new Error("cause");
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("cause")',
    States: {
      'throw new Error("cause")': {
        Type: "Fail",
        Error: "Error",
        Cause: '{"message":"cause"}',
      },
    },
  });
});

test("throw Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    throw Error("cause");
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw Error("cause")',
    States: {
      'throw Error("cause")': {
        Type: "Fail",
        Error: "Error",
        Cause: '{"message":"cause"}',
      },
    },
  });
});

class CustomError {
  constructor(readonly property: string) {}
}

test("throw new CustomError", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    throw new CustomError("cause");
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new CustomError("cause")',
    States: {
      'throw new CustomError("cause")': {
        Type: "Fail",
        Error: "CustomError",
        Cause: '{"property":"cause"}',
      },
    },
  });
});

test("try, throw Error('error'), empty catch", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      throw Error("cause");
    } catch {}
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw Error("cause")',
    States: {
      'throw Error("cause")': {
        Next: "return null",
        Result: {
          message: "cause",
        },
        ResultPath: null,
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try, throw, empty catch", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      throw new CustomError("cause");
    } catch {}
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new CustomError("cause")',
    States: {
      'throw new CustomError("cause")': {
        Next: "return null",
        Result: {
          property: "cause",
        },
        ResultPath: null,
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try, task, empty catch", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", async () => {
    try {
      await computeScore({
        id: "id",
        name: "name",
      });
    } catch {}
  }).definition;

  expect(definition).toEqual({
    StartAt: 'computeScore({id: "id", name: "name"})',
    States: {
      'computeScore({id: "id", name: "name"})': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        Next: "return null",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: computeScore.resource.functionName,
          Payload: {
            id: "id",
            name: "name",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("catch and throw new Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      throw new Error("cause");
    } catch (err: any) {
      throw new CustomError("custom cause");
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("cause")',
    States: {
      'throw new Error("cause")': {
        Type: "Pass",
        Result: {
          message: "cause",
        },
        ResultPath: "$.err",
        Next: 'throw new CustomError("custom cause")',
      },
      'throw new CustomError("custom cause")': {
        Type: "Fail",
        Error: "CustomError",
        Cause: '{"property":"custom cause"}',
      },
    },
  });
});

test("catch and throw Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      throw Error("cause");
    } catch (err: any) {
      throw new CustomError("custom cause");
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw Error("cause")',
    States: {
      'throw Error("cause")': {
        Type: "Pass",
        Result: {
          message: "cause",
        },
        ResultPath: "$.err",
        Next: 'throw new CustomError("custom cause")',
      },
      'throw new CustomError("custom cause")': {
        Type: "Fail",
        Error: "CustomError",
        Cause: '{"property":"custom cause"}',
      },
    },
  });
});

test("try-catch with inner return and no catch variable", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", async () => {
    try {
      await computeScore({
        id: "id",
        name: "name",
      });
      return "hello";
    } catch {
      return "world";
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'computeScore({id: "id", name: "name"})',
    States: {
      'computeScore({id: "id", name: "name"})': {
        Type: "Task",

        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: computeScore.resource.functionName,
          Payload: {
            id: "id",
            name: "name",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: 'return "world"',
            ResultPath: null,
          },
        ],
        Next: 'return "hello"',
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "world"': {
        End: true,
        Result: "world",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("try-catch with inner return and a catch variable", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", async () => {
    try {
      await computeScore({
        id: "id",
        name: "name",
      });
      return "hello";
    } catch (err: any) {
      return err.message;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'computeScore({id: "id", name: "name"})',
    States: {
      'computeScore({id: "id", name: "name"})': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        Next: 'return "hello"',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: computeScore.resource.functionName,
          Payload: {
            id: "id",
            name: "name",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: "return err.message",
        ResultPath: "$.err",
        Type: "Pass",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      "return err.message": {
        End: true,
        OutputPath: "$.err.message",
        Type: "Pass",
      },
    },
  });
});

test("try-catch with guaranteed throw new Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      throw new Error("cause");
    } catch (err: any) {
      if (err.message === "cause") {
        return "hello";
      } else {
        return "world";
      }
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("cause")',
    States: {
      'throw new Error("cause")': {
        Type: "Pass",
        Next: 'if(err.message == "cause")',
        Result: {
          message: "cause",
        },
        ResultPath: "$.err",
      },
      'if(err.message == "cause")': {
        Choices: [
          {
            Next: 'return "hello"',
            StringEquals: "cause",
            Variable: "$.err.message",
          },
        ],
        Default: 'return "world"',
        Type: "Choice",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "world"': {
        End: true,
        Result: "world",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("try-catch with optional throw of an Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction<{ id: string }, string>(
    stack,
    "fn",
    (input) => {
      try {
        if (input.id === "hello") {
          throw new Error("cause");
        }
        return "hello world";
      } catch (err: any) {
        if (err.message === "cause") {
          return "hello";
        } else {
          return "world";
        }
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(input.id == "hello")',
    States: {
      'if(input.id == "hello")': {
        Choices: [
          {
            Next: 'throw new Error("cause")',
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: 'return "hello world"',
        Type: "Choice",
      },
      'throw new Error("cause")': {
        Next: 'if(err.message == "cause")',
        Result: {
          message: "cause",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      'if(err.message == "cause")': {
        Choices: [
          {
            Next: 'return "hello"',
            StringEquals: "cause",
            Variable: "$.err.message",
          },
        ],
        Default: 'return "world"',
        Type: "Choice",
      },
      'return "hello world"': {
        End: true,
        Result: "hello world",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "world"': {
        End: true,
        Result: "world",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("try-catch with optional task", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction<{ id: string }, string>(
    stack,
    "fn",
    async (input) => {
      try {
        if (input.id === "hello") {
          await computeScore({
            id: input.id,
            name: "sam",
          });
        }
        return "hello world";
      } catch (err: any) {
        if (err.message === "cause") {
          return "hello";
        } else {
          return "world";
        }
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(input.id == "hello")',
    States: {
      'if(input.id == "hello")': {
        Choices: [
          {
            Next: 'computeScore({id: input.id, name: "sam"})',
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: 'return "hello world"',
        Type: "Choice",
      },
      'computeScore({id: input.id, name: "sam"})': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        Next: 'return "hello world"',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: computeScore.resource.functionName,
          Payload: {
            "id.$": "$.id",
            name: "sam",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      'return "hello world"': {
        End: true,
        Result: "hello world",
        ResultPath: "$",
        Type: "Pass",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: 'if(err.message == "cause")',
        ResultPath: "$.err",
        Type: "Pass",
      },
      'if(err.message == "cause")': {
        Choices: [
          {
            Next: 'return "hello"',
            StringEquals: "cause",
            Variable: "$.err.message",
          },
        ],
        Default: 'return "world"',
        Type: "Choice",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "world"': {
        End: true,
        Result: "world",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("try-catch with optional return of task", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction<{ id: string }, string | number>(
    stack,
    "fn",
    async (input) => {
      try {
        if (input.id === "hello") {
          return await computeScore({
            id: input.id,
            name: "sam",
          });
        }
        return "hello world";
      } catch (err: any) {
        if (err.message === "cause") {
          return "hello";
        } else {
          return "world";
        }
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(input.id == "hello")',
    States: {
      'if(input.id == "hello")': {
        Choices: [
          {
            Next: 'return computeScore({id: input.id, name: "sam"})',
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: 'return "hello world"',
        Type: "Choice",
      },
      'return computeScore({id: input.id, name: "sam"})': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        End: true,
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: computeScore.resource.functionName,
          Payload: {
            "id.$": "$.id",
            name: "sam",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$",
        Type: "Task",
      },
      'return "hello world"': {
        End: true,
        Result: "hello world",
        ResultPath: "$",
        Type: "Pass",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: 'if(err.message == "cause")',
        ResultPath: "$.err",
        Type: "Pass",
      },
      'if(err.message == "cause")': {
        Choices: [
          {
            Next: 'return "hello"',
            StringEquals: "cause",
            Variable: "$.err.message",
          },
        ],
        Default: 'return "world"',
        Type: "Choice",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      'return "world"': {
        End: true,
        Result: "world",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("nested try-catch", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      try {
        throw new Error("error1");
      } catch {
        throw new Error("error2");
      }
    } catch {
      throw new Error("error3");
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("error1")',
    States: {
      'throw new Error("error1")': {
        Next: 'throw new Error("error2")',
        Result: {
          message: "error1",
        },
        ResultPath: null,
        Type: "Pass",
      },
      'throw new Error("error2")': {
        Next: 'throw new Error("error3")',
        Result: {
          message: "error2",
        },
        ResultPath: null,
        Type: "Pass",
      },
      'throw new Error("error3")': {
        Cause: '{"message":"error3"}',
        Error: "Error",
        Type: "Fail",
      },
    },
  });
});

test("throw in for-of", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction<{ items: string[] }, void>(
    stack,
    "fn",
    (input) => {
      // @ts-ignore
      for (const item of input.items) {
        throw new Error("err");
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        ItemsPath: "$.items",
        Iterator: {
          StartAt: 'throw new Error("err")',
          States: {
            'throw new Error("err")': {
              Cause: '{"message":"err"}',
              Error: "Error",
              Type: "Fail",
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try-catch, no variable, contains for-of, throw", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction<
    { items: string[] },
    string | void
  >(stack, "fn", (input): string | void => {
    try {
      // @ts-ignore
      for (const item of input.items) {
        throw new Error("err");
      }
    } catch {
      return "hello";
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            ResultPath: null,
            Next: 'return "hello"',
          },
        ],
        ItemsPath: "$.items",
        Iterator: {
          StartAt: 'throw new Error("err")',
          States: {
            'throw new Error("err")': {
              Type: "Fail",
              Error: "Error",
              Cause: '{"message":"err"}',
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try-catch, err variable, contains for-of, throw new Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction<
    { items: string[] },
    string | void
  >(stack, "fn", (input): string | void => {
    try {
      // @ts-ignore
      for (const item of input.items) {
        throw new Error("err");
      }
    } catch (err: any) {
      return err.message;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            ResultPath: "$.err",
            Next: "catch(err)",
          },
        ],
        ItemsPath: "$.items",
        Iterator: {
          StartAt: 'throw new Error("err")',
          States: {
            'throw new Error("err")': {
              Type: "Fail",
              Error: "Error",
              Cause: '{"message":"err"}',
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: "return err.message",
        ResultPath: "$.err",
        Type: "Pass",
      },
      "return err.message": {
        End: true,
        OutputPath: "$.err.message",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try-catch, err variable, contains for-of, throw Error", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction<
    { items: string[] },
    string | void
  >(stack, "fn", (input): string | void => {
    try {
      // @ts-ignore
      for (const item of input.items) {
        throw Error("err");
      }
    } catch (err: any) {
      return err.message;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            ResultPath: "$.err",
            Next: "catch(err)",
          },
        ],
        ItemsPath: "$.items",
        Iterator: {
          StartAt: 'throw Error("err")',
          States: {
            'throw Error("err")': {
              Type: "Fail",
              Error: "Error",
              Cause: '{"message":"err"}',
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: "return err.message",
        ResultPath: "$.err",
        Type: "Pass",
      },
      "return err.message": {
        End: true,
        OutputPath: "$.err.message",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try-catch-finally", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    async (): Promise<string | void> => {
      try {
        await computeScore({
          id: "id",
          name: "name",
        });
      } catch {
      } finally {
        return "hello";
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'computeScore({id: "id", name: "name"})',
    States: {
      'computeScore({id: "id", name: "name"})': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: 'return "hello"',
            ResultPath: null,
          },
        ],
        Next: 'return "hello"',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: computeScore.resource.functionName,
          Payload: {
            id: "id",
            name: "name",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("try { task } catch { throw } finally { task() }", () => {
  const { stack, task } = initStepFunctionApp();

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    async (): Promise<string | void> => {
      try {
        await task();
      } catch {
        throw new Error("cause");
      } finally {
        await task("recover");
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "task()",
    States: {
      "task()": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: 'throw new Error("cause")',
            ResultPath: null,
          },
        ],
        Next: 'task("recover")',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: undefined,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      'throw new Error("cause")': {
        Next: 'task("recover")',
        Result: {
          message: "cause",
        },
        ResultPath: "$.0_tmp",
        Type: "Pass",
      },
      'task("recover")': {
        Next: "exit finally",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "recover",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "exit finally": {
        Choices: [
          {
            IsPresent: true,
            Next: "throw finally",
            Variable: "$.0_tmp",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "throw finally": {
        Cause:
          "an error was re-thrown from a finally block which is unsupported by Step Functions",
        Error: "ReThrowFromFinally",
        Type: "Fail",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { task() } catch { task() } finally { task() }", () => {
  const { stack, task } = initStepFunctionApp();

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    async (): Promise<void> => {
      try {
        await task("1");
      } catch {
        await task("2");
      } finally {
        await task("3");
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'task("1")',
    States: {
      'task("1")': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: 'task("2")',
            ResultPath: null,
          },
        ],
        Next: 'task("3")',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "1",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      'task("2")': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: 'task("3")',
            ResultPath: "$.0_tmp",
          },
        ],
        Next: 'task("3")',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "2",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      'task("3")': {
        Next: "exit finally",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "3",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "exit finally": {
        Choices: [
          {
            IsPresent: true,
            Next: "throw finally",
            Variable: "$.0_tmp",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "throw finally": {
        Cause:
          "an error was re-thrown from a finally block which is unsupported by Step Functions",
        Error: "ReThrowFromFinally",
        Type: "Fail",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try, throw, finally", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", (): string | void => {
    try {
      throw new Error("cause");
    } catch {
    } finally {
      return "hello";
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("cause")',
    States: {
      'throw new Error("cause")': {
        Next: 'return "hello"',
        Result: {
          message: "cause",
        },
        ResultPath: null,
        Type: "Pass",
      },
      'return "hello"': {
        End: true,
        Result: "hello",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("try, throw, catch, throw, finally, return", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", (): string | void => {
    try {
      throw new Error("go");
    } catch {
      throw new Error("little");
    } finally {
      return "rock-star";
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("go")',
    States: {
      'throw new Error("go")': {
        Next: 'throw new Error("little")',
        Result: {
          message: "go",
        },
        ResultPath: null,
        Type: "Pass",
      },
      'throw new Error("little")': {
        Next: 'return "rock-star"',
        Result: {
          message: "little",
        },
        ResultPath: null,
        Type: "Pass",
      },
      'return "rock-star"': {
        End: true,
        Result: "rock-star",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("try { throw } catch { (maybe) throw } finally { task }", () => {
  const { stack, task } = initStepFunctionApp();

  const definition = new ExpressStepFunction<{ id: string }, string | void>(
    stack,
    "fn",
    async (input) => {
      try {
        throw new Error("go");
      } catch {
        if (input.id === "sam") {
          throw new Error("little");
        }
      } finally {
        // task should run after both throws
        // for second throw, an error should be re-thrown
        await task();
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("go")',
    States: {
      'throw new Error("go")': {
        Next: 'if(input.id == "sam")',
        Result: {
          message: "go",
        },
        ResultPath: null,
        Type: "Pass",
      },
      'if(input.id == "sam")': {
        Choices: [
          {
            Next: 'throw new Error("little")',
            StringEquals: "sam",
            Variable: "$.id",
          },
        ],
        Default: "task()",
        Type: "Choice",
      },
      'throw new Error("little")': {
        Next: "task()",
        Result: {
          message: "little",
        },
        ResultPath: "$.0_tmp",
        Type: "Pass",
      },
      "task()": {
        Next: "exit finally",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: undefined,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "exit finally": {
        Choices: [
          {
            IsPresent: true,
            Next: "throw finally",
            Variable: "$.0_tmp",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "throw finally": {
        Cause:
          "an error was re-thrown from a finally block which is unsupported by Step Functions",
        Error: "ReThrowFromFinally",
        Type: "Fail",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { task() } catch { (maybe) throw } finally { task }", () => {
  const { stack, task } = initStepFunctionApp();

  const definition = new ExpressStepFunction<{ id: string }, string | void>(
    stack,
    "fn",
    async (input) => {
      try {
        await task("1");
      } catch {
        if (input.id === "sam") {
          throw new Error("little");
        }
      } finally {
        // task should run after both throws
        // for second throw, an error should be re-thrown
        await task("2");
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'task("1")',
    States: {
      'task("1")': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: 'if(input.id == "sam")',
            ResultPath: null,
          },
        ],
        Next: 'task("2")',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "1",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      'if(input.id == "sam")': {
        Choices: [
          {
            Next: 'throw new Error("little")',
            StringEquals: "sam",
            Variable: "$.id",
          },
        ],
        Default: 'task("2")',
        Type: "Choice",
      },
      'throw new Error("little")': {
        Next: 'task("2")',
        Result: {
          message: "little",
        },
        ResultPath: "$.0_tmp",
        Type: "Pass",
      },
      'task("2")': {
        Next: "exit finally",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "2",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "exit finally": {
        Choices: [
          {
            IsPresent: true,
            Next: "throw finally",
            Variable: "$.0_tmp",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "throw finally": {
        Cause:
          "an error was re-thrown from a finally block which is unsupported by Step Functions",
        Error: "ReThrowFromFinally",
        Type: "Fail",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { task() } catch(err) { (maybe) throw } finally { task }", () => {
  const { stack, task } = initStepFunctionApp();

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    async (): Promise<string | void> => {
      try {
        await task("1");
      } catch (err: any) {
        if (err.message === "sam") {
          throw new Error("little");
        }
      } finally {
        // task should run after both throws
        // for second throw, an error should be re-thrown
        await task("2");
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'task("1")',
    States: {
      'task("1")': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        Next: 'task("2")',
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "1",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: 'if(err.message == "sam")',
        ResultPath: "$.err",
        Type: "Pass",
      },
      'if(err.message == "sam")': {
        Choices: [
          {
            Next: 'throw new Error("little")',
            StringEquals: "sam",
            Variable: "$.err.message",
          },
        ],
        Default: 'task("2")',
        Type: "Choice",
      },
      'throw new Error("little")': {
        Next: 'task("2")',
        Result: {
          message: "little",
        },
        ResultPath: "$.0_tmp",
        Type: "Pass",
      },
      'task("2")': {
        Next: "exit finally",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "2",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "exit finally": {
        Choices: [
          {
            IsPresent: true,
            Next: "throw finally",
            Variable: "$.0_tmp",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "throw finally": {
        Cause:
          "an error was re-thrown from a finally block which is unsupported by Step Functions",
        Error: "ReThrowFromFinally",
        Type: "Fail",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { for-of } catch { (maybe) throw } finally { task }", () => {
  const { stack, task } = initStepFunctionApp();

  const definition = new ExpressStepFunction<
    { items: string[] },
    string | void
  >(stack, "fn", async (input): Promise<string | void> => {
    try {
      for (const item of input.items) {
        await task(item);
      }
    } catch (err: any) {
      if (err.message === "you dun' goofed") {
        throw new Error("little");
      }
    } finally {
      // task should run after both throws
      // for second throw, an error should be re-thrown
      await task("2");
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        ItemsPath: "$.items",
        Iterator: {
          StartAt: "task(item)",
          States: {
            "task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: null,
              Type: "Task",
            },
          },
        },
        MaxConcurrency: 1,
        Next: 'task("2")',
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: 'if(err.message == "you dun\' goofed")',
        ResultPath: "$.err",
        Type: "Pass",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      'if(err.message == "you dun\' goofed")': {
        Choices: [
          {
            Next: 'throw new Error("little")',
            StringEquals: "you dun' goofed",
            Variable: "$.err.message",
          },
        ],
        Default: 'task("2")',
        Type: "Choice",
      },
      'throw new Error("little")': {
        Next: 'task("2")',
        Result: {
          message: "little",
        },
        ResultPath: "$.0_tmp",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
      'task("2")': {
        Next: "exit finally",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "2",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "exit finally": {
        Choices: [
          {
            IsPresent: true,
            Next: "throw finally",
            Variable: "$.0_tmp",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "throw finally": {
        Cause:
          "an error was re-thrown from a finally block which is unsupported by Step Functions",
        Error: "ReThrowFromFinally",
        Type: "Fail",
      },
    },
  });
});

test("for-of { try { task() } catch (err) { if(err) throw } finally { task() } }", () => {
  const { stack, task } = initStepFunctionApp();

  const definition = new ExpressStepFunction<
    { items: string[] },
    string | void
  >(stack, "fn", async (input): Promise<string | void> => {
    for (const item of input.items) {
      try {
        await task(item);
      } catch (err: any) {
        if (err.message === "you dun' goofed") {
          throw new Error("little");
        }
      } finally {
        // task should run after both throws
        // for second throw, an error should be re-thrown
        await task("2");
      }
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        ItemsPath: "$.items",
        Iterator: {
          StartAt: "task(item)",
          States: {
            "task(item)": {
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: "catch(err)",
                  ResultPath: "$.err",
                },
              ],
              Next: 'task("2")',
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: null,
              Type: "Task",
            },
            "0_catch(err)": {
              InputPath: "$.err.0_ParsedError",
              Next: 'if(err.message == "you dun\' goofed")',
              ResultPath: "$.err",
              Type: "Pass",
            },
            "catch(err)": {
              Next: "0_catch(err)",
              Parameters: {
                "0_ParsedError.$": "States.StringToJson($.err.Cause)",
              },
              ResultPath: "$.err",
              Type: "Pass",
            },
            'if(err.message == "you dun\' goofed")': {
              Choices: [
                {
                  Next: 'throw new Error("little")',
                  StringEquals: "you dun' goofed",
                  Variable: "$.err.message",
                },
              ],
              Default: 'task("2")',
              Type: "Choice",
            },
            'throw new Error("little")': {
              Next: 'task("2")',
              Result: {
                message: "little",
              },
              ResultPath: "$.0_tmp",
              Type: "Pass",
            },
            'task("2")': {
              Next: "exit finally",
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                Payload: "2",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: null,
              Type: "Task",
            },
            "exit finally": {
              Choices: [
                {
                  IsPresent: true,
                  Next: "throw finally",
                  Variable: "$.0_tmp",
                },
              ],
              Default: "return null",
              Type: "Choice",
            },
            "throw finally": {
              Cause:
                "an error was re-thrown from a finally block which is unsupported by Step Functions",
              Error: "ReThrowFromFinally",
              Type: "Fail",
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("while (cond) { cond = task() }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    let cond;
    while (cond === undefined) {
      cond = task();
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "while (cond == undefined)",
    States: {
      "while (cond == undefined)": {
        Choices: [
          {
            Next: "cond = task()",
            Or: [
              {
                IsPresent: false,
                Variable: "$.cond",
              },
              {
                IsNull: true,
                Variable: "$.cond",
              },
            ],
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "cond = task()": {
        Next: "while (cond == undefined)",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: undefined,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.cond",
        Type: "Task",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("while (cond); cond = task()", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    let cond;
    while (cond === undefined) cond = task();
  }).definition;

  expect(definition).toEqual({
    StartAt: "while (cond == undefined)",
    States: {
      "while (cond == undefined)": {
        Choices: [
          {
            Next: "cond = task()",
            Or: [
              {
                IsPresent: false,
                Variable: "$.cond",
              },
              {
                IsNull: true,
                Variable: "$.cond",
              },
            ],
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "cond = task()": {
        Next: "while (cond == undefined)",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: undefined,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.cond",
        Type: "Task",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("let cond; do { cond = task() } while (cond)", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    let cond;
    do {
      cond = task();
    } while (cond === undefined);
  }).definition;

  expect(definition).toEqual({
    StartAt: "cond = task()",
    States: {
      "while (cond == undefined)": {
        Choices: [
          {
            Next: "cond = task()",
            Or: [
              {
                IsPresent: false,
                Variable: "$.cond",
              },
              {
                IsNull: true,
                Variable: "$.cond",
              },
            ],
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "cond = task()": {
        Next: "while (cond == undefined)",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: undefined,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.cond",
        Type: "Task",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("list.map(item => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", async (input) => {
    return Promise.all(input.list.map((item) => task(item)));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.map(function(item))",
    States: {
      "return input.list.map(function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("list.map((item, i) => if (i == 0) task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", async (input) => {
    return Promise.all(
      input.list.map(async (item, i) => {
        if (i === 0) {
          return task(item);
        } else {
          return null;
        }
      })
    );
  }).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.map(function(item, i))",
    States: {
      "return input.list.map(function(item, i))": {
        Type: "Map",
        End: true,
        ItemsPath: "$.list",
        MaxConcurrency: 1,
        Parameters: {
          "i.$": "$$.Map.Item.Index",
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Iterator: {
          StartAt: "if(i == 0)",
          States: {
            "if(i == 0)": {
              Choices: [
                {
                  Next: "return task(item)",
                  NumericEquals: 0,
                  Variable: "$.i",
                },
              ],
              Default: "return null",
              Type: "Choice",
            },
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return null": {
              End: true,
              OutputPath: "$.null",
              Parameters: {
                null: null,
              },
              Type: "Pass",
            },
          },
        },
      },
    },
  });
});

test("list.map((item, i, list) => if (i == 0) task(item) else task(list[0]))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", async (input) => {
    return Promise.all(
      input.list.map((item, i) => {
        if (i === 0) {
          return task(item);
        } else {
          return task(input.list[0]);
        }
      })
    );
  }).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.map(function(item, i))",
    States: {
      "return input.list.map(function(item, i))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "if(i == 0)",
          States: {
            "if(i == 0)": {
              Choices: [
                {
                  Next: "return task(item)",
                  NumericEquals: 0,
                  Variable: "$.i",
                },
              ],
              Default: "return task(input.list[0])",
              Type: "Choice",
            },
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return task(input.list[0])": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.list[0]",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "i.$": "$$.Map.Item.Index",
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.map(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (null | number)[] | null
  >(stack, "fn", async (input) => {
    try {
      return await Promise.all(input.list.map((item) => task(item)));
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.map(function(item))",
    States: {
      "return input.list.map(function(item))": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { list.map(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", async (input) => {
    return Promise.all(
      input.list.map((item) => {
        try {
          return task(item);
        } catch {
          return null;
        }
      })
    );
  }).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.map(function(item))",
    States: {
      "return input.list.map(function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: "return null",
                  ResultPath: null,
                },
              ],
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return null": {
              End: true,
              OutputPath: "$.null",
              Parameters: {
                null: null,
              },
              Type: "Pass",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.map(item => throw) }", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    null | string[]
  >(stack, "fn", (input) => {
    try {
      return input.list.map(() => {
        throw new Error("cause");
      });
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.map(function())",
    States: {
      "return input.list.map(function())": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: 'throw new Error("cause")',
          States: {
            'throw new Error("cause")': {
              Type: "Fail",
              Error: "Error",
              Cause: '{"message":"cause"}',
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {},
        ResultPath: "$",
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { list.map(item => throw) } catch (err)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    string[] | number
  >(stack, "fn", (input) => {
    try {
      return input.list.map(() => {
        throw new Error("cause");
      });
    } catch (err: any) {
      if (err.message === "cause") {
        return 0;
      } else {
        return 1;
      }
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.map(function())",
    States: {
      "return input.list.map(function())": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: 'throw new Error("cause")',
          States: {
            'throw new Error("cause")': {
              Cause: '{"message":"cause"}',
              Error: "Error",
              Type: "Fail",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {},
        ResultPath: "$",
        Type: "Map",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: 'if(err.message == "cause")',
        ResultPath: "$.err",
        Type: "Pass",
      },
      'if(err.message == "cause")': {
        Choices: [
          {
            Next: "return 0",
            StringEquals: "cause",
            Variable: "$.err.message",
          },
        ],
        Default: "return 1",
        Type: "Choice",
      },
      "return 0": {
        End: true,
        Result: 0,
        ResultPath: "$",
        Type: "Pass",
      },
      "return 1": {
        End: true,
        Result: 1,
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("list.forEach(item => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      return input.list.forEach((item) => task(item));
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.forEach(function(item))",
    States: {
      "return input.list.forEach(function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("list.forEach((item, i) => if (i == 0) task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      return input.list.forEach((item, i) => {
        if (i === 0) {
          return task(item);
        } else {
          return null;
        }
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.forEach(function(item, i))",
    States: {
      "return input.list.forEach(function(item, i))": {
        Type: "Map",
        End: true,
        ItemsPath: "$.list",
        MaxConcurrency: 1,
        Parameters: {
          "i.$": "$$.Map.Item.Index",
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Iterator: {
          StartAt: "if(i == 0)",
          States: {
            "if(i == 0)": {
              Choices: [
                {
                  Next: "return task(item)",
                  NumericEquals: 0,
                  Variable: "$.i",
                },
              ],
              Default: "return null",
              Type: "Choice",
            },
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return null": {
              End: true,
              OutputPath: "$.null",
              Parameters: {
                null: null,
              },
              Type: "Pass",
            },
          },
        },
      },
    },
  });
});

test("list.forEach((item, i, list) => if (i == 0) task(item) else task(list[0]))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      return input.list.forEach((item, i) => {
        if (i === 0) {
          return task(item);
        } else {
          return task(input.list[0]);
        }
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.forEach(function(item, i))",
    States: {
      "return input.list.forEach(function(item, i))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "if(i == 0)",
          States: {
            "if(i == 0)": {
              Choices: [
                {
                  Next: "return task(item)",
                  NumericEquals: 0,
                  Variable: "$.i",
                },
              ],
              Default: "return task(input.list[0])",
              Type: "Choice",
            },
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return task(input.list[0])": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.list[0]",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "i.$": "$$.Map.Item.Index",
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.forEach(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void | null>(
    stack,
    "fn",
    (input) => {
      try {
        return input.list.forEach((item) => task(item));
      } catch {
        return null;
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.forEach(function(item))",
    States: {
      "return input.list.forEach(function(item))": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { list.forEach(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      return input.list.forEach((item) => {
        try {
          return task(item);
        } catch {
          return null;
        }
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.forEach(function(item))",
    States: {
      "return input.list.forEach(function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: "return null",
                  ResultPath: null,
                },
              ],
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return null": {
              End: true,
              OutputPath: "$.null",
              Parameters: {
                null: null,
              },
              Type: "Pass",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.forEach(item => throw) }", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void | null>(
    stack,
    "fn",
    (input) => {
      try {
        return input.list.forEach(() => {
          throw new Error("cause");
        });
      } catch {
        return null;
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.forEach(function())",
    States: {
      "return input.list.forEach(function())": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: 'throw new Error("cause")',
          States: {
            'throw new Error("cause")': {
              Type: "Fail",
              Error: "Error",
              Cause: '{"message":"cause"}',
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {},
        ResultPath: "$",
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("try { list.forEach(item => throw) } catch (err)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void | number>(
    stack,
    "fn",
    (input) => {
      try {
        return input.list.forEach(() => {
          throw new Error("cause");
        });
      } catch (err: any) {
        if (err.message === "cause") {
          return 0;
        } else {
          return 1;
        }
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return input.list.forEach(function())",
    States: {
      "return input.list.forEach(function())": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: 'throw new Error("cause")',
          States: {
            'throw new Error("cause")': {
              Cause: '{"message":"cause"}',
              Error: "Error",
              Type: "Fail",
            },
          },
        },
        MaxConcurrency: 1,
        Parameters: {},
        ResultPath: "$",
        Type: "Map",
      },
      "catch(err)": {
        Next: "0_catch(err)",
        Parameters: {
          "0_ParsedError.$": "States.StringToJson($.err.Cause)",
        },
        ResultPath: "$.err",
        Type: "Pass",
      },
      "0_catch(err)": {
        InputPath: "$.err.0_ParsedError",
        Next: 'if(err.message == "cause")',
        ResultPath: "$.err",
        Type: "Pass",
      },
      'if(err.message == "cause")': {
        Choices: [
          {
            Next: "return 0",
            StringEquals: "cause",
            Variable: "$.err.message",
          },
        ],
        Default: "return 1",
        Type: "Choice",
      },
      "return 0": {
        End: true,
        Result: 0,
        ResultPath: "$",
        Type: "Pass",
      },
      "return 1": {
        End: true,
        Result: 1,
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return $SFN.map(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", (input) => {
    return $SFN.map(input.list, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(input.list, function(item))",
    States: {
      "return $SFN.map(input.list, function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("return $SFN.map(list, {maxConcurrency: 2} (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", (input) => {
    return $SFN.map(input.list, { maxConcurrency: 2 }, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(input.list, {maxConcurrency: 2}, function(item))",
    States: {
      "return $SFN.map(input.list, {maxConcurrency: 2}, function(item))": {
        End: true,
        ItemsPath: "$.list",
        MaxConcurrency: 2,
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("$SFN.map(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    async (input) => {
      await $SFN.map(input.list, async (item) => task(item));
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.map(input.list, function(item))",
    States: {
      "$SFN.map(input.list, function(item))": {
        ItemsPath: "$.list",
        Next: "return null",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("result = $SFN.map(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", async (input) => {
    const result = await $SFN.map(input.list, (item) => task(item));
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: "result = $SFN.map(input.list, function(item))",
    States: {
      "result = $SFN.map(input.list, function(item))": {
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Next: "return result",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$.result",
        Type: "Map",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("return $SFN.map(list, (item) => try { task(item)) } catch { return null }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[]
  >(stack, "fn", (input) => {
    return $SFN.map(input.list, (item) => {
      try {
        return task(item);
      } catch {
        return null;
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(input.list, function(item))",
    States: {
      "return $SFN.map(input.list, function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: "return null",
                  ResultPath: null,
                },
              ],
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return null": {
              End: true,
              OutputPath: "$.null",
              Parameters: {
                null: null,
              },
              Type: "Pass",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { $SFN.map(list, (item) => task(item)) } catch { return null }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { list: string[] },
    (number | null)[] | null
  >(stack, "fn", (input) => {
    try {
      return $SFN.map(input.list, (item) => task(item));
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(input.list, function(item))",
    States: {
      "return $SFN.map(input.list, function(item))": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("return $SFN.forEach(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      return $SFN.forEach(input.list, async (item) => {
        await task(item);
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.forEach(input.list, function(item))",
    States: {
      "return $SFN.forEach(input.list, function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("return $SFN.forEach(list, {maxConcurrency: 2} (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      return $SFN.forEach(input.list, { maxConcurrency: 2 }, async (item) => {
        await task(item);
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt:
      "return $SFN.forEach(input.list, {maxConcurrency: 2}, function(item))",
    States: {
      "return $SFN.forEach(input.list, {maxConcurrency: 2}, function(item))": {
        End: true,
        ItemsPath: "$.list",
        MaxConcurrency: 2,
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("$SFN.forEach(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    async (input) => {
      await $SFN.forEach(input.list, async (item) => {
        await task(item);
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.forEach(input.list, function(item))",
    States: {
      "$SFN.forEach(input.list, function(item))": {
        ItemsPath: "$.list",
        Next: "return null",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("result = $SFN.forEach(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      const result = $SFN.forEach(input.list, async (item) => {
        await task(item);
      });
      return result;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "result = $SFN.forEach(input.list, function(item))",
    States: {
      "result = $SFN.forEach(input.list, function(item))": {
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Next: "return result",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$.result",
        Type: "Map",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("return $SFN.forEach(list, (item) => try { task(item)) } catch { return null }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void>(
    stack,
    "fn",
    (input) => {
      return $SFN.forEach(input.list, async (item) => {
        try {
          await task(item);
        } catch {
          return;
        }
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.forEach(input.list, function(item))",
    States: {
      "return $SFN.forEach(input.list, function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              Catch: [
                {
                  ErrorEquals: ["States.ALL"],
                  Next: "return null",
                  ResultPath: null,
                },
              ],
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return null": {
              End: true,
              OutputPath: "$.null",
              Parameters: {
                null: null,
              },
              Type: "Pass",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { $SFN.forEach(list, (item) => task(item)) } catch { return null }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ list: string[] }, void | null>(
    stack,
    "fn",
    (input) => {
      try {
        return $SFN.forEach(input.list, async (item) => {
          await task(item);
        });
      } catch {
        return null;
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.forEach(input.list, function(item))",
    States: {
      "return $SFN.forEach(input.list, function(item))": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              ResultSelector: "$.Payload",
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test('return $SFN.parallel(() => "hello", () => "world"))', () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    return $SFN.parallel(
      () => "hello",
      () => "world"
    );
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.parallel([function(), function()])",
    States: {
      "return $SFN.parallel([function(), function()])": {
        Branches: [
          {
            StartAt: 'return "hello"',
            States: {
              'return "hello"': {
                End: true,
                Result: "hello",
                ResultPath: "$",
                Type: "Pass",
              },
            },
          },
          {
            StartAt: 'return "world"',
            States: {
              'return "world"': {
                End: true,
                Result: "world",
                ResultPath: "$",
                Type: "Pass",
              },
            },
          },
        ],
        End: true,
        ResultPath: "$",
        Type: "Parallel",
      },
    },
  });
});

test('try { return $SFN.parallel(() => "hello", () => "world")) } catch { return null }', () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      return $SFN.parallel(
        () => "hello",
        () => "world"
      );
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.parallel([function(), function()])",
    States: {
      "return $SFN.parallel([function(), function()])": {
        Branches: [
          {
            StartAt: 'return "hello"',
            States: {
              'return "hello"': {
                End: true,
                Result: "hello",
                ResultPath: "$",
                Type: "Pass",
              },
            },
          },
          {
            StartAt: 'return "world"',
            States: {
              'return "world"': {
                End: true,
                Result: "world",
                ResultPath: "$",
                Type: "Pass",
              },
            },
          },
        ],
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        End: true,
        ResultPath: "$",
        Type: "Parallel",
      },
      "return null": {
        Type: "Pass",
        Parameters: {
          null: null,
        },
        OutputPath: "$.null",
        End: true,
      },
    },
  });
});

test("return $SFN.parallel(() => try { task() } catch { return null })) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      return $SFN.parallel(() => {
        try {
          return task();
        } catch {
          return null;
        }
      });
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.parallel([function()])",
    States: {
      "return $SFN.parallel([function()])": {
        Branches: [
          {
            StartAt: "return task()",
            States: {
              "return task()": {
                Catch: [
                  {
                    ErrorEquals: ["States.ALL"],
                    Next: "return null",
                    ResultPath: null,
                  },
                ],
                End: true,
                ResultSelector: "$.Payload",
                Parameters: {
                  FunctionName: task.resource.functionName,
                  Payload: undefined,
                },
                Resource: "arn:aws:states:::lambda:invoke",
                ResultPath: "$",
                Type: "Task",
              },
              "return null": {
                End: true,
                OutputPath: "$.null",
                Parameters: {
                  null: null,
                },
                Type: "Pass",
              },
            },
          },
        ],
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "return null 1",
            ResultPath: null,
          },
        ],
        End: true,
        ResultPath: "$",
        Type: "Parallel",
      },
      "return null 1": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("return task({ key: items.filter(*) })", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { items: { str: string; items: string[] }[] },
    number | null
  >(stack, "fn", (input) => {
    return task({
      equals: input.items.filter((item) => item.str === "hello"),
      and: input.items.filter(
        (item) => item.str === "hello" && item.items[0] === "hello"
      ),
      or: input.items.filter(
        (item) => item.str === "hello" || item.items[0] === "hello"
      ),
    });
  }).definition;

  expect(definition).toEqual({
    StartAt:
      "return task({equals: input.items.filter(function(item)), and: input.items.f",
    States: {
      "return task({equals: input.items.filter(function(item)), and: input.items.f":
        {
          Type: "Task",
          End: true,
          Resource: "arn:aws:states:::lambda:invoke",
          ResultSelector: "$.Payload",
          Parameters: {
            FunctionName: task.resource.functionName,
            Payload: {
              "equals.$": "$.items[?(@.str=='hello')]",
              "and.$": "$.items[?(@.str=='hello'&&@.items[0]=='hello')]",
              "or.$": "$.items[?(@.str=='hello'||@.items[0]=='hello')]",
            },
          },
          ResultPath: "$",
        },
    },
  });
});

test("single quotes in StringLiteralExpr should be escaped in a JSON Path filter expression", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { items: { str: string; items: string[] }[] },
    number | null
  >(stack, "fn", (input) => {
    return task({
      escape: input.items.filter((item) => item.str === "hello'world"),
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return task({escape: input.items.filter(function(item))})",
    States: {
      "return task({escape: input.items.filter(function(item))})": {
        Type: "Task",
        End: true,
        Resource: "arn:aws:states:::lambda:invoke",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: {
            "escape.$": "$.items[?(@.str=='hello\\'world')]",
          },
        },
        ResultPath: "$",
      },
    },
  });
});

test("template literal strings", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<
    { obj: { str: string; items: string } },
    number | null
  >(stack, "fn", (input) => {
    return task({
      key: `${input.obj.str} ${"hello"} ${input.obj.items[0]}`,
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return task({key: `input.obj.str hello input.obj.items[0]`})",
    States: {
      "return task({key: `input.obj.str hello input.obj.items[0]`})": {
        End: true,
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: {
            "key.$": "States.Format('{} hello {}',$.obj.str,$.obj.items[0])",
          },
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$",
        Type: "Task",
      },
    },
  });
});

test("break from for-loop", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, void>(
    stack,
    "fn",
    (input) => {
      for (const item of input.items) {
        if (item === "hello") {
          break;
        }
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        Catch: [
          {
            ErrorEquals: ["Break"],
            Next: "return null",
            ResultPath: null,
          },
        ],
        ItemsPath: "$.items",
        Iterator: {
          StartAt: 'if(item == "hello")',
          States: {
            'if(item == "hello")': {
              Choices: [
                {
                  Next: "break",
                  StringEquals: "hello",
                  Variable: "$.item",
                },
              ],
              Default: '0_empty_else_if(item == "hello")',
              Type: "Choice",
            },
            '0_empty_else_if(item == "hello")': {
              End: true,
              Type: "Pass",
            },
            break: {
              Type: "Fail",
              Error: "Break",
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("break from while-loop", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    while (true) {
      break;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "while (true)",
    States: {
      "while (true)": {
        Choices: [
          {
            IsPresent: false,
            Next: "break",
            Variable: "$.0_true",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      break: {
        Next: "return null",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("break from do-while-loop", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", () => {
    do {
      break;
    } while (true);
  }).definition;

  expect(definition).toEqual({
    StartAt: "break",
    States: {
      "while (true)": {
        Choices: [
          {
            IsPresent: false,
            Next: "break",
            Variable: "$.0_true",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      break: {
        Next: "return null",
        Type: "Pass",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("continue in for loop", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ items: string[] }, void>(
    stack,
    "fn",
    (input) => {
      for (const item of input.items) {
        if (item === "hello") {
          continue;
        }
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(item of input.items)",
    States: {
      "for(item of input.items)": {
        ItemsPath: "$.items",
        Iterator: {
          StartAt: 'if(item == "hello")',
          States: {
            'if(item == "hello")': {
              Choices: [
                {
                  Next: "continue",
                  StringEquals: "hello",
                  Variable: "$.item",
                },
              ],
              Default: '0_empty_else_if(item == "hello")',
              Type: "Choice",
            },
            continue: {
              End: true,
              ResultPath: null,
              Type: "Pass",
            },
            '0_empty_else_if(item == "hello")': {
              End: true,
              Type: "Pass",
            },
          },
        },
        MaxConcurrency: 1,
        Next: "return null",
        Parameters: {
          "item.$": "$$.Map.Item.Value",
        },
        ResultPath: null,
        Type: "Map",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("continue in while loop", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ key: string }, void>(
    stack,
    "fn",
    async (input) => {
      while (true) {
        if (input.key === "sam") {
          continue;
        }
        await task(input.key);
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "while (true)",
    States: {
      "while (true)": {
        Choices: [
          {
            IsPresent: false,
            Next: 'if(input.key == "sam")',
            Variable: "$.0_true",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      'if(input.key == "sam")': {
        Choices: [
          {
            Next: "continue",
            StringEquals: "sam",
            Variable: "$.key",
          },
        ],
        Default: "task(input.key)",
        Type: "Choice",
      },
      continue: {
        Next: "while (true)",
        ResultPath: null,
        Type: "Pass",
      },
      "task(input.key)": {
        Next: "while (true)",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          "Payload.$": "$.key",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("continue in do..while loop", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction<{ key: string }, void>(
    stack,
    "fn",
    async (input) => {
      do {
        if (input.key === "sam") {
          continue;
        }
        await task(input.key);
      } while (true);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(input.key == "sam")',
    States: {
      'if(input.key == "sam")': {
        Choices: [
          {
            Next: "continue",
            StringEquals: "sam",
            Variable: "$.key",
          },
        ],
        Default: "task(input.key)",
        Type: "Choice",
      },
      continue: {
        Next: 'if(input.key == "sam")',
        ResultPath: null,
        Type: "Pass",
      },
      "task(input.key)": {
        Next: "while (true)",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          "Payload.$": "$.key",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "while (true)": {
        Choices: [
          {
            IsPresent: false,
            Next: 'if(input.key == "sam")',
            Variable: "$.0_true",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("return task(task())", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", async () => {
    return task(await task());
  }).definition;

  expect(definition).toEqual({
    StartAt: "0_tmp = task()",
    States: {
      "0_tmp = task()": {
        Next: "return task(0_tmp)",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: undefined,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.0_tmp",
        Type: "Task",
      },
      "return task(0_tmp)": {
        End: true,
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          "Payload.$": "$.0_tmp",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$",
        Type: "Task",
      },
    },
  });
});

// test("return cond ? task(1) : task(2))", () => {
//   const { stack, task } = initStepFunctionApp();
//   const definition = new ExpressStepFunction(stack, "fn", (cond: boolean) => {
//     return cond ? task(1) : task(2);
//   }).definition;

//   expect(definition).toEqual({});
// });

// test("return task(1) ?? task(2))", () => {
//   const { stack, task } = initStepFunctionApp();
//   const definition = new ExpressStepFunction(stack, "fn", () => {
//     return task(1) ?? task(2);
//   }).definition;

//   expect(definition).toEqual({});
// });

test("while(true) { try { } catch { wait }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", async () => {
    while (true) {
      try {
        await task();
      } catch {
        $SFN.waitFor(1);
      }
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "while (true)",
    States: {
      "while (true)": {
        Choices: [
          {
            IsPresent: false,
            Next: "task()",
            Variable: "$.0_true",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "task()": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "$SFN.waitFor(1)",
            ResultPath: null,
          },
        ],
        Next: "while (true)",
        ResultSelector: "$.Payload",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: undefined,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      "$SFN.waitFor(1)": {
        Next: "while (true)",
        Seconds: 1,
        Type: "Wait",
      },
      "return null": {
        End: true,
        OutputPath: "$.null",
        Parameters: {
          null: null,
        },
        Type: "Pass",
      },
    },
  });
});

test("call Step Function from another Step Function", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction(stack, "machine1", () => {
    return "hello";
  });

  const definition = new ExpressStepFunction(stack, "machine2", () => {
    const result = machine1({});
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: "result = machine1({})",
    States: {
      "result = machine1({})": {
        Next: "return result",
        Parameters: {
          StateMachineArn: machine1.stateMachineArn,
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:startSyncExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("call Step Function from another Step Function with name and trace", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction(stack, "machine1", () => {
    return "hello";
  });

  const definition = new ExpressStepFunction(stack, "machine2", () => {
    const result = machine1({
      name: "exec1",
      traceHeader: "1",
    });
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: 'result = machine1({name: "exec1", traceHeader: "1"})',
    States: {
      'result = machine1({name: "exec1", traceHeader: "1"})': {
        Next: "return result",
        Parameters: {
          StateMachineArn: machine1.stateMachineArn,
          Name: "exec1",
          TraceHeader: "1",
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:startSyncExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("call Step Function from another Step Function with name and trace from variables", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction(stack, "machine1", () => {
    return "hello";
  });

  const definition = new ExpressStepFunction(
    stack,
    "machine2",
    (input: { name: string; header: string }) => {
      const result = machine1({
        name: input.name,
        traceHeader: input.header,
      });
      return result;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "result = machine1({name: input.name, traceHeader: input.header})",
    States: {
      "result = machine1({name: input.name, traceHeader: input.header})": {
        Next: "return result",
        Parameters: {
          StateMachineArn: machine1.stateMachineArn,
          "Name.$": "$.name",
          "TraceHeader.$": "$.header",
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:startSyncExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("call Step Function from another Step Function with input", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  const definition = new ExpressStepFunction(stack, "machine2", () => {
    const result = machine1({
      input: {
        value: "hello",
      },
    });
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: 'result = machine1({input: {value: "hello"}})',
    States: {
      'result = machine1({input: {value: "hello"}})': {
        Next: "return result",
        Parameters: {
          Input: {
            value: "hello",
          },
          StateMachineArn: machine1.stateMachineArn,
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:startSyncExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("call Step Function from another Step Function with dynamic input", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  const definition = new ExpressStepFunction<
    { value1: string },
    SyncExecutionResult<string>
  >(stack, "machine2", (input) => {
    const result = machine1({
      input: {
        value: input.value1,
      },
    });
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: "result = machine1({input: {value: input.value1}})",
    States: {
      "result = machine1({input: {value: input.value1}})": {
        Next: "return result",
        Parameters: {
          Input: {
            "value.$": "$.value1",
          },
          StateMachineArn: machine1.stateMachineArn,
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:startSyncExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("call Step Function from another Step Function with dynamic input field input", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  const definition = new ExpressStepFunction<
    { value: string },
    SyncExecutionResult<string>
  >(stack, "machine2", (input) => {
    const result = machine1({
      input: input,
    });
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: "result = machine1({input: input})",
    States: {
      "result = machine1({input: input})": {
        Next: "return result",
        Parameters: {
          "Input.$": "$",
          StateMachineArn: machine1.stateMachineArn,
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:startSyncExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("call Step Function from another Step Function not supported with reference argument", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  expect(
    () =>
      new ExpressStepFunction<{ value1: string }, SyncExecutionResult<string>>(
        stack,
        "machine2",
        (input) => {
          const _input = {
            input: {
              value: input.value1,
            },
          };
          const result = machine1(_input);
          return result;
        }
      )
  ).toThrow(
    "Step function invocation must use a single, inline object parameter. Variable references are not supported currently."
  );
});

test("call Step Function from another Step Function not supported with computed keys", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  expect(
    () =>
      new ExpressStepFunction<{ value1: string }, SyncExecutionResult<string>>(
        stack,
        "machine2",
        (input) => {
          const _inputStr = "input";
          const result = machine1({
            [_inputStr]: {
              value: input.value1,
            },
          });
          return result;
        }
      )
  ).toThrow(
    "Step function invocation must use a single, inline object instantiated without computed or spread keys."
  );
});

test("call Step Function from another Step Function not supported with spread assignment", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new ExpressStepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  expect(
    () =>
      new ExpressStepFunction<{ value1: string }, SyncExecutionResult<string>>(
        stack,
        "machine2",
        (input) => {
          const _input = {
            input: {
              value: input.value1,
            },
          };
          const result = machine1({ ..._input });
          return result;
        }
      )
  ).toThrow(
    "Step function invocation must use a single, inline object instantiated without computed or spread keys."
  );
});

test("call Step Function describe from another Step Function", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new StepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  const definition = new ExpressStepFunction(stack, "machine2", () => {
    const result = machine1.describeExecution("hello");
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: 'result = machine1.describeExecution("hello")',
    States: {
      'result = machine1.describeExecution("hello")': {
        Next: "return result",
        Parameters: {
          ExecutionArn: "hello",
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:describeExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("call Step Function describe from another Step Function from context", () => {
  const { stack } = initStepFunctionApp();
  const machine1 = new StepFunction<{ value: string }, string>(
    stack,
    "machine1",
    () => {
      return "hello";
    }
  );

  const definition = new ExpressStepFunction(
    stack,
    "machine2",
    (input: { id: string }) => {
      const result = machine1.describeExecution(input.id);
      return result;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "result = machine1.describeExecution(input.id)",
    States: {
      "result = machine1.describeExecution(input.id)": {
        Next: "return result",
        Parameters: {
          "ExecutionArn.$": "$.id",
        },
        Resource: "arn:aws:states:::aws-sdk:sfn:describeExecution",
        ResultPath: "$.result",
        Type: "Task",
      },
      "return result": {
        End: true,
        OutputPath: "$.result",
        Type: "Pass",
      },
    },
  });
});

test("on success event", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const success = machine.onSucceeded(stack, "onSuccess");

  expect(success.rule._renderEventPattern()).toEqual({
    source: ["aws.states"],
    "detail-type": ["Step Functions Execution Status Change"],
    detail: {
      status: ["SUCCEEDED"],
      stateMachineArn: [machine.stateMachineArn],
    },
  });
});

test("on status change event", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const statusChange = machine.onStatusChanged(stack, "onSuccess");

  expect(statusChange.rule._renderEventPattern()).toEqual({
    source: ["aws.states"],
    "detail-type": ["Step Functions Execution Status Change"],
    detail: {
      stateMachineArn: [machine.stateMachineArn],
    },
  });
});

test("on status change event refine", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const success = machine
    .onStatusChanged(stack, "onStatus")
    .when(stack, "onRunning", (event) => event.detail.status === "RUNNING");

  expect(success.rule._renderEventPattern()).toEqual({
    source: ["aws.states"],
    "detail-type": ["Step Functions Execution Status Change"],
    detail: {
      status: ["RUNNING"],
      stateMachineArn: [machine.stateMachineArn],
    },
  });
});
