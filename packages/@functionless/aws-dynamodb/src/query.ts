import type DynamoDB from "aws-sdk/clients/dynamodb";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { DynamoDBAppsyncExpression } from "./appsync";

export type QueryInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = Omit<
  Format extends JsonFormat.AttributeValue
    ? DynamoDB.QueryInput
    : DynamoDB.DocumentClient.QueryInput,
  "TableName" | "ExpressionAttributeValues" | "ExclusiveStartKey"
> & {
  ExclusiveStartKey?: TableKey<Item, PartitionKey, RangeKey, Format>;
  ExpressionAttributeValues?: Format extends JsonFormat.AttributeValue
    ? DynamoDB.QueryInput["ExpressionAttributeValues"]
    : DynamoDB.DocumentClient.QueryInput["ExpressionAttributeValues"];
};

export interface QueryOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> extends Omit<DynamoDB.QueryOutput, "Items" | "LastEvaluatedKey"> {
  Items?: FormatObject<Item, Format>[];
  LastEvaluatedKey?: TableKey<Item, PartitionKey, RangeKey, Format>;
}

export type Query<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <I extends Item = Item>(
  input: QueryInput<I, PartitionKey, RangeKey, Format>
) => Promise<QueryOutput<I, PartitionKey, RangeKey, Format>>;

export interface QueryAppsyncInput {
  query: DynamoDBAppsyncExpression;
  filter?: DynamoDBAppsyncExpression;
  index?: string;
  nextToken?: string;
  limit?: number;
  scanIndexForward?: boolean;
  consistentRead?: boolean;
  select?: "ALL_ATTRIBUTES" | "ALL_PROJECTED_ATTRIBUTES";
}

export interface QueryAppsyncOutput<Item> {
  items: Item[];
  nextToken: string;
  scannedCount: number;
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type QueryAppsync<Item extends object> = <I extends Item = Item>(
  input: QueryAppsyncInput
) => Promise<QueryAppsyncOutput<I>>;
