import { aws_dynamodb } from "aws-cdk-lib";
import { AttributeValue } from "typesafe-dynamodb/lib/attribute-value";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { assertNodeKind } from "../assert";
import { NodeKind } from "../node-kind";
import { DynamoDBAppsyncExpression } from "./appsync";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import { ITable } from "./table";

export type ScanInput<Format extends JsonFormat> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.QueryInput
    : AWS.DynamoDB.DocumentClient.QueryInput,
  "TableName" | "ExpressionAttributeValues"
> & {
  ExpressionAttributeValues?: {
    [attrName: string]: AttributeValue;
  };
};

export interface ScanOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.ScanOutput, "Items"> {
  Items?: FormatObject<Item, Format>[];
}

export type Scan<Item extends object, Format extends JsonFormat> = (
  input?: ScanInput<Format>
) => Promise<ScanOutput<Item, Format>>;

export function createScanIntegration<
  Item extends object,
  Format extends JsonFormat
>(table: aws_dynamodb.ITable, format: Format): Scan<Item, Format> {
  return createDynamoIntegration<Scan<Item, Format>, Format>(
    table,
    "scan",
    format,
    "read",
    (client, [request]) => {
      return client
        .scan({
          ...((request as any) ?? {}),
          TableName: table.tableName,
        })
        .promise() as any;
    }
  );
}

export interface ScanAppsyncInput {
  query: DynamoDBAppsyncExpression;
  filter?: DynamoDBAppsyncExpression;
  index?: string;
  nextToken?: string;
  limit?: number;
  scanIndexForward?: boolean;
  consistentRead?: boolean;
  select?: "ALL_ATTRIBUTES" | "ALL_PROJECTED_ATTRIBUTES";
}

export interface ScanAppsyncOutput<Item> {
  items: Item[];
  nextToken: string;
  scannedCount: number;
}

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type ScanAppsync<Item> = (
  input: ScanAppsyncInput
) => Promise<ScanAppsyncOutput<Item>>;

export function createScanAppsyncIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): ScanAppsync<Item> {
  return makeAppSyncTableIntegration<ScanAppsync<Item>>(
    table,
    "Table.scan.appsync",
    {
      appSyncVtl: {
        request(call, vtl) {
          const input = vtl.eval(
            assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
          );
          const request = vtl.var(
            '{"operation": "Scan", "version": "2018-05-29"}'
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
