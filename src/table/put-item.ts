import { ToAttributeMap } from "typesafe-dynamodb/lib/attribute-value";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
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
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export interface PutItemInput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.PutItemOutput, "Attributes"> {
  Item: FormatObject<Item, Format>;
}

export interface PutItemOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.PutItemOutput, "Attributes"> {
  Attributes?: FormatObject<Item, Format>;
}

export type PutItemDocument<Item extends object> = <I extends Item>(
  input: PutItemInput<I, JsonFormat.Document>
) => Promise<PutItemOutput<Item, JsonFormat.Document>>;

export function createPutItemDocumentIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): PutItemDocument<Item> {
  return createDynamoDocumentIntegration<PutItemDocument<Item>>(
    table,
    "putItem",
    "write",
    (client, [request]) => {
      return client
        .put({
          ...request,
          TableName: table.tableName,
        })
        .promise() as any;
    }
  );
}

export type PutItemAttributes<Item extends object> = <
  I extends FormatObject<Item, JsonFormat.AttributeValue>
>(
  input: PutItemInput<I, JsonFormat.AttributeValue>
) => Promise<PutItemOutput<Item, JsonFormat.AttributeValue>>;

export function createPutItemAttributesIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): PutItemAttributes<Item> {
  return createDynamoAttributesIntegration<PutItemAttributes<Item>>(
    table,
    "putItem",
    "write",
    (client, [input]) => {
      return client
        .putItem({
          ...(input as any),
          TableName: table.tableName,
        })
        .promise() as any;
    }
  );
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type PutItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
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
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;

export function createPutItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): PutItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    PutItemAppsync<Item, PartitionKey, RangeKey>
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
}
