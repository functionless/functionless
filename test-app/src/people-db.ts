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
  readonly personTable: Table<Person, "id", undefined>;
  readonly computeScore: Lambda<(person: Person) => number>;

  constructor(scope: Construct, id: string) {
    super(scope, id);
    this.personTable = new Table(
      new aws_dynamodb.Table(scope, "table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      })
    );

    this.computeScore = new Lambda(
      new aws_lambda.Function(this, "ComputeScore", {
        code: aws_lambda.Code.fromInline("export function handle() {}"),
        handler: "index.handle",
        runtime: aws_lambda.Runtime.NODEJS_14_X,
      }),
      ["person"]
    );
  }

  readonly getPerson = appsyncFunction<(id: string) => ProcessedPerson | null>(
    (_$context, id) => {
      const person = this.personTable.getItem({
        Key: {
          id: $util.dynamodb.toDynamoDB(id),
        },
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
