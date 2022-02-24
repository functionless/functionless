import { aws_dynamodb } from "aws-cdk-lib";

import { Unmarshall } from "typesafe-dynamodb/lib/marshall";
import { GetItemInput, GetItemOutput } from "typesafe-dynamodb/lib/get-item";
import { KeyAttribute } from "typesafe-dynamodb/lib/key";

export function isTable(a: any): a is AnyTable {
  return a?.kind === "Table";
}

export type AnyTable = Table<object, keyof object, keyof object | undefined>;

export class Table<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> {
  readonly kind: "Table" = "Table";

  constructor(readonly resource: aws_dynamodb.ITable) {}
}

export interface Table<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> {
  getItem<
    Key extends KeyAttribute<Item, PartitionKey, RangeKey>,
    AttributesToGet extends keyof Item | undefined = undefined,
    ProjectionExpression extends string | undefined = undefined
  >(
    params: Omit<
      GetItemInput<
        Item,
        PartitionKey,
        RangeKey,
        Key,
        AttributesToGet,
        ProjectionExpression
      >,
      "TableName"
    >
  ): UnmarshallMap<
    GetItemOutput<Item, Key, AttributesToGet, ProjectionExpression>["Item"]
  >;
}

type UnmarshallMap<Item extends any> = {} & {
  [prop in keyof Item]: Unmarshall<Item[prop], undefined>;
};
