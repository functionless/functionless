import { GraphqlApi } from "@aws-cdk/aws-appsync-alpha";
import {
  aws_dynamodb,
  aws_logs,
  aws_stepfunctions,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Construct } from "constructs";
import {
  $AWS,
  Table,
  Function,
  $util,
  AppsyncResolver,
  AppsyncContext,
  ExpressStepFunction,
} from "functionless";

import {
  QueryResolvers,
  MutationResolvers,
  Person,
  ProcessedPerson,
} from "./generated-types";

export { Person };

export interface PeopleDatabaseProps {
  api: GraphqlApi;
}

export class PeopleDatabase extends Construct {
  readonly personTable;
  readonly computeScore;
  readonly getPerson;
  readonly addPerson;
  readonly updateName;
  readonly deletePerson;
  readonly getPersonMachine;
  readonly testMachine;

  constructor(scope: Construct, id: string, { api }: PeopleDatabaseProps) {
    super(scope, id);

    this.personTable = Table.fromTable<Person, "id", undefined>(
      new aws_dynamodb.Table(this, "table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      })
    );
    this.personTable.resource.applyRemovalPolicy(RemovalPolicy.DESTROY);

    this.computeScore = new Function<Person, number>(
      this,
      "ComputeScore",
      async () => {
        return 1;
      }
    );

    this.testMachine = new ExpressStepFunction(
      this,
      "TestMachine",
      async () => {
        const names = ["sam g", "sam s"];

        for (const i in names) {
          await this.computeScore({
            id: "id",
            name: names[i],
          });
        }
      }
    );

    // a synchronous Express Step Function for getting a Person
    this.getPersonMachine = new ExpressStepFunction<
      { id: string },
      undefined | ProcessedPerson
    >(
      this,
      "GetPersonMachine",
      {
        logs: {
          destination: new aws_logs.LogGroup(this, "GetPersonMachineLogs"),
          level: aws_stepfunctions.LogLevel.ALL,
        },
      },
      async (input) => {
        const person = await $AWS.DynamoDB.GetItem({
          Table: this.personTable,
          Key: {
            id: {
              S: input.id,
            },
          },
        });

        if (person.Item === undefined) {
          return undefined;
        }

        const score = await this.computeScore({
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
      QueryResolvers["getPerson"]["args"],
      QueryResolvers["getPerson"]["result"]
    >(
      this,
      "getPerson",
      {
        api,
        typeName: "Query",
        fieldName: "getPerson",
      },
      async ($context) => {
        let person;
        // example of integrating with an Express Step Function from Appsync
        person = await this.getPersonMachine({
          input: { id: $context.arguments.id },
        });

        if (person.status === "SUCCEEDED") {
          return person.output;
        } else {
          $util.error(person.cause, person.error);
        }
      }
    );

    this.addPerson = new AppsyncResolver<
      MutationResolvers["addPerson"]["args"],
      MutationResolvers["addPerson"]["result"]
    >(
      this,
      "addPerson",
      {
        api,
        typeName: "Query",
        fieldName: "addPerson",
      },
      ($context) => {
        const person = this.personTable.appsync.putItem({
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
      this,
      "updateName",
      {
        api,
        typeName: "Mutation",
        fieldName: "updateName",
      },
      ($context: AppsyncContext<MutationResolvers["updateName"]["args"]>) =>
        this.personTable.appsync.updateItem({
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
    this.deletePerson = new AppsyncResolver<
      MutationResolvers["deletePerson"]["args"],
      MutationResolvers["deletePerson"]["result"]
    >(
      this,
      "deletePerson",
      {
        api,
        typeName: "Mutation",
        fieldName: "deletePerson",
      },
      ($context) =>
        this.personTable.appsync.deleteItem({
          key: {
            id: $util.dynamodb.toDynamoDB($context.arguments.id),
          },
        })
    );
  }
}
