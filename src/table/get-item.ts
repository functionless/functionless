import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import {
  addIfDefined,
  createDynamoAttributesIntegration,
  createDynamoDocumentIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export interface GetItemInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<AWS.DynamoDB.GetItemInput, "Key"> {
  Key: Key;
}

export interface GetItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<AWS.DynamoDB.DocumentClient.GetItemOutput, "Item"> {
  Item?: FormatObject<Narrow<Item, Key, Format>, Format>;
}

export type GetItemDocument<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>>(
  input: GetItemInput<Item, PartitionKey, RangeKey, Key, JsonFormat.Document>
) => Promise<
  GetItemOutput<Item, PartitionKey, RangeKey, Key, JsonFormat.Document>
>;

export function createGetItemDocumentIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): GetItemDocument<Item, PartitionKey, RangeKey> {
  const getItem: GetItemDocument<Item, PartitionKey, RangeKey> =
    createDynamoDocumentIntegration<
      GetItemDocument<Item, PartitionKey, RangeKey>
    >(table, "getItem", "read", (client, [input]) => {
      return client
        .get({
          ...input,
          TableName: table.tableName,
        })
        .promise() as any;
    });

  return getItem;
}

export type GetItemAttributes<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  input: GetItemInput<
    Item,
    PartitionKey,
    RangeKey,
    Key,
    JsonFormat.AttributeValue
  >
) => Promise<
  GetItemOutput<Item, PartitionKey, RangeKey, Key, JsonFormat.AttributeValue>
>;

export function createGetItemAttributesIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>) {
  return createDynamoAttributesIntegration<
    GetItemAttributes<Item, PartitionKey, RangeKey>
  >(table, "getItem", "read", (client, [request]) => {
    return client
      .getItem({
        ...(request as any),
        TableName: table.tableName,
      })
      .promise() as any;
  });
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type GetItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(input: {
  key: Key;
  consistentRead?: boolean;
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;

export function createGetItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): GetItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    GetItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.getItem.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "GetItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        addIfDefined(vtl, input, request, "consistentRead");
        return vtl.json(request);
      },
    },
  });
}
