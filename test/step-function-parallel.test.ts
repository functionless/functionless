import "jest";
import { $SFN, ExpressStepFunction } from "../src";
import { initStepFunctionApp } from "./util";

/**
 * Was forced to split out step-function.test.ts because V8 was crashing ...
 */

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
            StartAt: "return task(null)",
            States: {
              "return task(null)": {
                Catch: [
                  {
                    ErrorEquals: ["States.ALL"],
                    Next: "return null",
                    ResultPath: null,
                  },
                ],
                End: true,
                Parameters: {
                  FunctionName: task.resource.functionName,
                  Payload: null,
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
