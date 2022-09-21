import { ToAttributeMap } from "typesafe-dynamodb/lib/attribute-value";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import {
  addIfDefined,
  DynamoDBAppsyncExpression,
  makeAppSyncTableIntegration,
} from "./appsync";
import {
  createDynamoAttributesIntegration,
  createDynamoDocumentIntegration,
} from "./integration";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export interface PutItemOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.PutItemOutput, "Attributes"> {
  Attributes?: FormatObject<Item, Format>;
}

export interface PutItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> {
  <Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>>(
    key: Key,
    input?: Omit<AWS.DynamoDB.DocumentClient.PutItemInput, "Key">
  ): Promise<PutItemOutput<Item, JsonFormat.Document>>;

  attributes<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >
  >(
    key: Key,
    input: Omit<AWS.DynamoDB.PutItemInput, "Key">
  ): Promise<PutItemOutput<Item, JsonFormat.AttributeValue>>;

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
    attributeValues: ToAttributeMap<
      Omit<
        Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>,
        Exclude<PartitionKey | RangeKey, undefined>
      >
    >;
    condition?: DynamoDBAppsyncExpression;
    _version?: number;
  }): Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;
}

export function createPutItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): PutItem<Item, PartitionKey, RangeKey> {
  const putItem: PutItem<Item, PartitionKey, RangeKey> =
    createDynamoDocumentIntegration<PutItem<Item, PartitionKey, RangeKey>>(
      table,
      "Table.putItem",
      "write",
      (client, [item, props]) => {
        return client
          .put({
            ...(props ?? {}),
            TableName: table.tableName,
            Item: item,
          })
          .promise() as any;
      }
    );

  putItem.attributes = createDynamoAttributesIntegration<
    PutItem<Item, PartitionKey, RangeKey>["attributes"]
  >(table, "Table.putItem.attributes", "write", (client, [item, props]) => {
    return client
      .putItem({
        ...(props ?? {}),
        TableName: table.tableName,
        Item: item as any,
      })
      .promise() as any;
  });

  putItem.appsync = makeAppSyncTableIntegration<
    PutItem<Item, PartitionKey, RangeKey>["appsync"]
  >(table, "Table.putItem.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "PutItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        vtl.qr(
          `${request}.put('attributeValues', ${input}.get('attributeValues'))`
        );
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });

  return putItem;
}
