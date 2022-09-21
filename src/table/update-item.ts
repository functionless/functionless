import { JsonFormat } from "typesafe-dynamodb";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { ReturnValues } from "./return-value";

export interface UpdateItemInput<
  Key,
  ReturnValue extends ReturnValues | undefined
> extends Omit<
    AWS.DynamoDB.DocumentClient.UpdateItemInput,
    "TableName" | "Key" | "ReturnValues"
  > {
  Key: Key;
  ReturnValues?: ReturnValue;
}

export interface UpdateItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  ReturnValue extends ReturnValues | undefined,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<AWS.DynamoDB.DocumentClient.UpdateItemOutput, "TableName"> {
  Attributes?: ReturnValue extends undefined | "NONE"
    ? undefined
    : ReturnValue extends "ALL_OLD" | "ALL_NEW"
    ? Narrow<Item, Key, Format>
    : Partial<Narrow<Item, Key, Format>>;
}

export interface UpdateItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> {
  <
    Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>,
    Return extends ReturnValues | undefined = undefined
  >(
    input: UpdateItemInput<Key, Return>
  ): Promise<
    UpdateItemOutput<
      Item,
      PartitionKey,
      RangeKey,
      Key,
      Return,
      JsonFormat.Document
    >
  >;

  attributes<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >,
    Return extends ReturnValues | undefined = undefined
  >(
    input: UpdateItemInput<Key, Return>
  ): Promise<
    UpdateItemOutput<
      Item,
      PartitionKey,
      RangeKey,
      Key,
      Return,
      JsonFormat.AttributeValue
    >
  >;
}
