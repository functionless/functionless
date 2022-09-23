import { aws_dynamodb } from "aws-cdk-lib";
import { AttributeValue } from "typesafe-dynamodb/lib/attribute-value";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { DynamoDBAppsyncExpression } from "./appsync";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

export type QueryInput<Format extends JsonFormat> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.QueryInput
    : AWS.DynamoDB.DocumentClient.QueryInput,
  "TableName" | "ExpressionAttributeValues"
> & {
  ExpressionAttributeValues?: Format extends JsonFormat.AttributeValue
    ? {
        [attrName: string]: AttributeValue;
      }
    : AWS.DynamoDB.DocumentClient.QueryInput["ExpressionAttributeValues"];
};

export interface QueryOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.QueryOutput, "Items"> {
  Items?: FormatObject<Item, Format>[];
}

export type Query<Item extends object, Format extends JsonFormat> = <
  I extends Item = Item
>(
  input: QueryInput<Format>
) => Promise<QueryOutput<I, Format>>;

export function createQueryIntegration<
  Item extends object,
  Format extends JsonFormat
>(table: aws_dynamodb.ITable, format: Format): Query<Item, Format> {
  return createDynamoIntegration<Query<Item, Format>, Format>(
    table,
    "query",
    format,
    "read",
    (client, [request]) => {
      return client
        .query({
          ...((request as any) ?? {}),
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
