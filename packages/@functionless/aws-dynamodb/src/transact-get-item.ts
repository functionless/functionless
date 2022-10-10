import type DynamoDB from "aws-sdk/clients/dynamodb";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { AttributeKeyToObject } from "./util";

export interface TransactGetItemsInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> {
  TransactItems: TransactGetItem<Item, PartitionKey, RangeKey, Keys, Format>[];
}

export interface TransactGetItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> {
  /**
   * Contains the primary key that identifies the item to get, together with the name of the table that contains the item, and optionally the specific attributes of the item to retrieve.
   */
  Get: Get<Item, PartitionKey, RangeKey, Key, Format>;
}

export interface Get<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> extends Omit<DynamoDB.Get, "TableName" | "Key"> {
  Key: Key;
}

export interface TransactGetItemsOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> extends Omit<DynamoDB.TransactGetItemsOutput, "Item" | "Responses"> {
  Items: FormatObject<Narrow<Item, Keys, Format>, Format>[];
}

export type TransactGetItems<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(
  request: TransactGetItemsInput<Item, PartitionKey, RangeKey, Keys, Format>
) => Promise<
  TransactGetItemsOutput<Item, PartitionKey, RangeKey, Keys, Format>
>;

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type TransactGetItemsAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  items: {
    key: Key;
  }[]
) => Promise<{
  items: Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>[] | null;
  cancellationReasons: { type: string; message: string }[] | null;
}>;
