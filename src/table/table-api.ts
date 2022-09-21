import { JsonFormat } from "typesafe-dynamodb";
import { NativeBinaryAttribute } from "typesafe-dynamodb/lib/attribute-value";
import { FormatObject } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { ITableAppsyncApi } from "./table-appsync-api";

export interface DeleteItemInput<
  Key extends TableKey<any, any, any, JsonFormat.Document>,
  ReturnValue extends ReturnValues | undefined
> extends Omit<AWS.DynamoDB.DocumentClient.DeleteItemInput, "TableName"> {
  Key: Key;
  ReturnValues?: ReturnValue;
}

export interface DeleteItemOutput<
  Item extends object,
  ReturnValue extends ReturnValues | undefined,
  Key extends TableKey<any, any, any, JsonFormat.Document>
> extends Omit<AWS.DynamoDB.DocumentClient.DeleteItemOutput, "TableName"> {
  Attributes?: ReturnValue extends undefined | "NONE"
    ? undefined
    : ReturnValue extends "ALL_OLD" | "ALL_NEW"
    ? Narrow<Item, Key, JsonFormat.Document>
    : Partial<Narrow<Item, Key, JsonFormat.Document>>;
}

export interface BatchGetItemOutput<Item extends object>
  extends Omit<AWS.DynamoDB.BatchGetItemOutput, "Item" | "Responses"> {
  Items?: Item[];
}

export interface PutItemOutput<Item extends object>
  extends Omit<AWS.DynamoDB.PutItemOutput, "Attributes"> {
  Attributes?: FormatObject<Item, JsonFormat.Document>;
}

export interface QueryOutput<Item extends object>
  extends Omit<AWS.DynamoDB.QueryOutput, "Items"> {
  Items?: FormatObject<Item, JsonFormat.Document>[];
}
export interface ScanOutput<Item extends object>
  extends Omit<AWS.DynamoDB.ScanOutput, "Items"> {
  Items?: FormatObject<Item, JsonFormat.Document>[];
}
