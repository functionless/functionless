import { GetItem, GetItemAppsync } from "@functionless/aws-dynamodb";
import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

export function createGetItemIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): GetItem<Item, PartitionKey, RangeKey, Format> {
  return createDynamoIntegration<
    GetItem<Item, PartitionKey, RangeKey, Format>,
    Format
  >(table, "getItem", format, "read", (client, [request]) => {
    const input = {
      ...(request as any),
      TableName: table.tableName,
    };

    if (format === JsonFormat.AttributeValue) {
      return (client as AWS.DynamoDB).getItem(input).promise() as any;
    } else {
      return (client as AWS.DynamoDB.DocumentClient).get(input).promise();
    }
  });
}

export function createGetItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): GetItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    GetItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.getItem.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(call.args[0]?.expr);
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
