import { Construct } from "constructs";
import { aws_dynamodb, aws_lambda } from "aws-cdk-lib";
import {
  $aws,
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

    this.computeScore = new Function<(person: Person) => number>(
      new aws_lambda.Function(this, "ComputeScore", {
        code: aws_lambda.Code.fromInline(
          "exports.handle = async function() {return 1;}"
        ),
        handler: "index.handle",
        runtime: aws_lambda.Runtime.NODEJS_14_X,
      })
    );

    // a synchronous Express Step Function for getting a Person
    this.getPersonMachine = new ExpressStepFunction(
      this,
      "GetPersonMachine",
      (id: string) => {
        const person = $aws.DynamoDB.GetItem({
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
      return this.getPersonMachine($context.arguments.id);
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
