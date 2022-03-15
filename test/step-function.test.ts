import { App, aws_dynamodb, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import { $aws, ExpressStepFunction, Function, Table } from "../src";
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
    StartAt: "State1",
    States: {
      State1: {
        Type: "Task",
        Resource: getPerson.resource.functionArn,
        InputPath: "$.payload",
        Next: "Success",
        OutputPath: "$",
        Parameters: {
          payload: {
            id: "$.id",
          },
        },
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Fail",
          },
        ],
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Error: "TODO",
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
    StartAt: "State1",
    States: {
      State1: {
        Type: "Task",
        Resource: getPerson.resource.functionArn,
        InputPath: "$.payload",
        Next: "State2",
        OutputPath: "$.person",
        Parameters: {
          payload: {
            id: "$.id",
          },
        },
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Fail",
          },
        ],
      },
      State2: {
        Type: "Pass",
        Parameters: {
          "result.$": "$.person",
        },
        ResultPath: "$.result",
        Next: "Success",
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Error: "TODO",
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
      const person = $aws.DynamoDB.GetItem({
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
    StartAt: "State1",
    States: {
      State1: {
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Fail",
          },
        ],
        Next: "State2",
        OutputPath: "$.person",
        Parameters: {
          Key: {
            id: {
              "S.$": "$.id",
            },
          },
          TableName: personTable.resource.tableArn,
        },
        Resource: "arn:aws:states:::aws-sdk:dynamodb:getItem",
        Type: "Task",
      },
      State2: {
        Choices: [
          {
            Variable: "$.person.Item",
            IsNull: true,
            Next: "State3",
          },
        ],
        Default: "State4",
        Type: "Choice",
      },
      State3: {
        Next: "Success",
        Parameters: {
          result: undefined,
        },
        ResultPath: "$.result",
        Type: "Pass",
      },
      State4: {
        Next: "Success",
        Parameters: {
          result: {
            "id.$": "$.person.Item.id.S",
            "name.$": "$.person.Item.name.S",
          },
        },
        ResultPath: "$.result",
        Type: "Pass",
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Error: "TODO",
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
      const person = $aws.DynamoDB.GetItem({
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
    StartAt: "State1",
    States: {
      State1: {
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Fail",
          },
        ],
        Next: "State2",
        OutputPath: "$.person",
        Parameters: {
          Key: {
            id: {
              "S.$": "$.id",
            },
          },
          TableName: personTable.resource.tableArn,
        },
        Resource: "arn:aws:states:::aws-sdk:dynamodb:getItem",
        Type: "Task",
      },
      State2: {
        Choices: [
          {
            Variable: "$.person.Item",
            IsNull: true,
            Next: "State3",
          },
        ],
        Default: "Success",
        Type: "Choice",
      },
      State3: {
        Next: "Success",
        Parameters: {
          result: undefined,
        },
        ResultPath: "$.result",
        Type: "Pass",
      },
      State4: {
        Catch: [
          {
            ErrorEquals: ["States.All"],
            Next: "Fail",
          },
        ],
        InputPath: "$.payload",
        Next: "State5",
        OutputPath: "$.score",
        Parameters: {
          payload: {
            person: {
              "id.$": "$.person.Item.id.S",
              "name.$": "$.person.Item.name.S",
            },
          },
        },
        Resource: computeScore.resource.functionArn,
        Type: "Task",
      },
      State5: {
        Next: "Success",
        Parameters: {
          result: {
            "id.$": "$.person.Item.id.S",
            "name.$": "$.person.Item.name.S",
            "score.$": "$.score",
          },
        },
        ResultPath: "$.result",
        Type: "Pass",
      },
      Success: {
        Type: "Succeed",
      },
      Throw: {
        Error: "TODO",
        Type: "Fail",
      },
    },
  };
  expect(definition).toEqual(expected);
});
