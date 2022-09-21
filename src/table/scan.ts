import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
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

export interface ScanOutput<Item extends object, Format extends JsonFormat>
  extends Omit<AWS.DynamoDB.ScanOutput, "Items"> {
  Items?: FormatObject<Item, Format>[];
}
export interface Scan<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> {
  <I extends Item = Item>(
    input: Omit<AWS.DynamoDB.DocumentClient.ScanInput, "TableName">
  ): Promise<ScanOutput<I, JsonFormat.Document>>;

  attributes<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >
  >(
    key: Key,
    input: Omit<AWS.DynamoDB.ScanInput, "Key">
  ): Promise<ScanOutput<Item, JsonFormat.AttributeValue>>;

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

export function createScanIntegration<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
>(
  table: ITable<Item, PartitionKey, RangeKey>
): Scan<Item, PartitionKey, RangeKey> {
  const query: Scan<Item, PartitionKey, RangeKey> =
    createDynamoDocumentIntegration<Scan<Item, PartitionKey, RangeKey>>(
      table,
      "Table.scan",
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

  query.attributes = createDynamoAttributesIntegration<
    Scan<Item, PartitionKey, RangeKey>["attributes"]
  >(table, "Table.scan.attributes", "read", (client, [request]) => {
    return client
      .scan({
        ...(request ?? {}),
        TableName: table.tableName,
      })
      .promise() as any;
  });

  query.appsync = makeAppSyncTableIntegration<
    Scan<Item, PartitionKey, RangeKey>["appsync"]
  >(table, "Table.scan.appsync", {
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
  });

  return query;
}
