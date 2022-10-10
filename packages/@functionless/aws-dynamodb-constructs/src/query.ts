import { Query, QueryAppsync } from "@functionless/aws-dynamodb";
import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

export function createQueryIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): Query<Item, PartitionKey, RangeKey, Format> {
  return createDynamoIntegration<
    Query<Item, PartitionKey, RangeKey, Format>,
    Format
  >(table, "query", format, "read", (client, [request]) => {
    return client
      .query({
        ...((request as any) ?? {}),
        TableName: table.tableName,
      })
      .promise() as any;
  });
}

export function createQueryAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): QueryAppsync<Item> {
  return makeAppSyncTableIntegration<QueryAppsync<Item>>(
    table,
    "Table.query.appsync",
    {
      appSyncVtl: {
        request(call, vtl) {
          const input = vtl.eval(call.args[0]?.expr);
          const request = vtl.var(
            '{"operation": "Query", "version": "2018-05-29"}'
          );
          vtl.qr(`${request}.put('query', ${input}.get('query'))`);
          addIfDefined(vtl, input, request, "index");
          addIfDefined(vtl, input, request, "nextToken");
          addIfDefined(vtl, input, request, "limit");
          addIfDefined(vtl, input, request, "scanIndexForward");
          addIfDefined(vtl, input, request, "consistentRead");
          addIfDefined(vtl, input, request, "select");

          return vtl.json(request);
        },
      },
    }
  );
}
