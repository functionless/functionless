import type { PutItem, PutItemAppsync } from "@functionless/aws-dynamodb";
import type { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import type { ITable } from "./table";

export function createPutItemIntegration<
  Item extends object,
  Format extends JsonFormat
>(table: aws_dynamodb.ITable, format: Format): PutItem<Item, Format> {
  return createDynamoIntegration<PutItem<Item, Format>, Format>(
    table,
    "putItem",
    format,
    "write",
    (client, [request]) => {
      const input: any = {
        ...request,
        TableName: table.tableName,
      };
      if (format === JsonFormat.AttributeValue) {
        return (client as AWS.DynamoDB).putItem(input).promise() as any;
      } else {
        return (client as AWS.DynamoDB.DocumentClient).put(input).promise();
      }
    }
  );
}
export function createPutItemAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): PutItemAppsync<Item, PartitionKey, RangeKey> {
  return makeAppSyncTableIntegration<
    PutItemAppsync<Item, PartitionKey, RangeKey>
  >(table, "Table.putItem.appsync", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(call.args[0]?.expr);
        const request = vtl.var(
          '{"operation": "PutItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        vtl.qr(
          `${request}.put('attributeValues', ${input}.get('attributeValues'))`
        );
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });
}
