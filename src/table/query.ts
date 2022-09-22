import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import { DynamoDBAppsyncExpression } from "./appsync";
import {
  addIfDefined,
  createDynamoAttributesIntegration,
  createDynamoDocumentIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

export interface QueryOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.QueryOutput, "Items"> {
  Items?: FormatObject<Item, Format>[];
}

export type QueryDocument<Item extends object> = <I extends Item = Item>(
  input: Omit<AWS.DynamoDB.DocumentClient.QueryInput, "TableName">
) => Promise<QueryOutput<I, JsonFormat.Document>>;

export function createQueryDocumentIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): QueryDocument<Item> {
  return createDynamoDocumentIntegration<QueryDocument<Item>>(
    table,
    "query",
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
}

export type QueryAttributes<Item extends object> = <I extends Item = Item>(
  input: Omit<AWS.DynamoDB.QueryInput, "TableName">
) => Promise<QueryOutput<I, JsonFormat.AttributeValue>>;

export function createQueryAttributesIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): QueryAttributes<Item> {
  return createDynamoAttributesIntegration<QueryAttributes<Item>>(
    table,
    "query",
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
}

export interface QueryAppsyncInput {
  query: DynamoDBAppsyncExpression;
  filter?: DynamoDBAppsyncExpression;
  index?: string;
  nextToken?: string;
  limit?: number;
  scanIndexForward?: boolean;
  consistentRead?: boolean;
  select?: "ALL_ATTRIBUTES" | "ALL_PROJECTED_ATTRIBUTES";
}

export interface QueryAppsyncOutput<Item> {
  items: Item[];
  nextToken: string;
  scannedCount: number;
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type QueryAppsync<Item extends object> = <I extends Item = Item>(
  input: QueryAppsyncInput
) => Promise<QueryAppsyncOutput<I>>;

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
}
