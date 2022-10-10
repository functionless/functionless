import { aws_dynamodb } from "aws-cdk-lib";
import { PromiseResult } from "aws-sdk/lib/request";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { ASLGraph } from "@functionless/asl-graph";
import {
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";
import {
  TransactWriteItems,
  TransactWriteItemAppsync,
} from "@functionless/aws-dynamodb";

export function createTransactWriteItemsIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): TransactWriteItems<Item, PartitionKey, RangeKey, Format> {
  const tableName = table.tableName;
  return createDynamoIntegration<
    TransactWriteItems<Item, PartitionKey, RangeKey, Format>,
    Format
  >(
    table,
    "transactWriteItems",
    format,
    "write",
    async (client, [{ TransactItems }]) => {
      const input: AWS.DynamoDB.TransactWriteItemsInput = {
        TransactItems: TransactItems.flatMap((item) =>
          Object.keys(item).map((key) => ({
            [key]: {
              ...item[key as keyof typeof item],
              TableName: tableName,
            },
          }))
        ),
      };
      const response: PromiseResult<
        | AWS.DynamoDB.DocumentClient.TransactWriteItemsOutput
        | AWS.DynamoDB.TransactWriteItemsOutput,
        any
      > = await (format === JsonFormat.Document
        ? (client as AWS.DynamoDB.DocumentClient).transactWrite(input)
        : (client as AWS.DynamoDB).transactWriteItems(input)
      ).promise();

      return response;
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
                  states: (() => {
                    return {
                      "set TableName": {
                        Type: "Choice",
                        Choices: [
                          branch("ConditionCheck"),
                          branch("Delete"),
                          branch("Put"),
                          branch("Update"),
                        ],
                        Default: "fail",
                      },
                      ...set("ConditionCheck"),
                      ...set("Delete"),
                      ...set("Put"),
                      ...set("Update"),
                      ["fail"]: {
                        Type: "Fail",
                        Error: "bad",
                      },
                    } as any;

                    function branch(
                      name: keyof AWS.DynamoDB.TransactWriteItem
                    ) {
                      return {
                        Variable: `$.item.${name}`,
                        IsPresent: true,
                        Next: `set TableName on ${name}`,
                      };
                    }

                    function set(name: keyof AWS.DynamoDB.TransactWriteItem) {
                      return {
                        [`set TableName on ${name}`]: {
                          Type: "Pass",
                          Result: tableName,
                          ResultPath: `$.item.${name}.TableName`,
                          OutputPath: "$.item",
                          End: true,
                        },
                      };
                    }
                  })(),
                }),
                Next: "transactWriteItems",
              },
              transactWriteItems: {
                Type: "Task",
                Resource: `arn:aws:states:::aws-sdk:dynamodb:transactWriteItems`,
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
export type TransactWriteItemsAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(
  transactItems: TransactWriteItemAppsync<Item, PartitionKey, RangeKey, Key>[]
) => Promise<{
  keys: AttributeKeyToObject<Key>[] | null;
  cancellationReasons: { type: string; message: string }[] | null;
}>;

export function createTransactWriteItemsAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): TransactWriteItemsAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    TransactWriteItemsAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.transactWriteItems.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const transactItems = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "TransactWriteItems", "version": "2018-05-29"}'
        );
        vtl.add(
          `#foreach($item in ${transactItems})`,
          `#set($item.table = "${table.tableName}")`,
          "#end"
        );
        vtl.qr(`${request}.put('transactItems', ${transactItems})`);
        return vtl.json(request);
      },
    },
  });
}
