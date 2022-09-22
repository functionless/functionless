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

export interface ScanInput
  extends Omit<AWS.DynamoDB.DocumentClient.ScanInput, "TableName"> {}

export interface ScanOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.ScanOutput, "Items"> {
  Items?: FormatObject<Item, Format>[];
}

export type ScanDocument<Item extends object> = (
  input: ScanInput
) => Promise<ScanOutput<Item, JsonFormat.Document>>;

export function createScanDocumentIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): ScanDocument<Item> {
  return createDynamoDocumentIntegration<ScanDocument<Item>>(
    table,
    "scan",
    "read",
    (client, [request]) => {
      return client
        .scan({
          ...(request ?? {}),
          TableName: table.tableName,
        })
        .promise() as any;
    }
  );
}

export type ScanAttributes<Item extends object> = (
  input: ScanInput
) => Promise<ScanOutput<Item, JsonFormat.AttributeValue>>;

export function createScanAttributesIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(table: ITable<Item, PartitionKey, RangeKey>): ScanAttributes<Item> {
  return createDynamoAttributesIntegration<ScanAttributes<Item>>(
    table,
    "scan",
    "read",
    (client, [request]) => {
      return client
        .scan({
          ...(request ?? {}),
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
