import type DynamoDB from "aws-sdk/clients/dynamodb";
import { JsonFormat } from "typesafe-dynamodb";
import { FormatObject } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { DynamoDBAppsyncExpression } from "./appsync";
import { ReturnValues } from "./return-value";
import { AttributeKeyToObject } from "./util";

export type UpdateItemInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  ReturnValue extends ReturnValues | undefined,
  Format extends JsonFormat
> = Omit<
  Format extends JsonFormat.Document
    ? DynamoDB.DocumentClient.UpdateItemInput
    : DynamoDB.UpdateItemInput,
  "TableName" | "Key"
> & {
  Key: Key;
  ReturnValues?: ReturnValue;
};

export interface UpdateItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  ReturnValue extends ReturnValues | undefined,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<DynamoDB.DocumentClient.UpdateItemOutput, "TableName"> {
  Attributes?: ReturnValue extends undefined | "NONE"
    ? undefined
    : ReturnValue extends "ALL_OLD" | "ALL_NEW"
    ? FormatObject<Narrow<Item, Key, Format>, Format>
    : Partial<FormatObject<Narrow<Item, Key, Format>, Format>>;
}

export type UpdateItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Return extends ReturnValues | undefined = undefined
>(
  input: UpdateItemInput<Item, PartitionKey, RangeKey, Key, Return, Format>
) => Promise<
  UpdateItemOutput<Item, PartitionKey, RangeKey, Key, Return, Format>
>;

export type UpdateItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(input: {
  key: Key;
  update: DynamoDBAppsyncExpression;
  condition?: DynamoDBAppsyncExpression;
  _version?: number;
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;
