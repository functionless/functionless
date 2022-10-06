import { aws_dynamodb } from "aws-cdk-lib";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import {
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export interface BatchWriteItemInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<AWS.DynamoDB.BatchWriteItemInput, "RequestItems"> {
  RequestItems: WriteRequest<Item, PartitionKey, RangeKey, Key, Format>[];
}

export type WriteRequest<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> =
  | {
      PutRequest: PutRequest<Item, Format>;
      DeleteRequest?: never;
    }
  | {
      PutRequest?: never;
      DeleteRequest: DeleteRequest<Item, PartitionKey, RangeKey, Key, Format>;
    };

export interface DeleteRequest<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> {
  Key: Key;
}

export interface PutRequest<Item extends object, Format extends JsonFormat> {
  Item: FormatObject<Item, Format>;
}

export interface BatchWriteItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> {
  UnprocessedItems: WriteRequest<Item, PartitionKey, RangeKey, Key, Format>[];
}

export type BatchWriteItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(
  request: BatchWriteItemInput<Item, PartitionKey, RangeKey, Keys, Format>
) => Promise<BatchWriteItemOutput<Item, PartitionKey, RangeKey, Keys, Format>>;

export function createBatchWriteItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): BatchWriteItem<Item, PartitionKey, RangeKey, Format> {
  const tableName = table.tableName;

  return createDynamoIntegration<
    BatchWriteItem<Item, PartitionKey, RangeKey, Format>,
    Format
  >(
    table,
    "batchWriteItem",
    format,
    "write",
    async (client, [{ RequestItems, ...props }]) => {
      const input: any = {
        ...props,
        RequestItems: {
          [tableName]: RequestItems,
        },
      };
      const response: any = await (format === JsonFormat.Document
        ? (client as AWS.DynamoDB.DocumentClient).batchWrite(input)
        : (client as AWS.DynamoDB).batchWriteItem(input)
      ).promise();

      return {
        ...response,
        UnprocessedItems: response.UnprocessedItems?.[tableName] as any,
      };
    },
    {
      prepareParams: (input) => {
        const requestItems$ = input["RequestItems.$"];
        const requestItems = input.RequestItems;
        return <AWS.DynamoDB.BatchWriteItemInput>{
          RequestItems: requestItems$
            ? {
                [`${table.tableName}.$`]: requestItems$,
              }
            : {
                [table.tableName]: requestItems,
              },
        };
      },
      resultSelector: {
        // [*][0] is a hack for performing a safe nullish coalesce on arrays
        // when there are no UnprocessedItems[tableName], then an empty array is returned
        // when it does exist, then the single UnprocessedItems[tableName] array is returned
        // this only works because we know that there is only one table being interacted with at a time
        "UnprocessedItems.$": `$.UnprocessedItems[*][0]`,
      },
    }
  );
}

// https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-batch-put-item

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-batch-delete-item
 */
export type BatchDeleteItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  keys: Key[]
) => Promise<{
  data: (TableKey<
    Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  > | null)[];
  unprocessedKeys: AttributeKeyToObject<Key>[];
}>;

export function createBatchDeleteItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): BatchDeleteItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    BatchDeleteItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.batchDelete.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const keys = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "BatchDeleteItem", "version": "2018-05-29", "tables": {}}'
        );
        vtl.qr(`${request}.tables.put("${table.tableName}", ${keys})`);
        return vtl.json(request);
      },
      result: (result) => ({
        returnVariable: "$batch_delete_item_response",
        template: `#set($batch_delete_item_response = {})
#set($batch_delete_item_response.data = ${result}.data.get("${table.tableName}"))
#set($batch_delete_item_response.unprocessedKeys = ${result}.unprocessedKeys)`,
      }),
    },
  });
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-batch-delete-item
 */
export type BatchPutItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  items: FormatObject<Item, JsonFormat.AttributeValue>[]
) => Promise<{
  items: Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>[];
  unprocessedItems: Narrow<
    Item,
    AttributeKeyToObject<Key>,
    JsonFormat.Document
  >[];
}>;

export function createBatchPutItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): BatchPutItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    BatchPutItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.batchPut.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const keys = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "BatchPutItem", "version": "2018-05-29", "tables": {}}'
        );
        vtl.qr(`${request}.tables.put('${table.tableName}', ${keys})`);
        return vtl.json(request);
      },
      result: (result) => ({
        returnVariable: "$batch_put_item_response",
        template: `#set($batch_put_item_response = {})
#set($batch_put_item_response.items = ${result}.data.get('${table.tableName}'))
#set($batch_put_item_response.unprocessedItems = ${result}.unprocessedItems.get('${table.tableName}'))`,
      }),
    },
  });
}
