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

export interface DeleteItemInput<
  Key,
  ReturnValue extends ReturnValues | undefined
> extends Omit<
    AWS.DynamoDB.DocumentClient.DeleteItemInput,
    "TableName" | "Key" | "ReturnValues"
  > {
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
> extends Omit<AWS.DynamoDB.DocumentClient.DeleteItemOutput, "TableName"> {
  Attributes?: ReturnValue extends undefined | "NONE"
    ? undefined
    : ReturnValue extends "ALL_OLD" | "ALL_NEW"
    ? Narrow<Item, Key, Format>
    : Partial<Narrow<Item, Key, Format>>;
}

export type DeleteItemDocument<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>,
  Return extends ReturnValues | undefined = undefined
>(
  input: DeleteItemInput<Key, Return>
) => Promise<
  DeleteItemOutput<
    Item,
    PartitionKey,
    RangeKey,
    Key,
    Return,
    JsonFormat.Document
  >
>;

export function createDeleteItemDocumentIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): DeleteItemDocument<Item, PartitionKey, RangeKey> {
  return createDynamoDocumentIntegration<
    DeleteItemDocument<Item, PartitionKey, RangeKey>
  >(table, "deleteItem", "write", (client, [request]) => {
    return client
      .delete({
        ...(request ?? {}),
        TableName: table.tableName,
        Key: request as any,
      })
      .promise() as any;
  });
}

export type DeleteItemAttributes<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>,
  Return extends ReturnValues | undefined = undefined
>(
  input: DeleteItemInput<Key, Return>
) => Promise<
  DeleteItemOutput<
    Item,
    PartitionKey,
    RangeKey,
    Key,
    Return,
    JsonFormat.AttributeValue
  >
>;

export function createDeleteItemAttributesIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): DeleteItemAttributes<Item, PartitionKey, RangeKey> {
  return createDynamoAttributesIntegration<
    DeleteItemAttributes<Item, PartitionKey, RangeKey>
  >(table, "deleteItem", "write", (client, [request]) => {
    return client
      .deleteItem({
        ...(request ?? {}),
        TableName: table.tableName,
      } as any)
      .promise() as any;
  });
}

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

export function createDeleteItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): DeleteItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    DeleteItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.deleteItem.appsync", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "DeleteItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });
}
