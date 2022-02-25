import { Construct } from "constructs";
import { aws_dynamodb, aws_lambda } from "aws-cdk-lib";
import { Table, Lambda, appsyncFunction, $util } from "functionless";

export interface Person {
  id: string;
  name: string;
}

export interface ProcessedPerson extends Person {
  score: number;
}

export class PeopleDatabase extends Construct {
  readonly personTable = new Table<Person, "id", undefined>(
    new aws_dynamodb.Table(this, "table", {
      partitionKey: {
        name: "id",
        type: aws_dynamodb.AttributeType.STRING,
      },
    })
  );

  readonly computeScore = new Lambda<(person: Person) => number>(
    new aws_lambda.Function(this, "ComputeScore", {
      code: aws_lambda.Code.fromInline("export function handle() {}"),
      handler: "index.handle",
      runtime: aws_lambda.Runtime.NODEJS_14_X,
    }),
    ["person"]
  );

  readonly getPerson = appsyncFunction<(id: string) => ProcessedPerson | null>(
    (_$context, id) => {
      const person = this.personTable.getItem({
        key: {
          id: $util.dynamodb.toDynamoDBJson(id),
        },
        consistentRead: true,
      });

      if (person === undefined) {
        return null;
      }

      const score = this.computeScore(person);

      return {
        ...person,
        score,
      };
    }
  );
}
