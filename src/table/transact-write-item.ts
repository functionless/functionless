import { aws_dynamodb } from "aws-cdk-lib";
import { PromiseResult } from "aws-sdk/lib/request";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { ASLGraph } from "../asl";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import { DynamoDBAppsyncExpression } from "./appsync";
import {
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";
import { AttributeKeyToObject } from "./util";

export interface TransactWriteItemsInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Keys extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> extends Omit<AWS.DynamoDB.TransactWriteItemsInput, "TransactItems"> {
  TransactItems: TransactWriteItem<
    Item,
    PartitionKey,
    RangeKey,
    Keys,
    Format
  >[];
}

export interface TransactWriteItem<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat
> {
  ConditionCheck?: ConditionCheck<Item, PartitionKey, RangeKey, Key, Format>;
  Delete?: Delete<Item, PartitionKey, RangeKey, Key, Format>;
  Put?: Put<Item, Format>;
  Update?: Update<Item, PartitionKey, RangeKey, Key, Format>;
}

export type ConditionCheck<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.ConditionCheck
    : AWS.DynamoDB.DocumentClient.ConditionCheck,
  "TableName" | "Key"
> & {
  Key: Key;
};

export type Delete<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.Delete
    : AWS.DynamoDB.DocumentClient.Delete,
  "TableName" | "Key"
> & {
  Key: Key;
};

export type Put<
  Item extends object,
  Format extends JsonFormat = JsonFormat.Document
> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.Put
    : AWS.DynamoDB.DocumentClient.Put,
  "TableName" | "Item"
> & {
  Item: FormatObject<Item, Format>;
};

export type Update<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, Format>,
  Format extends JsonFormat = JsonFormat.Document
> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.Update
    : AWS.DynamoDB.DocumentClient.Update,
  "TableName" | "Key"
> & {
  Key: Key;
};

export interface TransactWriteItemsOutput
  extends AWS.DynamoDB.TransactWriteItemsOutput {}

export type TransactWriteItems<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(
  request: TransactWriteItemsInput<Item, PartitionKey, RangeKey, Keys, Format>
) => Promise<TransactWriteItemsOutput>;

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
  items: Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>[] | null;
  cancellationReasons: { type: string; message: string }[] | null;
}>;

export type TransactWriteItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
> =
  | TransactPutItemAppsync<Item, PartitionKey, RangeKey, Key>
  | TransactUpdateItemAppsync<Item, PartitionKey, RangeKey, Key>
  | TransactDeleteItemAppsync<Item, PartitionKey, RangeKey, Key>
  | TransactConditionCheckAppsync<Item, PartitionKey, RangeKey, Key>;

export interface TransactPutItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
> {
  operation: "PutItem";
  key: Key;
  attributeValues: FormatObject<
    Omit<Item, Exclude<PartitionKey | RangeKey, undefined>>,
    JsonFormat.AttributeValue
  >;
  condition?: DynamoDBAppsyncExpression;
}

export interface TransactUpdateItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
> {
  operation: "UpdateItem";
  key: Key;
  update: DynamoDBAppsyncExpression;
  condition?: DynamoDBAppsyncExpression;
}

export interface TransactDeleteItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
> {
  operation: "DeleteItem";
  key: Key;
  condition?: DynamoDBAppsyncExpression;
}

export interface TransactConditionCheckAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
> {
  operation: "ConditionCheck";
  key: Key;
  condition?: DynamoDBAppsyncExpression;
}

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
        const transactItems = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "TransactWriteItems", "version": "2018-05-29"}'
        );
        vtl.add(
          `#foreach($item in ${transactItems})`,
          `#set($item.table = '${table.tableName}')`,
          "#end"
        );
        vtl.qr(`${request}.put('transactItems', ${transactItems})`);
        return vtl.json(request);
      },
    },
  });
}
