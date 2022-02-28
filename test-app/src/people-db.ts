import { Construct } from "constructs";
import { aws_dynamodb, aws_lambda } from "aws-cdk-lib";
import { Table, Function, $util, AppsyncFunction, reflect } from "functionless";

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

    this.getPerson = new AppsyncFunction<
      (id: string) => ProcessedPerson | null
    >((_$context, id) => {
      const person = this.personTable.getItem({
        key: {
          id: $util.dynamodb.toDynamoDB(id),
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
    });

    this.addPerson = new AppsyncFunction<(input: { name: string }) => Person>(
      (_$context, input) => {
        const person = this.personTable.putItem({
          key: {
            id: {
              S: $util.autoId(),
            },
          },
          attributeValues: {
            name: {
              S: input.name,
            },
          },
        });

        return person;
      }
    );
  }
}
