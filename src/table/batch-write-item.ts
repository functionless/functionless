import { aws_dynamodb } from "aws-cdk-lib";
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

export interface BatchWriteItemInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
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
    "read",
    async (client, [{ RequestItems, ...props }]) => {
      const input: any = {
        ...props,
        RequestItems: {
          [tableName]: RequestItems,
        },
      };
      const response = await (format === JsonFormat.Document
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

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type BatchWriteItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(input: {
  key: Key;
  consistentRead?: boolean;
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;

export function createBatchWriteItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): BatchWriteItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    BatchWriteItemAppsync<Item, PartitionKey, RangeKey>
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
