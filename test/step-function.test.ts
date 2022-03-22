import { App, aws_dynamodb, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import { $AWS, ExpressStepFunction, Function, Table } from "../src";
import { StateMachine, States } from "../src/asl";

interface Person {
  id: string;
  name: string;
}

function init() {
  const app = new App({
    autoSynth: false,
  });
  const stack = new Stack(app, "stack");

  const getPerson = new Function<{ id: string }, Person | undefined>(
    new aws_lambda.Function(stack, "Func", {
      code: aws_lambda.Code.fromInline(
        "exports.handle = function() { return {id: 'id', name: 'name' }; }"
      ),
      handler: "index.handle",
      runtime: aws_lambda.Runtime.NODEJS_14_X,
    })
  );

  const computeScore = new Function<Person, number>(
    new aws_lambda.Function(stack, "ComputeScore", {
      code: aws_lambda.Code.fromInline(
        "exports.handle = function() { return 1; }"
      ),
      handler: "index.handle",
      runtime: aws_lambda.Runtime.NODEJS_14_X,
    })
  );

  const personTable = new Table<Person, "id">(
    new aws_dynamodb.Table(stack, "Table", {
      partitionKey: {
        name: "id",
        type: aws_dynamodb.AttributeType.STRING,
      },
    })
  );

  return { stack, computeScore, getPerson, personTable };
}

test("empty function", () => {
  const { stack } = init();
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
  const { stack } = init();
  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    return id;
  }).definition;

  const expected: StateMachine<States> = {
    StartAt: "return null",
    States: {
      "return id": {
        Type: "Pass",
        End: true,
        Parameters: {
          result: null,
        },
        OutputPath: "$.result",
      },
    },
  };
  expect(definition).toEqual(expected);
});

test("let and set", () => {
  const { stack } = init();
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
    return a;
  }).definition;

  expect(definition).toEqual({
    StartAt: "a = undefined",
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
        Next: "return a",
        Parameters: {
          key: "value",
        },
        ResultPath: "$.a",
        Type: "Pass",
      },
      "return a": {
        End: true,
        OutputPath: "$.result",
        Parameters: {
          "result.$": "$.a",
        },
        ResultPath: "$",
        Type: "Pass",
      },
    },
  });
});

test("return void", () => {
  const { stack } = init();
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
  const { stack } = init();
  const definition = new ExpressStepFunction(stack, "fn", (id: string) => {
    if (id === "hello") {
      return;
    }
  }).definition;

  const expected: StateMachine<States> = {
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
        Default: "return null",
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
    },
  };
  expect(definition).toEqual(expected);
});

test("if-else", () => {
  const { stack } = init();
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

test("if-else-if", () => {
  const { stack } = init();
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
  const { stack } = init();
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

test("return a single Lambda Function call", () => {
  const { stack, getPerson } = init();
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
  const { stack, getPerson } = init();
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
        Next: "return person",
        ResultPath: "$.person",
        Parameters: {
          FunctionName: getPerson.resource.functionName,
          Payload: {
            "id.$": "$.id",
          },
        },
      },
      "return person": {
        Type: "Pass",
        ResultPath: "$",
        Parameters: {
          "result.$": "$.person",
        },
        OutputPath: "$.result",
        End: true,
      },
    },
  });
});

test("return AWS.DynamoDB.GetItem", () => {
  const { stack, personTable } = init();
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
  const { stack, personTable, computeScore } = init();
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
  const { stack, computeScore } = init();
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
  const { stack, personTable } = init();
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

test("throw new Error", () => {
  const { stack } = init();

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
  const { stack } = init();

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

// test("try-catch Error", () => {
//   const { stack } = init();

//   // @ts-ignore
//   const definition = new ExpressStepFunction(stack, "fn", () => {
//     try {
//       throw new Error("cause");
//     } catch (err: any) {
//       if (err.message === "cause") {
//         return "hello";
//       } else {
//         return "world";
//       }
//     }
//   }).definition;

//   expect(definition).toEqual({
//     StartAt: "try",
//     States: {
//       try: {
//         Type: "Parallel",
//         Branches: [
//           {
//             StartAt: 'throw new Error("cause")',
//             States: {
//               'throw new Error("cause")': {
//                 Cause: '{"message":"cause"}',
//                 Error: "Error",
//                 Type: "Fail",
//               },
//             },
//           },
//         ],
//       },
//       Success: {
//         Type: "Succeed",
//       },
//       'return "hello"': {
//         End: true,
//         OutputPath: "$.result",
//         Parameters: {
//           result: "hello",
//         },
//         ResultPath: "$",
//         Type: "Pass",
//       },
//     },
//   });
// });
