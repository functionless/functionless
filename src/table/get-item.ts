import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import { addIfDefined, makeAppSyncTableIntegration } from "./appsync";
import {
  createDynamoAttributesIntegration,
  createDynamoDocumentIntegration,
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

export interface GetItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> {
  <Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>>(
    key: Key,
    input?: Omit<AWS.DynamoDB.DocumentClient.GetItemInput, "Key">
  ): Promise<
    GetItemOutput<Item, PartitionKey, RangeKey, Key, JsonFormat.Document>
  >;

  attributes<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >
  >(
    key: Key,
    input: Omit<AWS.DynamoDB.GetItemInput, "Key">
  ): Promise<
    GetItemOutput<Item, PartitionKey, RangeKey, Key, JsonFormat.AttributeValue>
  >;
  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
   */
  appsync<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >
  >(input: {
    key: Key;
    consistentRead?: boolean;
  }): Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;
}

export function createGetItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): GetItem<Item, PartitionKey, RangeKey> {
  const getItem: GetItem<Item, PartitionKey, RangeKey> =
    createDynamoDocumentIntegration<GetItem<Item, PartitionKey, RangeKey>>(
      table,
      "Table.getItem",
      "read",
      (client, [key, props]) => {
        return client
          .get({
            ...(props ?? {}),
            TableName: table.tableName,
            Key: key as any,
          })
          .promise() as any;
      }
    );

  getItem.attributes = createDynamoAttributesIntegration<
    GetItem<Item, PartitionKey, RangeKey>["attributes"]
  >(table, "Table.getItem.attributes", "read", (client, [key, props]) => {
    return client
      .getItem({
        ...(props ?? {}),
        TableName: table.tableName,
        Key: key as any,
      })
      .promise() as any;
  });

  getItem.appsync = makeAppSyncTableIntegration<
    GetItem<Item, PartitionKey, RangeKey>["appsync"]
  >(table, "getItem", {
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

  return getItem;
}
