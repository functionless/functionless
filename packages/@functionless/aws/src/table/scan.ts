import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { DynamoDBAppsyncExpression } from "./appsync";

export type ScanInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.QueryInput
    : AWS.DynamoDB.DocumentClient.QueryInput,
  "TableName" | "ExpressionAttributeValues" | "ExclusiveStartKey"
> & {
  ExclusiveStartKey?: TableKey<Item, PartitionKey, RangeKey, Format>;
  ExpressionAttributeValues?: Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.QueryInput["ExpressionAttributeValues"]
    : AWS.DynamoDB.DocumentClient.QueryInput["ExpressionAttributeValues"];
};

export interface ScanOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.ScanOutput, "Items" | "LastEvaluatedKey"> {
  Items?: FormatObject<Item, Format>[];
  LastEvaluatedKey?: TableKey<Item, PartitionKey, RangeKey, Format>;
}

export type Scan<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = (
  input?: ScanInput<Item, PartitionKey, RangeKey, Format>
) => Promise<ScanOutput<Item, PartitionKey, RangeKey, Format>>;

export interface ScanAppsyncInput {
  query: DynamoDBAppsyncExpression;
  filter?: DynamoDBAppsyncExpression;
  index?: string;
  nextToken?: string;
  limit?: number;
  scanIndexForward?: boolean;
  consistentRead?: boolean;
  select?: "ALL_ATTRIBUTES" | "ALL_PROJECTED_ATTRIBUTES";
}

export interface ScanAppsyncOutput<Item> {
  items: Item[];
  nextToken: string;
  scannedCount: number;
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type ScanAppsync<Item> = (
  input: ScanAppsyncInput
) => Promise<ScanAppsyncOutput<Item>>;
