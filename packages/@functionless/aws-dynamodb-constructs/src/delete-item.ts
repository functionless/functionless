import type DynamoDB from "aws-sdk/clients/dynamodb";
import { DeleteItem, DeleteItemAppsync } from "@functionless/aws-dynamodb";
import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

export function createDeleteItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): DeleteItem<Item, PartitionKey, RangeKey, Format> {
  return createDynamoIntegration<
    DeleteItem<Item, PartitionKey, RangeKey, Format>,
    Format
  >(table, "deleteItem", format, "write", (client, [request]) => {
    const input: any = {
      ...(request ?? {}),
      TableName: table.tableName,
    };
    if (format === JsonFormat.AttributeValue) {
      return (client as DynamoDB).deleteItem(input).promise() as any;
    } else {
      return (client as DynamoDB.DocumentClient).delete(input).promise();
    }
  });
}

export function createDeleteItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): DeleteItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    DeleteItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.deleteItem.appsync", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "DeleteItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");
        return vtl.json(request);
      },
    },
  });
}
