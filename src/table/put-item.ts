import { aws_dynamodb } from "aws-cdk-lib";
import { ToAttributeMap } from "typesafe-dynamodb/lib/attribute-value";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import { DynamoDBAppsyncExpression } from "./appsync";
import {
  addIfDefined,
  createDynamoIntegration,
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

export type PutItem<Item extends object, Format extends JsonFormat> = <
  I extends Item
>(
  input: PutItemInput<I, JsonFormat.Document>
) => Promise<PutItemOutput<Item, Format>>;

export function createPutItemIntegration<
  Item extends object,
  Format extends JsonFormat
>(table: aws_dynamodb.ITable, format: Format): PutItem<Item, Format> {
  return createDynamoIntegration<PutItem<Item, Format>, Format>(
    table,
    "putItem",
    format,
    "write",
    (client, [request]) => {
      const input: any = {
        ...request,
        TableName: table.tableName,
      };
      if (format === JsonFormat.AttributeValue) {
        return (client as AWS.DynamoDB).putItem(input).promise() as any;
      } else {
        return (client as AWS.DynamoDB.DocumentClient).put(input).promise();
      }
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
