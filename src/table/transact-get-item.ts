import { aws_dynamodb } from "aws-cdk-lib";
import { PromiseResult } from "aws-sdk/lib/request";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { ASLGraph } from "../asl";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import {
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export interface TransactGetItemsInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> {
  TransactItems: TransactGetItem<Item, PartitionKey, RangeKey, Keys, Format>[];
}

export interface TransactGetItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> {
  /**
   * Contains the primary key that identifies the item to get, together with the name of the table that contains the item, and optionally the specific attributes of the item to retrieve.
   */
  Get: Get<Item, PartitionKey, RangeKey, Key, Format>;
}

export interface Get<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.Get, "TableName" | "Key"> {
  Key: Key;
}

export interface TransactGetItemsOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.TransactGetItemsOutput, "Item" | "Responses"> {
  Items: FormatObject<Narrow<Item, Keys, Format>, Format>[];
}

export type TransactGetItems<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(
  request: TransactGetItemsInput<Item, PartitionKey, RangeKey, Keys, Format>
) => Promise<
  TransactGetItemsOutput<Item, PartitionKey, RangeKey, Keys, Format>
>;

export function createTransactGetItemsIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): TransactGetItems<Item, PartitionKey, RangeKey, Format> {
  const tableName = table.tableName;
  return createDynamoIntegration<
    TransactGetItems<Item, PartitionKey, RangeKey, Format>,
    Format
  >(
    table,
    "transactGetItems",
    format,
    "read",
    async (client, [{ TransactItems }]) => {
      const input: any = {
        TransactItems: TransactItems.map((item) => ({
          Get: {
            ...item.Get,
            TableName: tableName,
          },
        })),
      };
      const response: PromiseResult<
        | AWS.DynamoDB.DocumentClient.TransactGetItemsOutput
        | AWS.DynamoDB.TransactGetItemsOutput,
        any
      > = await (format === JsonFormat.Document
        ? (client as AWS.DynamoDB.DocumentClient).transactGet(input)
        : (client as AWS.DynamoDB).transactGetItems(input)
      ).promise();

      return {
        Items: response.Responses?.map(({ Item }) => Item),
      } as any;
    },
    {
      override: (input, context) => {
        return context.evalExprToJsonPath(input, (output) => {
          const heapVar = context.newHeapVariable();

          return <ASLGraph.OutputSubState>{
            output: {
              jsonPath: heapVar,
            },
            startState: "set TableName",
            states: {
              "set TableName": {
                Type: "Map",
                ResultPath: `${output.jsonPath}.TransactItems`,
                Parameters: {
                  "item.$": "$$.Map.Item.Value",
                },
                ItemsPath: `${output.jsonPath}.TransactItems`,
                Iterator: context.aslGraphToStates({
                  startState: "set TableName",
                  states: {
                    "set TableName": {
                      Type: "Pass",
                      Result: tableName,
                      ResultPath: `$.item.Get.TableName`,
                      OutputPath: "$.item",
                      End: true,
                    },
                  },
                }),
                Next: "transactGetItems",
              },
              transactGetItems: {
                Type: "Task",
                Resource: `arn:aws:states:::aws-sdk:dynamodb:transactGetItems`,
                Parameters: {
                  "TransactItems.$": `${output.jsonPath}.TransactItems`,
                },
                ResultSelector: {
                  "Items.$": "$.Responses[*].Item",
                },
                ResultPath: heapVar,
                Next: ASLGraph.DeferNext,
              },
            },
          };
        });
      },
    }
  );
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type TransactGetItemsAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  items: {
    key: Key;
  }[]
) => Promise<{
  items: Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>[] | null;
  cancellationReasons: { type: string; message: string }[] | null;
}>;

export function createTransactGetItemsAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): TransactGetItemsAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    TransactGetItemsAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.transactGetItems.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "TransactGetItems", "version": "2018-05-29"}'
        );
        vtl.add(
          `#foreach($item in ${input})`,
          `#set($item.table = '${table.tableName}')`,
          "#end"
        );
        vtl.qr(`${request}.put('transactItems', ${input})`);
        return vtl.json(request);
      },
    },
  });
}
