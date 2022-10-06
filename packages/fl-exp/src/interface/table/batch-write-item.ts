import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { AttributeKeyToObject } from "./util";

export interface BatchWriteItemInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<AWS.DynamoDB.BatchWriteItemInput, "RequestItems"> {
  RequestItems: WriteRequest<Item, PartitionKey, RangeKey, Key, Format>[];
}

export type WriteRequest<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> =
  | {
      PutRequest: PutRequest<Item, Format>;
      DeleteRequest?: never;
    }
  | {
      PutRequest?: never;
      DeleteRequest: DeleteRequest<Item, PartitionKey, RangeKey, Key, Format>;
    };

export interface DeleteRequest<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> {
  Key: Key;
}

export interface PutRequest<Item extends object, Format extends JsonFormat> {
  Item: FormatObject<Item, Format>;
}

export interface BatchWriteItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> {
  UnprocessedItems: WriteRequest<Item, PartitionKey, RangeKey, Key, Format>[];
}

export type BatchWriteItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(
  request: BatchWriteItemInput<Item, PartitionKey, RangeKey, Keys, Format>
) => Promise<BatchWriteItemOutput<Item, PartitionKey, RangeKey, Keys, Format>>;

// https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-batch-put-item

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-batch-delete-item
 */
export type BatchDeleteItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  keys: Key[]
) => Promise<{
  data: (TableKey<
    Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  > | null)[];
  unprocessedKeys: AttributeKeyToObject<Key>[];
}>;

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-batch-delete-item
 */
export type BatchPutItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  items: FormatObject<Item, JsonFormat.AttributeValue>[]
) => Promise<{
  items: Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>[];
  unprocessedItems: Narrow<
    Item,
    AttributeKeyToObject<Key>,
    JsonFormat.Document
  >[];
}>;
