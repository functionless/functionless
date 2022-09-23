import { aws_dynamodb } from "aws-cdk-lib";
import { PromiseResult } from "aws-sdk/lib/request";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export interface BatchGetItemInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> {
  Keys: Keys[];
}

export interface BatchGetItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> extends Omit<
    AWS.DynamoDB.BatchGetItemOutput,
    "Responses" | "ConsumedCapacity"
  > {
  Items?: FormatObject<Narrow<Item, Keys, Format>, Format>[];
}

export type BatchGetItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(
  request: BatchGetItemInput<Item, PartitionKey, RangeKey, Keys, Format>
) => Promise<BatchGetItemOutput<Item, PartitionKey, RangeKey, Keys, Format>>;

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
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type BatchGetItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(input: {
  key: Key;
  consistentRead?: boolean;
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;

export function createBatchGetItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): BatchGetItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    BatchGetItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.getItem.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "BatchGetItem", "version": "2018-05-29", "tables": {}}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        addIfDefined(vtl, input, request, "consistentRead");
        return vtl.json(request);
      },
    },
  });
}
