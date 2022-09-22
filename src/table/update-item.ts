import { JsonFormat } from "typesafe-dynamodb";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import { DynamoDBAppsyncExpression } from "./appsync";
import {
  addIfDefined,
  createDynamoAttributesIntegration,
  createDynamoDocumentIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ReturnValues } from "./return-value";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

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

export type UpdateItemDocument<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>,
  Return extends ReturnValues | undefined = undefined
>(
  input: UpdateItemInput<Key, Return>
) => Promise<
  UpdateItemOutput<
    Item,
    PartitionKey,
    RangeKey,
    Key,
    Return,
    JsonFormat.Document
  >
>;

export function createUpdateItemDocumentIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): UpdateItemDocument<Item, PartitionKey, RangeKey> {
  return createDynamoDocumentIntegration<
    UpdateItemDocument<Item, PartitionKey, RangeKey>
  >(table, "updateItem", "write", (client, [request]) => {
    return client
      .update({
        ...(request ?? {}),
        TableName: table.tableName,
        Key: request as any,
      })
      .promise() as any;
  });
}

export type UpdateItemAttributes<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>,
  Return extends ReturnValues | undefined = undefined
>(
  input: UpdateItemInput<Key, Return>
) => Promise<
  UpdateItemOutput<
    Item,
    PartitionKey,
    RangeKey,
    Key,
    Return,
    JsonFormat.AttributeValue
  >
>;

export function createUpdateItemAttributesIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): UpdateItemAttributes<Item, PartitionKey, RangeKey> {
  return createDynamoAttributesIntegration<
    UpdateItemAttributes<Item, PartitionKey, RangeKey>
  >(table, "updateItem", "write", (client, [request]) => {
    return client
      .updateItem({
        ...(request ?? {}),
        TableName: table.tableName,
      } as any)
      .promise() as any;
  });
}

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

export function createUpdateItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): UpdateItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    UpdateItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.updateItem.appsync", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "UpdateItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        vtl.qr(`${request}.put('update', ${input}.get('update'))`);
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });
}
