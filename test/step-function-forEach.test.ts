import "jest";
import { $SFN, ExpressStepFunction } from "../src";
import { initStepFunctionApp } from "./util";

/**
 * Was forced to split out step-function.test.ts because V8 was crashing ...
 */

test("return $SFN.forEach(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return $SFN.forEach(list, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.forEach(list, function(item))",
    States: {
      "return $SFN.forEach(list, function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              Parameters: {
                FunctionName: task.resource.functionName,
                Payload: "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("return $SFN.forEach(list, {maxConcurrency: 2} (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return $SFN.forEach(list, { maxConcurrency: 2 }, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.forEach(list, {maxConcurrency: 2}, function(item))",
    States: {
      "return $SFN.forEach(list, {maxConcurrency: 2}, function(item))": {
        End: true,
        ItemsPath: "$.list",
        MaxConcurrency: 2,
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              Parameters: {
                FunctionName: task.resource.functionName,
                Payload: "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("$SFN.forEach(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    $SFN.forEach(list, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.forEach(list, function(item))",
    States: {
      "$SFN.forEach(list, function(item))": {
        ItemsPath: "$.list",
        Next: "return null",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              Parameters: {
                FunctionName: task.resource.functionName,
                Payload: "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          item: "$$.Map.Item.Value",
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    const result = $SFN.forEach(list, (item) => task(item));
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: "result = $SFN.forEach(list, function(item))",
    States: {
      "result = $SFN.forEach(list, function(item))": {
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
              Parameters: {
                FunctionName: task.resource.functionName,
                Payload: "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Next: "return result",
        Parameters: {
          item: "$$.Map.Item.Value",
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return $SFN.forEach(list, (item) => {
      try {
        return task(item);
      } catch {
        return null;
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.forEach(list, function(item))",
    States: {
      "return $SFN.forEach(list, function(item))": {
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
              Parameters: {
                FunctionName: task.resource.functionName,
                Payload: "$.item",
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
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { $SFN.forEach(list, (item) => task(item)) } catch { return null }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return $SFN.forEach(list, (item) => task(item));
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.forEach(list, function(item))",
    States: {
      "return $SFN.forEach(list, function(item))": {
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
              Parameters: {
                FunctionName: task.resource.functionName,
                Payload: "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
          },
        },
        Parameters: {
          item: "$$.Map.Item.Value",
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
