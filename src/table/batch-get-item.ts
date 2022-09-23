import { aws_dynamodb } from "aws-cdk-lib";
import { PromiseResult } from "aws-sdk/lib/request";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { ASLGraph } from "../asl";
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
> extends Omit<AWS.DynamoDB.BatchGetItemInput, "RequestItems">,
    KeysAndAttributes<Item, PartitionKey, RangeKey, Keys, Format> {}

export interface KeysAndAttributes<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.KeysAndAttributes, "Keys"> {
  Keys: Keys[];
}

export interface BatchGetItemOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.BatchGetItemOutput, "Item" | "Responses"> {
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
    async (client, [{ Keys, ReturnConsumedCapacity }]) => {
      const input: any = {
        ReturnConsumedCapacity,
        RequestItems: {
          [tableName]: {
            Keys: Keys,
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
    (input, context) => {
      const heapVar = context.newHeapVariable();

      return <ASLGraph.OutputSubState>{
        output: {
          jsonPath: heapVar,
        },
        startState: "batchGetItem",
        states: {
          batchGetItem: {
            Type: "Task",
            Resource: `arn:aws:states:::aws-sdk:dynamodb:batchGetItem`,
            Parameters: {
              RequestItems: {
                [table.tableName]: input.value,
              },
              ReturnConsumedCapacity: input.value.ReturnConsumedCapacity,
            },
            Next: "ifUnprocessedKeys",
            ResultPath: heapVar,
          },
          ifUnprocessedKeys: {
            Type: "Choice",
            Choices: [
              {
                IsPresent: true,
                Variable: `${heapVar}.UnprocessedKeys['${tableName}']`,
                Next: "extractUnprocessedKeys",
              },
            ],
            Default: "setUnprocessedKeysNull",
          },
          extractUnprocessedKeys: {
            Type: "Pass",
            InputPath: `${heapVar}.UnprocessedKeys['${tableName}']`,
            ResultPath: `${heapVar}.UnprocessedKeys`,
            Next: "ifItems",
          },
          setUnprocessedKeysNull: {
            Type: "Pass",
            InputPath: `$.fnl_context.null`,
            ResultPath: `${heapVar}.UnprocessedKeys`,
            Next: "ifItems",
          },
          ifItems: {
            Type: "Choice",
            Choices: [
              {
                IsPresent: true,
                Variable: `${heapVar}.Responses['${tableName}']`,
                Next: "setItems",
              },
            ],
            Default: ASLGraph.DeferNext,
          },
          setItems: {
            Type: "Pass",
            InputPath: `${heapVar}.Responses['${tableName}']`,
            ResultPath: `${heapVar}.Items`,
            Next: ASLGraph.DeferNext,
          },
        },
      };
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
          '{"operation": "GetItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        addIfDefined(vtl, input, request, "consistentRead");
        return vtl.json(request);
      },
    },
  });
}
