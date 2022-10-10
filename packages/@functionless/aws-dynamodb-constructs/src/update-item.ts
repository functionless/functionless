import { UpdateItem, UpdateItemAppsync } from "@functionless/aws-dynamodb";
import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

export function createUpdateItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): UpdateItem<Item, PartitionKey, RangeKey, Format> {
  return createDynamoIntegration<
    UpdateItem<Item, PartitionKey, RangeKey, Format>,
    Format
  >(table, "updateItem", format, "write", (client, [request]) => {
    const input: any = {
      ...(request ?? {}),
      TableName: table.tableName,
    };
    if (format === JsonFormat.AttributeValue) {
      return (client as AWS.DynamoDB).updateItem(input).promise() as any;
    } else {
      return (client as AWS.DynamoDB.DocumentClient)
        .update(input)
        .promise() as any;
    }
  });
}

export function createUpdateItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): UpdateItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    UpdateItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.updateItem.appsync", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "UpdateItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        vtl.qr(`${request}.put('update', ${input}.get('update'))`);
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });
}
