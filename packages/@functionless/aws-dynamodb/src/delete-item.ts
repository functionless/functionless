import type DynamoDB from "aws-sdk/clients/dynamodb";
import { JsonFormat } from "typesafe-dynamodb";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { DynamoDBAppsyncExpression } from "./appsync";
import { ReturnValues } from "./return-value";
import { AttributeKeyToObject } from "./util";

export type DeleteItemReturnValues = "NONE" | "ALL_OLD";

export interface DeleteItemInput<
  Key,
  ReturnValue extends DeleteItemReturnValues | undefined
> extends Omit<DynamoDB.DocumentClient.DeleteItemInput, "TableName" | "Key"> {
  Key: Key;
  ReturnValues?: ReturnValue;
}

export interface DeleteItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  ReturnValue extends ReturnValues | undefined,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<DynamoDB.DocumentClient.DeleteItemOutput, "TableName"> {
  Attributes?: ReturnValue extends undefined | "NONE"
    ? undefined
    : ReturnValue extends "ALL_OLD" | "ALL_NEW"
    ? Narrow<Item, Key, Format>
    : Partial<Narrow<Item, Key, Format>>;
}

export type DeleteItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Return extends DeleteItemReturnValues | undefined = undefined
>(
  input: DeleteItemInput<Key, Return>
) => Promise<
  DeleteItemOutput<Item, PartitionKey, RangeKey, Key, Return, Format>
>;

export type DeleteItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(input: {
  key: Key;
  condition?: DynamoDBAppsyncExpression;
  _version?: number;
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;
