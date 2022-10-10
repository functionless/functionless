import type {
  BatchGetItem,
  BatchGetItemAppsync,
} from "@functionless/aws-dynamodb";
import { aws_dynamodb } from "aws-cdk-lib";
import { PromiseResult } from "aws-sdk/lib/request";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

/**
 * Creates an Integration for the BatchGetItem DynamoDB API.
 *
 * @param table DynamoDB Table the integration will interact with
 * @param format the data format of the values ({@link JsonFormat.AttributeValue} or {@link JsonFormat.Document})
 * @tparam {@link Item} - the type of data in the DynamoDB Table
 * @tparam {@link PartitionKey} - the name of the Partition Key field
 * @tparam {@link RangeKey} - the name of the Range Key field if specified, otherwise undefined
 * @tparam {@link Format} - the data format of the values ({@link JsonFormat.AttributeValue} or {@link JsonFormat.Document})
 */
export function createBatchGetItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): BatchGetItem<Item, PartitionKey, RangeKey, Format> {
  const tableName = table.tableName;

  return createDynamoIntegration<
    BatchGetItem<Item, PartitionKey, RangeKey, Format>,
    Format
  >(
    table,
    "batchGetItem",
    format,
    "read",
    async (client, [{ Keys }]) => {
      const input: any = {
        RequestItems: {
          [tableName]: {
            Keys,
          },
        },
      };
      const response: PromiseResult<
        | AWS.DynamoDB.DocumentClient.BatchGetItemOutput
        | AWS.DynamoDB.BatchGetItemOutput,
        any
      > = await (format === JsonFormat.Document
        ? (client as AWS.DynamoDB.DocumentClient).batchGet(input)
        : (client as AWS.DynamoDB).batchGetItem(input)
      ).promise();

      return {
        ...response,
        Items: response.Responses?.[tableName] as any,
      };
    },
    {
      prepareParams: (input) => {
        return <AWS.DynamoDB.BatchGetItemInput>{
          RequestItems: {
            [table.tableName]: input,
          },
        };
      },
      resultSelector: {
        // [*][0] is a hack for performing a safe nullish coalesce on arrays
        // when there are no Responses[tableName], then an empty array is returned
        // when it does exist, then the single Responses[tableName] array is returned
        // this only works because we know that there is only one table being interacted with at a time
        "Items.$": "$.Responses[*][0]",
        "UnprocessedKeys.$": "$.UnprocessedKeys[*][0]",
      },
    }
  );
}

/**
 * Creates an Integration for the BatchGetItem DynamoDB API within an AWS Appsync Resolver.
 *
 * @param table DynamoDB Table the integration will interact with.
 * @tparam {@link Item} - the type of data in the DynamoDB Table
 * @tparam {@link PartitionKey} - the name of the Partition Key field
 * @tparam {@link RangeKey} - the name of the Range Key field if specified, otherwise undefined
 */
export function createBatchGetItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): BatchGetItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    BatchGetItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.batchGetItem.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "BatchGetItem", "version": "2018-05-29", "tables": {}}'
        );
        const tableRequest = vtl.var("{}");
        vtl.qr(`${tableRequest}.put("keys", ${input}.keys)`);
        addIfDefined(vtl, input, tableRequest, "consistentRead");

        vtl.qr(`${request}.tables.put('${table.tableName}', ${tableRequest})`);
        addIfDefined(vtl, input, tableRequest, "consistentRead");

        return vtl.json(request);
      },
      result: (result) => ({
        returnVariable: "$batch_get_items_response",
        template: `#set($batch_get_items_response = {})
#set($batch_get_items_response.items = ${result}.data.get("${table.tableName}"))
#set($batch_get_items_response.unprocessedKeys = ${result}.unprocessedKeys)`,
      }),
    },
  });
}
