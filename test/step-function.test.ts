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

  const getPerson = new Function<(id: string) => Person | undefined>(
    new aws_lambda.Function(stack, "Func", {
      code: aws_lambda.Code.fromInline(
        "exports.handle = function() { return {id: 'id', name: 'name' }; }"
      ),
      handler: "index.handle",
      runtime: aws_lambda.Runtime.NODEJS_14_X,
    })
  );

  const computeScore = new Function<(person: Person) => number>(
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

test("return a single Lambda Function call", () => {
  const { stack, getPerson } = init();
  const definition = new ExpressStepFunction(
    stack,
    "fn",
    (id: string): Person | undefined => {
      return getPerson(id);
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "return getPerson(id)",
    States: {
      "return getPerson(id)": {
        Type: "Task",
        Resource: getPerson.resource.functionArn,
        Next: "Success",
        ResultPath: "$",
        Parameters: {
          "id.$": "$.id",
        },
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Throw",
          },
        ],
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Type: "Fail",
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
      const person = getPerson(id);
      return person;
    }
  ).definition;

  expect(definition).toEqual({
    StartAt: "person = getPerson(id)",
    States: {
      "person = getPerson(id)": {
        Type: "Task",
        Resource: getPerson.resource.functionArn,
        Next: "return person",
        ResultPath: "$.person",
        Parameters: {
          "id.$": "$.id",
        },
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Throw",
          },
        ],
      },
      "return person": {
        Type: "Pass",
        ResultPath: "$",
        Parameters: {
          "result.$": "$.person",
        },
        OutputPath: "$.result",
        Next: "Success",
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Type: "Fail",
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
          Catch: [
            {
              ErrorEquals: ["States.All"],
              Next: "Throw",
            },
          ],
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
        Default: "return {id: person.Item.id.S, name: person.Item.name.S}",
        Type: "Choice",
      },
      "return null": {
        Next: "Success",
        ResultPath: "$",
        Result: null,
        Type: "Pass",
      },
      "return {id: person.Item.id.S, name: person.Item.name.S}": {
        Next: "Success",
        Parameters: {
          result: {
            "id.$": "$.person.Item.id.S",
            "name.$": "$.person.Item.name.S",
          },
        },
        ResultPath: "$",
        OutputPath: "$.result",
        Type: "Pass",
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Type: "Fail",
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
          Catch: [
            {
              ErrorEquals: ["States.All"],
              Next: "Throw",
            },
          ],
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
        Next: "Success",
        Result: null,
        ResultPath: "$",
        Type: "Pass",
      },
      "score = computeScore({id: person.Item.id.S, name: person.Item.name.S})":
        {
          Catch: [
            {
              ErrorEquals: ["States.All"],
              Next: "Throw",
            },
          ],
          Next: "return {id: person.Item.id.S, name: person.Item.name.S, score: score}",
          ResultPath: "$.score",
          Parameters: {
            person: {
              "id.$": "$.person.Item.id.S",
              "name.$": "$.person.Item.name.S",
            },
          },
          Resource: computeScore.resource.functionArn,
          Type: "Task",
        },
      "return {id: person.Item.id.S, name: person.Item.name.S, score: score}": {
        Next: "Success",
        ResultPath: "$",
        Parameters: {
          result: {
            "id.$": "$.person.Item.id.S",
            "name.$": "$.person.Item.name.S",
            "score.$": "$.score",
          },
        },
        OutputPath: "$.result",
        Type: "Pass",
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Type: "Fail",
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
        Next: "for(name of people)",
        OutputPath: "$.result",
        ResultPath: "$.people",
        Parameters: {
          result: ["sam", "brendan"],
        },
        Type: "Pass",
      },
      "for(name of people)": {
        Type: "Map",
        ItemsPath: "$.people",
        ResultPath: null,
        MaxConcurrency: 1,
        Next: "return null",
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Throw",
          },
        ],
        Parameters: {
          "name.$": "$$.Map.Item.Value",
        },
        Iterator: {
          StartAt: "computeScore({id: id, name: name})",
          States: {
            "computeScore({id: id, name: name})": {
              ResultPath: null,
              Catch: [
                {
                  ErrorEquals: ["States.All"],
                  Next: "Throw1",
                },
              ],
              Next: "Success1",
              Parameters: {
                person: {
                  "id.$": "$.id",
                  "name.$": "$.name",
                },
              },
              Resource: computeScore.resource.functionArn,
              Type: "Task",
            },
            Success1: {
              Type: "Succeed",
            },
            Throw1: {
              Type: "Fail",
            },
          },
        },
      },
      "return null": {
        Type: "Pass",
        Result: null,
        ResultPath: "$",
        Next: "Success",
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Type: "Fail",
      },
    },
  };
  expect(definition).toEqual(expected);
});
