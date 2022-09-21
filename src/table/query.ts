import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import {
  addIfDefined,
  DynamoDBAppsyncExpression,
  makeAppSyncTableIntegration,
} from "./appsync";
import {
  createDynamoAttributesIntegration,
  createDynamoDocumentIntegration,
} from "./integration";
import { ITable } from "./table";

export interface QueryOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.QueryOutput, "Items"> {
  Items?: FormatObject<Item, Format>[];
}
export interface Query<Item extends object> {
  <I extends Item = Item>(
    input: Omit<AWS.DynamoDB.DocumentClient.QueryInput, "TableName">
  ): Promise<QueryOutput<I, JsonFormat.Document>>;

  attributes<I extends Item = Item>(
    input: Omit<AWS.DynamoDB.QueryInput, "TableName">
  ): Promise<QueryOutput<I, JsonFormat.Document>>;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
   */
  appsync(input: {
    query: DynamoDBAppsyncExpression;
    filter?: DynamoDBAppsyncExpression;
    index?: string;
    nextToken?: string;
    limit?: number;
    scanIndexForward?: boolean;
    consistentRead?: boolean;
    select?: "ALL_ATTRIBUTES" | "ALL_PROJECTED_ATTRIBUTES";
  }): Promise<{
    items: Item[];
    nextToken: string;
    scannedCount: number;
  }>;
}

export function createQueryIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): Query<Item> {
  const query: Query<Item> = createDynamoDocumentIntegration<Query<Item>>(
    table,
    "Table.query",
    "read",
    (client, [request]) => {
      return client
        .query({
          ...(request ?? {}),
          TableName: table.tableName,
        })
        .promise() as any;
    }
  );

  query.attributes = createDynamoAttributesIntegration<
    Query<Item>["attributes"]
  >(table, "Table.query.attributes", "read", (client, [request]) => {
    return client
      .query({
        ...(request ?? {}),
        TableName: table.tableName,
      })
      .promise() as any;
  });

  query.appsync = makeAppSyncTableIntegration<Query<Item>["appsync"]>(
    table,
    "Table.query.appsync",
    {
      appSyncVtl: {
        request(call, vtl) {
          const input = vtl.eval(
            assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
          );
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

  return query;
}
