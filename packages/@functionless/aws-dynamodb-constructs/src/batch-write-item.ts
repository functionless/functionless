import {
  BatchWriteItem,
  BatchDeleteItemAppsync,
  BatchPutItemAppsync,
} from "@functionless/aws-dynamodb";
import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import {
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

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
