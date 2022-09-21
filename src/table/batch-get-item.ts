import { PromiseResult } from "aws-sdk/lib/request";
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
export interface BatchGetItemOutput<
  Item extends object,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.BatchGetItemOutput, "Item" | "Responses"> {
  Items?: FormatObject<Item, Format>[];
}

type BatchGetItemSignature<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = (
  keys: readonly TableKey<Item, PartitionKey, RangeKey, Format>[],
  props?: Omit<AWS.DynamoDB.KeysAndAttributes, "Keys">
) => Promise<BatchGetItemOutput<Item, Format>>;

export interface BatchGetItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> extends BatchGetItemSignature<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  > {
  attributes(
    keys: readonly TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >[],
    props?: Omit<AWS.DynamoDB.KeysAndAttributes, "Keys">
  ): Promise<BatchGetItemOutput<Item, JsonFormat.AttributeValue>>;
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

export function createBatchGetItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): BatchGetItem<Item, PartitionKey, RangeKey> {
  const batchGetItem: BatchGetItem<Item, PartitionKey, RangeKey> =
    createDynamoDocumentIntegration<BatchGetItem<Item, PartitionKey, RangeKey>>(
      table,
      "Table.getItem",
      "read",
      async (client, [keys, props]) => {
        const response: PromiseResult<
          AWS.DynamoDB.DocumentClient.BatchGetItemOutput,
          any
        > = await client
          .batchGet({
            ...(props ?? {}),
            RequestItems: {
              [table.tableName]: {
                Keys: keys,
                ...props,
              },
            } as any,
          })
          .promise();

        return {
          ...response,
          Items: response.Responses?.[table.tableName] as Item[],
        };
      }
    );

  batchGetItem.attributes = createDynamoAttributesIntegration<
    BatchGetItem<Item, PartitionKey, RangeKey>["attributes"]
  >(
    table,
    "Table.getItem.attributes",
    "read",
    async (client, [keys, props]) => {
      const response: PromiseResult<AWS.DynamoDB.BatchGetItemOutput, any> =
        await client
          .batchGetItem({
            ...(props ?? {}),
            RequestItems: {
              [table.tableName]: {
                Keys: keys,
                ...props,
              },
            } as any,
          })
          .promise();

      return {
        ...response,
        Items: response.Responses?.[table.tableName] as FormatObject<
          Item,
          JsonFormat.AttributeValue
        >[],
      };
    }
  );

  batchGetItem.appsync = makeAppSyncTableIntegration<
    BatchGetItem<Item, PartitionKey, RangeKey>["appsync"]
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

  return batchGetItem;
}
