import "jest";
import { $AWS, $SFN, ExpressStepFunction } from "../src";
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
  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    return id;
  }).definition;

  const expected: StateMachine<States> = {
    StartAt: "return id",
    States: {
      "return id": {
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
    (input: { id: string }) => {
      return input.id;
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: "return input.id",
    States: {
      "return input.id": {
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
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (input: { id?: string }) => {
      return input?.id;
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: "return input.id",
    States: {
      "return input.id": {
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
  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    return items.slice(1);
  }).definition;

  expect(definition).toEqual({
    StartAt: "return items.slice(1, null)",
    States: {
      "return items.slice(1, null)": {
        End: true,
        InputPath: "$.items[1:]",
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return items.slice(1, 3)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    return items.slice(1, 3);
  }).definition;

  expect(definition).toEqual({
    StartAt: "return items.slice(1, 3)",
    States: {
      "return items.slice(1, 3)": {
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
  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    return task({ key: items.slice(1, 3) });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return task({key: items.slice(1, 3)})",
    States: {
      "return task({key: items.slice(1, 3)})": {
        Type: "Task",
        End: true,
        Resource: "arn:aws:states:::lambda:invoke",
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
    a = "hello";
    a = [null];
    a = [1];
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
    return a;
  }).definition;

  expect(definition).toEqual({
    StartAt: "a = null",
    States: {
      'a = "hello"': {
        Next: "a = [null]",
        Parameters: "hello",
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = 0": {
        Next: 'a = "hello"',
        Parameters: 0,
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = [1]": {
        Next: "a = [true]",
        Parameters: [1],
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = [null]": {
        Next: "a = [1]",
        Parameters: [null],
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
      "a = false": {
        Next: "a = 0",
        Parameters: false,
        ResultPath: "$.a",
        Type: "Pass",
      },
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
      'a = {key: "value"}': {
        Next: "a = a",
        Parameters: {
          key: "value",
        },
        ResultPath: "$.a",
        Type: "Pass",
      },
      "a = a": {
        Next: "return a",
        InputPath: "$.a",
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
  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    if (id === "hello") {
      return;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'if(id == "hello")',
    States: {
      'if(id == "hello")': {
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
  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    if (id === "hello") {
      return "hello";
    } else {
      return "world";
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: 'if(id == "hello")',
    States: {
      'if(id == "hello")': {
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
  const definition = new ExpressStepFunction(stack, "fn", (id: any) => {
    if (id === null) {
      return "null";
    } else if (typeof id === "undefined") {
      return "undefined";
    } else if (typeof id === "string") {
      return "string";
    } else if (typeof id === "boolean") {
      return "boolean";
    } else if (typeof id === "number") {
      return "number";
    } else if (typeof id === "bigint") {
      return "bigint";
    }
    return null;
  }).definition;

  expect(definition).toEqual({
    StartAt: "if(id == null)",
    States: {
      "if(id == null)": {
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

test("if (typeof x !== ??)", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (id: any) => {
    if (id !== null) {
      return "null";
    } else if (typeof id !== "undefined") {
      return "undefined";
    } else if (typeof id !== "string") {
      return "string";
    } else if (typeof id !== "boolean") {
      return "boolean";
    } else if (typeof id !== "number") {
      return "number";
    } else if (typeof id !== "bigint") {
      return "bigint";
    }
    return null;
  }).definition;

  expect(definition).toEqual({
    StartAt: "if(id != null)",
    States: {
      "if(id != null)": {
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
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): string | void => {
      if (id === "hello") {
        return "hello";
      } else if (id === "world") {
        return "world";
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'if(id == "hello")',
    States: {
      'if(id == "hello")': {
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
  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    for (const item of items) {
      // @ts-ignore
      const a = item;
    }
  }).definition;

  const expected: StateMachine<States> = {
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
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
  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    for (const i in items) {
      // @ts-ignore
      const a = items[i];
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(i in items)",
    States: {
      "for(i in items)": {
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
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): Person | undefined => {
      return getPerson({ id });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return getPerson({id: id})",
    States: {
      "return getPerson({id: id})": {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        End: true,
        ResultPath: "$",
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

test("call Lambda Function, store as variable, return variable", () => {
  const { stack, getPerson } = initStepFunctionApp();
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): Person | undefined => {
      const person = getPerson({ id });
      return person;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "person = getPerson({id: id})",
    States: {
      "person = getPerson({id: id})": {
        Type: "Task",
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.person",
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
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): Person | undefined => {
      const person = $AWS.DynamoDB.GetItem({
        TableName: personTable,
        Key: {
          id: {
            S: id,
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
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt:
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: id}}})",
    States: {
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: id}}})":
        {
          Next: "if(person.Item == null)",
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
      "if(person.Item == null)": {
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
            Next: "return null",
          },
        ],
        Default: "return {id: person.Item.id.S, name: person.Item.name.S}",
        Type: "Choice",
      },
      "return null": {
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
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): (Person & { score: number }) | undefined => {
      const person = $AWS.DynamoDB.GetItem({
        TableName: personTable,
        Key: {
          id: {
            S: id,
          },
        },
      });

      if (person.Item === undefined) {
        return undefined;
      }

      const score = computeScore({
        id: person.Item.id.S,
        name: person.Item.name.S,
      });

      return {
        id: person.Item.id.S,
        name: person.Item.name.S,
        score,
      };
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt:
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: id}}})",
    States: {
      "person = $AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: id}}})":
        {
          Next: "if(person.Item == null)",
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
      "if(person.Item == null)": {
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
            Next: "return null",
          },
        ],
        Default:
          "score = computeScore({id: person.Item.id.S, name: person.Item.name.S})",
        Type: "Choice",
      },
      "return null": {
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
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): void => {
      const people = ["sam", "brendan"];
      for (const name of people) {
        computeScore({
          id,
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
          StartAt: "computeScore({id: id, name: name})",
          States: {
            "computeScore({id: id, name: name})": {
              Type: "Task",
              ResultPath: null,
              End: true,
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
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): void => {
      if (id === "hello") {
        $AWS.DynamoDB.GetItem({
          TableName: personTable,
          Key: {
            id: {
              S: id,
            },
          },
        });
      }
    }
  ).definition;

  const expected: StateMachine<States> = {
    StartAt: 'if(id == "hello")',
    States: {
      'if(id == "hello")': {
        Choices: [
          {
            Next: "$AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: id}}})",
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      "$AWS.DynamoDB.GetItem({TableName: personTable, Key: {id: {S: id}}})": {
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

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (seconds: number): string | void => {
      $SFN.waitFor(seconds);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.waitFor(seconds)",
    States: {
      "$SFN.waitFor(seconds)": {
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

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (until: string): string | void => {
      $SFN.waitUntil(until);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.waitUntil(until)",
    States: {
      "$SFN.waitUntil(until)": {
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

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      computeScore({
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

test("try-catch with inner return and no catch variable", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      computeScore({
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

  const definition = new ExpressStepFunction(stack, "fn", () => {
    try {
      computeScore({
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

  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    try {
      if (id === "hello") {
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
  }).definition;

  expect(definition).toEqual({
    StartAt: 'if(id == "hello")',
    States: {
      'if(id == "hello")': {
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

  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    try {
      if (id === "hello") {
        computeScore({
          id,
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
  }).definition;

  expect(definition).toEqual({
    StartAt: 'if(id == "hello")',
    States: {
      'if(id == "hello")': {
        Choices: [
          {
            Next: 'computeScore({id: id, name: "sam"})',
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: 'return "hello world"',
        Type: "Choice",
      },
      'computeScore({id: id, name: "sam"})': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        Next: 'return "hello world"',
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

  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    try {
      if (id === "hello") {
        return computeScore({
          id,
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
  }).definition;

  expect(definition).toEqual({
    StartAt: 'if(id == "hello")',
    States: {
      'if(id == "hello")': {
        Choices: [
          {
            Next: 'return computeScore({id: id, name: "sam"})',
            StringEquals: "hello",
            Variable: "$.id",
          },
        ],
        Default: 'return "hello world"',
        Type: "Choice",
      },
      'return computeScore({id: id, name: "sam"})': {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: "catch(err)",
            ResultPath: "$.err",
          },
        ],
        End: true,
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

  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    // @ts-ignore
    for (const item of items) {
      throw new Error("err");
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
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

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (items: string[]): string | void => {
      try {
        // @ts-ignore
        for (const item of items) {
          throw new Error("err");
        }
      } catch {
        return "hello";
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
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

test("try-catch, err variable, contains for-of, throw", () => {
  const { stack } = initStepFunctionApp();

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (items: string[]): string | void => {
      try {
        // @ts-ignore
        for (const item of items) {
          throw new Error("err");
        }
      } catch (err: any) {
        return err.message;
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
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

test("try-catch-finally", () => {
  const { stack, computeScore } = initStepFunctionApp();

  const definition = new ExpressStepFunction(stack, "fn", (): string | void => {
    try {
      computeScore({
        id: "id",
        name: "name",
      });
    } catch {
    } finally {
      return "hello";
    }
  }).definition;

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

  const definition = new ExpressStepFunction(stack, "fn", (): string | void => {
    try {
      task();
    } catch {
      throw new Error("cause");
    } finally {
      task("recover");
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "task(null)",
    States: {
      "task(null)": {
        Catch: [
          {
            ErrorEquals: ["States.ALL"],
            Next: 'throw new Error("cause")',
            ResultPath: null,
          },
        ],
        Next: 'task("recover")',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: null,
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

  const definition = new ExpressStepFunction(stack, "fn", (): void => {
    try {
      task("1");
    } catch {
      task("2");
    } finally {
      task("3");
    }
  }).definition;

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
        Next: `return "rock-star"`,
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

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): string | void => {
      try {
        throw new Error("go");
      } catch {
        if (id === "sam") {
          throw new Error("little");
        }
      } finally {
        // task should run after both throws
        // for second throw, an error should be re-thrown
        task();
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: 'throw new Error("go")',
    States: {
      'throw new Error("go")': {
        Next: 'if(id == "sam")',
        Result: {
          message: "go",
        },
        ResultPath: null,
        Type: "Pass",
      },
      'if(id == "sam")': {
        Choices: [
          {
            Next: 'throw new Error("little")',
            StringEquals: "sam",
            Variable: "$.id",
          },
        ],
        Default: "task(null)",
        Type: "Choice",
      },
      'throw new Error("little")': {
        Next: "task(null)",
        Result: {
          message: "little",
        },
        ResultPath: "$.0_tmp",
        Type: "Pass",
      },
      "task(null)": {
        Next: "exit finally",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: null,
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

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): string | void => {
      try {
        task("1");
      } catch {
        if (id === "sam") {
          throw new Error("little");
        }
      } finally {
        // task should run after both throws
        // for second throw, an error should be re-thrown
        task("2");
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
            Next: 'if(id == "sam")',
            ResultPath: null,
          },
        ],
        Next: 'task("2")',
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: "1",
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: null,
        Type: "Task",
      },
      'if(id == "sam")': {
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

  const definition = new ExpressStepFunction(stack, "fn", (): string | void => {
    try {
      task("1");
    } catch (err: any) {
      if (err.message === "sam") {
        throw new Error("little");
      }
    } finally {
      // task should run after both throws
      // for second throw, an error should be re-thrown
      task("2");
    }
  }).definition;

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

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (items: string[]): string | void => {
      try {
        for (const item of items) {
          task(item);
        }
      } catch (err: any) {
        if (err.message === "you dun' goofed") {
          throw new Error("little");
        }
      } finally {
        // task should run after both throws
        // for second throw, an error should be re-thrown
        task("2");
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
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

  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (items: string[]): string | void => {
      for (const item of items) {
        try {
          task(item);
        } catch (err: any) {
          if (err.message === "you dun' goofed") {
            throw new Error("little");
          }
        } finally {
          // task should run after both throws
          // for second throw, an error should be re-thrown
          task("2");
        }
      }
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
        Catch: undefined,
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
              Default: undefined,
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
    StartAt: "while (cond == null)",
    States: {
      "while (cond == null)": {
        Choices: [
          {
            Next: "cond = task(null)",
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
      "cond = task(null)": {
        Next: "while (cond == null)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: null,
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
    StartAt: "while (cond == null)",
    States: {
      "while (cond == null)": {
        Choices: [
          {
            Next: "cond = task(null)",
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
      "cond = task(null)": {
        Next: "while (cond == null)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: null,
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
    StartAt: "cond = task(null)",
    States: {
      "while (cond == null)": {
        Choices: [
          {
            Next: "cond = task(null)",
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
      "cond = task(null)": {
        Next: "while (cond == null)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: null,
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.map((item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.map(function(item))",
    States: {
      "return list.map(function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
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
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("list.map((item, i) => if (i == 0) task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.map((item, i) => {
      if (i === 0) {
        return task(item);
      } else {
        return null;
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.map(function(item, i))",
    States: {
      "return list.map(function(item, i))": {
        Type: "Map",
        End: true,
        ItemsPath: "$.list",
        MaxConcurrency: 1,
        Parameters: {
          i: "$$.Map.Item.Index",
          item: "$$.Map.Item.Value",
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.map((item, i) => {
      if (i === 0) {
        return task(item);
      } else {
        return task(list[0]);
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.map(function(item, i))",
    States: {
      "return list.map(function(item, i))": {
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
              Default: "return task(list[0])",
              Type: "Choice",
            },
            "return task(item)": {
              End: true,
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return task(list[0])": {
              End: true,
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
          i: "$$.Map.Item.Index",
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.map(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return list.map((item) => task(item));
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.map(function(item))",
    States: {
      "return list.map(function(item))": {
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

test("try { list.map(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.map((item) => {
      try {
        return task(item);
      } catch {
        return null;
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.map(function(item))",
    States: {
      "return list.map(function(item))": {
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
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.map(item => throw) }", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return list.map(() => {
        throw new Error("cause");
      });
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.map(function())",
    States: {
      "return list.map(function())": {
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return list.map(() => {
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
    StartAt: "return list.map(function())",
    States: {
      "return list.map(function())": {
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.forEach((item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.forEach(function(item))",
    States: {
      "return list.forEach(function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
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
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("list.forEach((item, i) => if (i == 0) task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.forEach((item, i) => {
      if (i === 0) {
        return task(item);
      } else {
        return null;
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.forEach(function(item, i))",
    States: {
      "return list.forEach(function(item, i))": {
        Type: "Map",
        End: true,
        ItemsPath: "$.list",
        MaxConcurrency: 1,
        Parameters: {
          i: "$$.Map.Item.Index",
          item: "$$.Map.Item.Value",
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.forEach((item, i) => {
      if (i === 0) {
        return task(item);
      } else {
        return task(list[0]);
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.forEach(function(item, i))",
    States: {
      "return list.forEach(function(item, i))": {
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
              Default: "return task(list[0])",
              Type: "Choice",
            },
            "return task(item)": {
              End: true,
              Parameters: {
                FunctionName: task.resource.functionName,
                "Payload.$": "$.item",
              },
              Resource: "arn:aws:states:::lambda:invoke",
              ResultPath: "$",
              Type: "Task",
            },
            "return task(list[0])": {
              End: true,
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
          i: "$$.Map.Item.Index",
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.forEach(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return list.forEach((item) => task(item));
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.forEach(function(item))",
    States: {
      "return list.forEach(function(item))": {
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

test("try { list.forEach(item => task(item)) }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return list.forEach((item) => {
      try {
        return task(item);
      } catch {
        return null;
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.forEach(function(item))",
    States: {
      "return list.forEach(function(item))": {
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
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { list.forEach(item => throw) }", () => {
  const { stack } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return list.forEach(() => {
        throw new Error("cause");
      });
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return list.forEach(function())",
    States: {
      "return list.forEach(function())": {
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return list.forEach(() => {
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
    StartAt: "return list.forEach(function())",
    States: {
      "return list.forEach(function())": {
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
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return $SFN.map(list, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(list, function(item))",
    States: {
      "return $SFN.map(list, function(item))": {
        End: true,
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
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
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("return $SFN.map(list, {maxConcurrency: 2} (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return $SFN.map(list, { maxConcurrency: 2 }, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(list, {maxConcurrency: 2}, function(item))",
    States: {
      "return $SFN.map(list, {maxConcurrency: 2}, function(item))": {
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
                "Payload.$": "$.item",
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

test("$SFN.map(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    $SFN.map(list, (item) => task(item));
  }).definition;

  expect(definition).toEqual({
    StartAt: "$SFN.map(list, function(item))",
    States: {
      "$SFN.map(list, function(item))": {
        ItemsPath: "$.list",
        Next: "return null",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
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

test("result = $SFN.map(list, (item) => task(item))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    const result = $SFN.map(list, (item) => task(item));
    return result;
  }).definition;

  expect(definition).toEqual({
    StartAt: "result = $SFN.map(list, function(item))",
    States: {
      "result = $SFN.map(list, function(item))": {
        ItemsPath: "$.list",
        Iterator: {
          StartAt: "return task(item)",
          States: {
            "return task(item)": {
              End: true,
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

test("return $SFN.map(list, (item) => try { task(item)) } catch { return null }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    return $SFN.map(list, (item) => {
      try {
        return task(item);
      } catch {
        return null;
      }
    });
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(list, function(item))",
    States: {
      "return $SFN.map(list, function(item))": {
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
          item: "$$.Map.Item.Value",
        },
        ResultPath: "$",
        Type: "Map",
      },
    },
  });
});

test("try { $SFN.map(list, (item) => task(item)) } catch { return null }", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (list: string[]) => {
    try {
      return $SFN.map(list, (item) => task(item));
    } catch {
      return null;
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "return $SFN.map(list, function(item))",
    States: {
      "return $SFN.map(list, function(item))": {
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
                "Payload.$": "$.item",
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
                "Payload.$": "$.item",
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
                "Payload.$": "$.item",
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
                "Payload.$": "$.item",
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
                "Payload.$": "$.item",
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

test("return task({ key: items.filter(*) })", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (items: { str: string; items: string[] }[]) => {
      return task({
        equals: items.filter((item) => item.str === "hello"),
        and: items.filter(
          (item) => item.str === "hello" && item.items[0] === "hello"
        ),
        or: items.filter(
          (item) => item.str === "hello" || item.items[0] === "hello"
        ),
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt:
      "return task({equals: items.filter(function(item)), and: items.filter(function(item)), or: items.filter(function(item))})",
    States: {
      "return task({equals: items.filter(function(item)), and: items.filter(function(item)), or: items.filter(function(item))})":
        {
          Type: "Task",
          End: true,
          Resource: "arn:aws:states:::lambda:invoke",
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

test("template literal strings", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (obj: { str: string; items: string }) => {
      return task({
        key: `${obj.str} ${"hello"} ${obj.items[0]}`,
      });
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return task({key: `obj.str hello obj.items[0]`})",
    States: {
      "return task({key: `obj.str hello obj.items[0]`})": {
        End: true,
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: {
            "key.$": "States.Format('{} hello {},$.obj.str,$.obj.items[0]')",
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
  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    for (const item of items) {
      if (item === "hello") {
        break;
      }
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
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
  const definition = new ExpressStepFunction(stack, "fn", (items: string[]) => {
    for (const item of items) {
      if (item === "hello") {
        continue;
      }
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "for(item of items)",
    States: {
      "for(item of items)": {
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
  const definition = new ExpressStepFunction(stack, "fn", (key: string) => {
    while (true) {
      if (key === "sam") {
        continue;
      }
      task(key);
    }
  }).definition;

  expect(definition).toEqual({
    StartAt: "while (true)",
    States: {
      "while (true)": {
        Choices: [
          {
            IsPresent: false,
            Next: 'if(key == "sam")',
            Variable: "$.0_true",
          },
        ],
        Default: "return null",
        Type: "Choice",
      },
      'if(key == "sam")': {
        Choices: [
          {
            Next: "continue",
            StringEquals: "sam",
            Variable: "$.key",
          },
        ],
        Default: "task(key)",
        Type: "Choice",
      },
      continue: {
        Next: "while (true)",
        ResultPath: null,
        Type: "Pass",
      },
      "task(key)": {
        Next: "while (true)",
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
  const definition = new ExpressStepFunction(stack, "fn", (key: string) => {
    do {
      if (key === "sam") {
        continue;
      }
      task(key);
    } while (true);
  }).definition;

  expect(definition).toEqual({
    StartAt: 'if(key == "sam")',
    States: {
      'if(key == "sam")': {
        Choices: [
          {
            Next: "continue",
            StringEquals: "sam",
            Variable: "$.key",
          },
        ],
        Default: "task(key)",
        Type: "Choice",
      },
      continue: {
        Next: 'if(key == "sam")',
        ResultPath: null,
        Type: "Pass",
      },
      "task(key)": {
        Next: "while (true)",
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
            Next: 'if(key == "sam")',
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
  const definition = new ExpressStepFunction(stack, "fn", () => {
    return task(task());
  }).definition;

  expect(definition).toEqual({
    StartAt: "0_tmp = task(null)",
    States: {
      "0_tmp = task(null)": {
        Next: "return task(0_tmp)",
        Parameters: {
          FunctionName: task.resource.functionName,
          Payload: null,
        },
        Resource: "arn:aws:states:::lambda:invoke",
        ResultPath: "$.0_tmp",
        Type: "Task",
      },
      "return task(0_tmp)": {
        End: true,
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

test("return cond ? task(1) : task(2))", () => {
  const { stack, task } = initStepFunctionApp();
  const definition = new ExpressStepFunction(stack, "fn", (cond: boolean) => {
    return cond ? task(1) : task(2);
  }).definition;

  expect(definition).toEqual({});
});
