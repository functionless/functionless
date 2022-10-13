import type { aws_dynamodb } from "aws-cdk-lib";
import type {
  FormatObject,
  JsonFormat,
} from "typesafe-dynamodb/lib/json-format";
import type { TableKey } from "typesafe-dynamodb/lib/key";
import type { DynamoDBAppsyncExpression } from "./appsync";
import {
  addIfDefined,
  createDynamoIntegration,
  makeAppSyncTableIntegration,
} from "./integration";
import type { ITable } from "./table";

export type ScanInput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = Omit<
  Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.QueryInput
    : AWS.DynamoDB.DocumentClient.QueryInput,
  "TableName" | "ExpressionAttributeValues" | "ExclusiveStartKey"
> & {
  ExclusiveStartKey?: TableKey<Item, PartitionKey, RangeKey, Format>;
  ExpressionAttributeValues?: Format extends JsonFormat.AttributeValue
    ? AWS.DynamoDB.QueryInput["ExpressionAttributeValues"]
    : AWS.DynamoDB.DocumentClient.QueryInput["ExpressionAttributeValues"];
};

export interface ScanOutput<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.ScanOutput, "Items" | "LastEvaluatedKey"> {
  Items?: FormatObject<Item, Format>[];
  LastEvaluatedKey?: TableKey<Item, PartitionKey, RangeKey, Format>;
}

export type Scan<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> = (
  input?: ScanInput<Item, PartitionKey, RangeKey, Format>
) => Promise<ScanOutput<Item, PartitionKey, RangeKey, Format>>;

export function createScanIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  format: Format
): Scan<Item, PartitionKey, RangeKey, Format> {
  return createDynamoIntegration<
    Scan<Item, PartitionKey, RangeKey, Format>,
    Format
  >(table, "scan", format, "read", (client, [request]) => {
    return client
      .scan({
        ...((request as any) ?? {}),
        TableName: table.tableName,
      })
      .promise() as any;
  });
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
          const input = vtl.eval(call.args[0]?.expr);
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
