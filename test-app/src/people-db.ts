import { Construct } from "constructs";
import {
  aws_dynamodb,
  aws_lambda,
  aws_logs,
  aws_stepfunctions,
  RemovalPolicy,
} from "aws-cdk-lib";
import {
  $AWS,
  Table,
  Function,
  $util,
  AppsyncResolver,
  AppsyncContext,
  ExpressStepFunction,
} from "functionless";

export interface Person {
  id: string;
  name: string;
}

export interface ProcessedPerson extends Person {
  score: number;
}

export class PeopleDatabase extends Construct {
  readonly personTable;
  readonly computeScore;
  readonly getPerson;
  readonly addPerson;
  readonly updateName;
  readonly deletePerson;
  readonly getPersonMachine;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.personTable = new Table<Person, "id", undefined>(
      new aws_dynamodb.Table(this, "table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      })
    );
    this.personTable.resource.applyRemovalPolicy(RemovalPolicy.DESTROY);

    this.computeScore = new Function<Person, number>(
      new aws_lambda.Function(this, "ComputeScore", {
        code: aws_lambda.Code.fromInline(
          "exports.handle = async function() {return 1;}"
        ),
        handler: "index.handle",
        runtime: aws_lambda.Runtime.NODEJS_14_X,
      })
    );

    new ExpressStepFunction(this, "TestMachine", () => {
      const names = ["sam", "brendan"];
      for (const name of names) {
        this.computeScore({
          id: "id",
          name,
        });
      }
    });

    // a synchronous Express Step Function for getting a Person
    this.getPersonMachine = new ExpressStepFunction(
      this,
      "GetPersonMachine",
      {
        logs: {
          destination: new aws_logs.LogGroup(this, "GetPersonMachineLogs"),
          level: aws_stepfunctions.LogLevel.ALL,
        },
      },
      (id: string) => {
        const person = $AWS.DynamoDB.GetItem({
          TableName: this.personTable,
          Key: {
            id: {
              S: id,
            },
          },
        });

        if (person.Item === undefined) {
          return undefined;
        }

        const score = this.computeScore({
          id: person.Item.id.S,
          name: person.Item.name.S,
        });

        return {
          id: person.Item.id.S,
          name: person.Item.name.S,
          score,
        };
      }
    );

    this.getPerson = new AppsyncResolver<
      { id: string },
      ProcessedPerson | undefined
    >(($context) => {
      // example of integrating with an Express Step Function from Appsync
      const person = this.getPersonMachine($context.arguments.id);

      if (person.status === "SUCCEEDED") {
        return person.output;
      } else {
        $util.error(person.cause, person.error);
      }
    });

    this.addPerson = new AppsyncResolver<{ input: { name: string } }, Person>(
      ($context) => {
        const person = this.personTable.putItem({
          key: {
            id: {
              S: $util.autoId(),
            },
          },
          attributeValues: {
            name: {
              S: $context.arguments.input.name,
            },
          },
        });

        return person;
      }
    );

    // example of inferring the TArguments and TResult from the function signature
    this.updateName = new AppsyncResolver(
      ($context: AppsyncContext<{ id: string; name: string }>) =>
        this.personTable.updateItem({
          key: {
            id: $util.dynamodb.toDynamoDB($context.arguments.id),
          },
          update: {
            expression: "SET #name = :name",
            expressionNames: {
              "#name": "name",
            },
            expressionValues: {
              ":name": $util.dynamodb.toDynamoDB($context.arguments.name),
            },
          },
        })
    );

    // example of explicitly specifying TArguments and TResult
    this.deletePerson = new AppsyncResolver<{ id: string }, Person | undefined>(
      ($context) =>
        this.personTable.deleteItem({
          key: {
            id: $util.dynamodb.toDynamoDB($context.arguments.id),
          },
        })
    );
  }
}
