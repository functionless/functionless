import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { JsonFormat } from "typesafe-dynamodb";
import {
  NativeBinaryAttribute,
  ToAttributeMap,
} from "typesafe-dynamodb/lib/attribute-value";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { AppSyncVtlIntegration } from "./appsync";
import { assertNodeKind } from "./assert";
import { IntegrationInput, makeIntegration } from "./integration";
import { NodeKind } from "./node-kind";
import {
  DynamoAppSyncIntegrationCall,
  DynamoExpression,
  ITable,
} from "./table";
import { AnyFunction } from "./util";
import { VTL } from "./vtl";

/**
 * Implementation of Appsync's DynamoDB Resolver interface for {@link ITable}.
 *
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html
 */
export interface ITableAppsyncApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> {
  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
   */
  getItem: DynamoAppSyncIntegrationCall<
    "getItem",
    <
      Key extends TableKey<
        Item,
        PartitionKey,
        RangeKey,
        JsonFormat.AttributeValue
      >
    >(input: {
      key: Key;
      consistentRead?: boolean;
    }) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-putitem
   */
  putItem: DynamoAppSyncIntegrationCall<
    "putItem",
    <
      Key extends TableKey<
        Item,
        PartitionKey,
        RangeKey,
        JsonFormat.AttributeValue
      >,
      ConditionExpression extends string | undefined = undefined
    >(input: {
      key: Key;
      attributeValues: ToAttributeMap<
        Omit<
          Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>,
          Exclude<PartitionKey | RangeKey, undefined>
        >
      >;
      condition?: DynamoExpression<ConditionExpression>;
      _version?: number;
    }) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-updateitem
   *
   * @returns the updated the item
   */
  updateItem: DynamoAppSyncIntegrationCall<
    "updateItem",
    <
      Key extends TableKey<
        Item,
        PartitionKey,
        RangeKey,
        JsonFormat.AttributeValue
      >,
      UpdateExpression extends string,
      ConditionExpression extends string | undefined
    >(input: {
      key: Key;
      update: DynamoExpression<UpdateExpression>;
      condition?: DynamoExpression<ConditionExpression>;
      _version?: number;
    }) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-deleteitem
   *
   * @returns the previous item.
   */
  deleteItem: DynamoAppSyncIntegrationCall<
    "deleteItem",
    <
      Key extends TableKey<
        Item,
        PartitionKey,
        RangeKey,
        JsonFormat.AttributeValue
      >,
      ConditionExpression extends string | undefined
    >(input: {
      key: Key;
      condition?: DynamoExpression<ConditionExpression>;
      _version?: number;
    }) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-query
   */
  query: DynamoAppSyncIntegrationCall<
    "query",
    <Query extends string, Filter extends string | undefined>(input: {
      query: DynamoExpression<Query>;
      filter?: DynamoExpression<Filter>;
      index?: string;
      nextToken?: string;
      limit?: number;
      scanIndexForward?: boolean;
      consistentRead?: boolean;
      select?: "ALL_ATTRIBUTES" | "ALL_PROJECTED_ATTRIBUTES";
    }) => Promise<{
      items: Item[];
      nextToken: string;
      scannedCount: number;
    }>
  >;
}

type AttributeKeyToObject<T> = {
  [k in keyof T]: T[k] extends { S: infer S }
    ? S
    : T[k] extends { N: `${infer N}` }
    ? N
    : T[k] extends { B: any }
    ? NativeBinaryAttribute
    : never;
};

function addIfDefined(vtl: VTL, from: string, to: string, key: string) {
  vtl.add(
    `#if(${from}.containsKey('${key}'))`,
    `$util.qr(${to}.put('${key}', ${from}.get('${key}')))`,
    "#end"
  );
}

export class TableAppsyncApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> implements ITableAppsyncApi<Item, PartitionKey, RangeKey>
{
  constructor(readonly table: ITable<Item, PartitionKey, RangeKey>) {}

  readonly getItem = this.makeAppSyncTableIntegration<
    ITableAppsyncApi<Item, PartitionKey, RangeKey>["getItem"]
  >("getItem", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "GetItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        addIfDefined(vtl, input, request, "consistentRead");
        return vtl.json(request);
      },
    },
  });

  putItem = this.makeAppSyncTableIntegration<
    ITableAppsyncApi<Item, PartitionKey, RangeKey>["putItem"]
  >("putItem", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
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

  readonly updateItem = this.makeAppSyncTableIntegration<
    ITableAppsyncApi<Item, PartitionKey, RangeKey>["updateItem"]
  >("updateItem", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "UpdateItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        vtl.qr(`${request}.put('update', ${input}.get('update'))`);
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });

  readonly deleteItem = this.makeAppSyncTableIntegration<
    ITableAppsyncApi<Item, PartitionKey, RangeKey>["deleteItem"]
  >("deleteItem", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind(call.args[0]?.expr, NodeKind.ObjectLiteralExpr)
        );
        const request = vtl.var(
          '{"operation": "DeleteItem", "version": "2018-05-29"}'
        );
        vtl.qr(`${request}.put('key', ${input}.get('key'))`);
        addIfDefined(vtl, input, request, "condition");
        addIfDefined(vtl, input, request, "_version");

        return vtl.json(request);
      },
    },
  });

  readonly query = this.makeAppSyncTableIntegration<
    ITableAppsyncApi<Item, PartitionKey, RangeKey>["query"]
  >("query", {
    appSyncVtl: {
      request: (call, vtl) => {
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
  });

  private makeAppSyncTableIntegration<F extends AnyFunction>(
    methodName: string,
    integration: Omit<IntegrationInput<string, F>, "kind" | "appSyncVtl"> & {
      appSyncVtl: Omit<AppSyncVtlIntegration, "dataSource" | "dataSourceId">;
    }
  ): F {
    return makeIntegration<`Table.AppSync.${string}`, F>({
      ...integration,
      kind: `Table.AppSync.${methodName}`,
      appSyncVtl: {
        dataSourceId: () => this.table.resource.node.addr,
        dataSource: (api, dataSourceId) => {
          return new appsync.DynamoDbDataSource(api, dataSourceId, {
            api,
            table: this.table.resource,
          });
        },
        ...integration.appSyncVtl,
      },
    });
  }
}
