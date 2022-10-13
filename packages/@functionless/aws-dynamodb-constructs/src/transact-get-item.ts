import { aws_dynamodb } from "aws-cdk-lib";
import { PromiseResult } from "aws-sdk/lib/request";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { ASLGraph } from "@functionless/asl";
import {
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";
import {
  TransactGetItems,
  TransactGetItemsAppsync,
} from "@functionless/aws-dynamodb";

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
        const input = vtl.eval(call.args[0]?.expr);
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
