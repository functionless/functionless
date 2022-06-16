import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { JsonFormat } from "typesafe-dynamodb";
import {
  NativeBinaryAttribute,
  ToAttributeMap,
} from "typesafe-dynamodb/lib/attribute-value";
import {
  ExpressionAttributeNames,
  ExpressionAttributeValues,
} from "typesafe-dynamodb/lib/expression-attributes";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import type { AppSyncVtlIntegration } from "./appsync";
import { assertNodeKind } from "./assert";
import { ObjectLiteralExpr } from "./expression";
import {
  IntegrationCall,
  IntegrationInput,
  makeIntegration,
} from "./integration";
import { AnyFunction } from "./util";
import { VTL } from "./vtl";

export function isTable(a: any): a is AnyTable {
  return a?.kind === "Table";
}

export interface TableProps<
  PartitionKey extends string,
  RangeKey extends string | undefined = undefined
> extends Omit<
    aws_dynamodb.TableProps,
    "partitionKey" | "sortKey" | "tableName"
  > {
  /**
   * Enforces a particular physical table name.
   * @default generated
   *
   * [Internal Note] this property is copied because CDK tsdocs have a xml like tag
   *                 around `generated` which breaks typedocs.
   */
  readonly tableName?: string;
  /**
   * Partition key attribute definition.
   */
  readonly partitionKey: {
    name: PartitionKey;
    type: aws_dynamodb.AttributeType;
  };
  /**
   * Sort key attribute definition.
   *
   * @default no sort key
   */
  readonly sortKey?: RangeKey extends undefined
    ? { name: Exclude<RangeKey, undefined>; type: aws_dynamodb.AttributeType }
    : undefined;
}

export type AnyTable = ITable<Record<string, any>, string, string | undefined>;

/**
 * Wraps an {@link aws_dynamodb.Table} with a type-safe interface that can be
 * called from within other {@link AppsyncResolver}.
 *
 * Its interface, e.g. `getItem`, `putItem`, is in 1:1 correspondence with the
 * AWS Appsync Resolver API https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html
 *
 * For example:
 * ```ts
 * interface Person {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 *
 * const personTable = new Table<Person, "id">(stack, id, { ... });
 *
 * const getPerson = new AppsyncResolver<
 *   (personId: string) => Person | undefined
 * >(($context, personId: string) => {
 *   const person = personTable.get({
 *     key: {
 *       id: $util.toDynamoDB(personId)
 *     }
 *   });
 *
 *   return person;
 * });
 * ```
 *
 * Note the type-signature of `Table<Person, "id">`. This declares a table whose contents
 * are of the shape, `Person`, and that the PartitionKey is the `id` field.
 *
 * You can also specify the RangeKey:
 * ```ts
 * Table.fromTable<Person, "id", "age">(..)
 * ```
 * @see https://github.com/sam-goodwin/typesafe-dynamodb - for more information on how to model your DynamoDB table with TypeScript
 */
export interface ITable<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> {
  readonly kind: "Table";
  /**
   * The underlying {@link aws_dynamodb.ITable} Resource.
   */
  readonly resource: aws_dynamodb.ITable;

  /**
   * Brands this type with easy-access to the type parameters, Item, PartitionKey and RangeKey
   *
   * @note this value will never exist at runtime - it is purely compile-time information
   */
  readonly _brand?: {
    Item: Item;
    PartitionKey: PartitionKey;
    RangeKey: RangeKey;
  };

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
   */
  getItem: DynamoIntegrationCall<
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
    }) => Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-putitem
   */
  putItem: DynamoIntegrationCall<
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
    }) => Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-updateitem
   *
   * @returns the updated the item
   */
  updateItem: DynamoIntegrationCall<
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
    }) => Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-deleteitem
   *
   * @returns the previous item.
   */
  deleteItem: DynamoIntegrationCall<
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
    }) => Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>
  >;

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-query
   */
  query: DynamoIntegrationCall<
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
    }) => {
      items: Item[];
      nextToken: string;
      scannedCount: number;
    }
  >;
}

class BaseTable<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> implements ITable<Item, PartitionKey, RangeKey>
{
  readonly kind = "Table";

  readonly _brand?: {
    Item: Item;
    PartitionKey: PartitionKey;
    RangeKey: RangeKey;
  };

  constructor(readonly resource: aws_dynamodb.ITable) {}

  public getItem = this.makeTableIntegration("getItem", {
    appSyncVtl: {
      request(call, vtl) {
        const input = vtl.eval(
          assertNodeKind<ObjectLiteralExpr>(
            call.getArgument("input")?.expr,
            "ObjectLiteralExpr"
          )
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

  public putItem = this.makeTableIntegration("putItem", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind<ObjectLiteralExpr>(
            call.getArgument("input")?.expr,
            "ObjectLiteralExpr"
          )
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

  public updateItem = this.makeTableIntegration("updateItem", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind<ObjectLiteralExpr>(
            call.getArgument("input")?.expr,
            "ObjectLiteralExpr"
          )
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

  public deleteItem = this.makeTableIntegration("deleteItem", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind<ObjectLiteralExpr>(
            call.getArgument("input")?.expr,
            "ObjectLiteralExpr"
          )
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

  public query = this.makeTableIntegration("query", {
    appSyncVtl: {
      request: (call, vtl) => {
        const input = vtl.eval(
          assertNodeKind<ObjectLiteralExpr>(
            call.getArgument("input")?.expr,
            "ObjectLiteralExpr"
          )
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

  private makeTableIntegration<
    K extends Exclude<
      keyof ITable<Item, PartitionKey, RangeKey>,
      "kind" | "resource" | "_brand"
    >
  >(
    methodName: K,
    integration: Omit<
      IntegrationInput<K, ITable<Item, PartitionKey, RangeKey>[K]>,
      "kind" | "appSyncVtl"
    > & {
      appSyncVtl: Omit<AppSyncVtlIntegration, "dataSource" | "dataSourceId">;
    }
  ): DynamoIntegrationCall<K, ITable<Item, PartitionKey, RangeKey>[K]> {
    return makeIntegration<
      `Table.${K}`,
      ITable<Item, PartitionKey, RangeKey>[K]
    >({
      ...integration,
      kind: `Table.${methodName}`,
      appSyncVtl: {
        dataSourceId: () => this.resource.node.addr,
        dataSource: (api, dataSourceId) => {
          return new appsync.DynamoDbDataSource(api, dataSourceId, {
            api,
            table: this.resource,
          });
        },
        ...integration.appSyncVtl,
      },
      unhandledContext(kind, contextKind) {
        throw new Error(
          `${kind} is only allowed within a '${VTL.ContextName}' context, but was called within a '${contextKind}' context.`
        );
      },
    });
  }
}

export type DynamoIntegrationCall<
  Kind extends string,
  F extends AnyFunction
> = IntegrationCall<`Table.${Kind}`, F>;

/**
 * Wraps an {@link aws_dynamodb.Table} with a type-safe interface that can be
 * called from within an {@link AppsyncResolver}.
 *
 * Its interface, e.g. `getItem`, `putItem`, is in 1:1 correspondence with the
 * AWS Appsync Resolver API https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html
 *
 * For example:
 * ```ts
 * interface Person {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 *
 * const personTable = Table.fromTable<Person, "id">(
 *   new aws_dynamodb.Table(..)
 * );
 *
 * const getPerson = new AppsyncResolver<
 *   (personId: string) => Person | undefined
 * >(($context, personId: string) => {
 *   const person = personTable.get({
 *     key: {
 *       id: $util.toDynamoDB(personId)
 *     }
 *   });
 *
 *   return person;
 * });
 * ```
 *
 * Note the type-signature of `Table<Person, "id">`. This declares a table whose contents
 * are of the shape, `Person`, and that the PartitionKey is the `id` field.
 *
 * You can also specify the RangeKey:
 * ```ts
 * Table.fromTable<Person, "id", "age">(..)
 * ```
 * @see https://github.com/sam-goodwin/typesafe-dynamodb - for more information on how to model your DynamoDB table with TypeScript
 */
export class Table<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> extends BaseTable<Item, PartitionKey, RangeKey> {
  /**
   * Wrap a {@link aws_dynamodb.Table} with Functionless.
   *
   * A wrapped {@link Table} provides common integrations like `getItem` and `query`.
   */
  public static fromTable<
    Item extends object,
    PartitionKey extends keyof Item,
    RangeKey extends keyof Item | undefined = undefined
  >(resource: aws_dynamodb.ITable): ITable<Item, PartitionKey, RangeKey> {
    return new BaseTable<Item, PartitionKey, RangeKey>(resource);
  }

  constructor(
    scope: Construct,
    id: string,
    props: TableProps<
      Exclude<PartitionKey, number | Symbol>,
      Exclude<RangeKey, number | Symbol>
    >
  ) {
    super(new aws_dynamodb.Table(scope, id, props as aws_dynamodb.TableProps));
  }
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

export type DynamoExpression<Expression extends string | undefined> =
  {} & RenameKeys<
    ExpressionAttributeNames<Expression> &
      ExpressionAttributeValues<Expression, JsonFormat.AttributeValue> & {
        expression?: Expression;
      },
    {
      ExpressionAttributeValues: "expressionValues";
      ExpressionAttributeNames: "expressionNames";
    }
  >;

type RenameKeys<
  T extends object,
  Substitutions extends Record<string, string>
> = {
  [k in keyof T as k extends keyof Substitutions ? Substitutions[k] : k]: T[k];
};
