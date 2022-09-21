import { aws_dynamodb } from "aws-cdk-lib";
import AWS from "aws-sdk";
import { PromiseResult } from "aws-sdk/lib/request";
import { Construct } from "constructs";
import { JsonFormat } from "typesafe-dynamodb";
import {
  ExpressionAttributeNames,
  ExpressionAttributeValues,
} from "typesafe-dynamodb/lib/expression-attributes";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { AppsyncResolver } from "../appsync";
import { makeIntegration } from "../integration";
import { createGetItemIntegration, GetItem } from "./get-item";
import { DocumentDBClient } from "./integration";
import { ReturnValues } from "./return-value";
import {
  BatchGetItemOutput,
  DeleteItemInput,
  DeleteItemOutput,
  PutItemOutput,
  QueryOutput,
  ScanOutput,
} from "./table-api";
import { UpdateItem } from "./update-item";

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
    ? undefined
    : { name: Exclude<RangeKey, undefined>; type: aws_dynamodb.AttributeType };
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
 * >(async ($context, personId: string) => {
 *   const person = await personTable.appsync.get({
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
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  readonly functionlessKind: typeof Table.FunctionlessType;

  /**
   * The underlying {@link aws_dynamodb.ITable} Resource.
   */
  readonly resource: aws_dynamodb.ITable;

  readonly tableName: string;
  readonly tableArn: string;

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

  getItem: GetItem<Item, PartitionKey, RangeKey>;

  updateItem: UpdateItem<Item, PartitionKey, RangeKey>;

  batchGetItems(
    keys: readonly TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.Document
    >[],
    props?: Omit<AWS.DynamoDB.KeysAndAttributes, "Keys">
  ): Promise<BatchGetItemOutput<Item>>;

  putItem<I extends Item>(
    item: I,
    props?: Omit<AWS.DynamoDB.PutItemInput, "TableName" | "Item">
  ): Promise<PutItemOutput<I>>;

  deleteItem<
    Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>,
    Return extends ReturnValues | undefined = undefined
  >(
    input: DeleteItemInput<Key, Return>
  ): Promise<DeleteItemOutput<Item, Return, Key>>;

  query<I extends Item = Item>(
    input: Omit<AWS.DynamoDB.DocumentClient.QueryInput, "TableName">
  ): Promise<QueryOutput<I>>;

  scan(
    input?: Omit<AWS.DynamoDB.DocumentClient.ScanInput, "TableName">
  ): Promise<ScanOutput<Item>>;
}

class BaseTable<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> implements ITable<Item, PartitionKey, RangeKey>
{
  public static readonly FunctionlessType = "Table";
  readonly functionlessKind = "Table";
  readonly kind = "Table";
  readonly tableName: string;
  readonly tableArn: string;

  readonly _brand?: {
    Item: Item;
    PartitionKey: PartitionKey;
    RangeKey: RangeKey;
  };

  public readonly getItem: GetItem<Item, PartitionKey, RangeKey>;

  public readonly batchGetItems: ITable<
    Item,
    PartitionKey,
    RangeKey
  >["batchGetItems"];

  public readonly updateItem: ITable<
    Item,
    PartitionKey,
    RangeKey
  >["updateItem"];

  public readonly deleteItem: ITable<
    Item,
    PartitionKey,
    RangeKey
  >["deleteItem"];

  public readonly putItem: ITable<Item, PartitionKey, RangeKey>["putItem"];

  public readonly query: ITable<Item, PartitionKey, RangeKey>["query"];

  public readonly scan: ITable<Item, PartitionKey, RangeKey>["scan"];

  constructor(readonly resource: aws_dynamodb.ITable) {
    this.tableName = resource.tableName;
    this.tableArn = resource.tableArn;

    const tableName = resource.tableName;

    this.getItem = createGetItemIntegration(this);

    this.batchGetItems = makeIntegration<
      "Table.batchGetItems",
      ITable<Item, PartitionKey, RangeKey>["batchGetItems"]
    >({
      kind: "Table.batchGetItems",
      native: {
        bind: (context) => {
          this.resource.grantWriteData(context.resource);
        },
        preWarm: (context) => {
          context.getOrInit(DocumentDBClient);
        },
        call: async ([keys, props], context) => {
          const ddb =
            context.getOrInit<AWS.DynamoDB.DocumentClient>(DocumentDBClient);

          const response: PromiseResult<
            AWS.DynamoDB.DocumentClient.BatchGetItemOutput,
            any
          > = await ddb
            .batchGet({
              ...(props ?? {}),
              RequestItems: {
                [tableName]: {
                  Keys: keys,
                  ...props,
                },
              } as any,
            })
            .promise();

          return {
            ...response,
            Items: response.Responses?.[tableName] as Item[],
          };
        },
      },
    });

    this.putItem = makeIntegration<
      "Table.putItem",
      ITable<Item, PartitionKey, RangeKey>["putItem"]
    >({
      kind: "Table.putItem",
      native: {
        bind: (context) => {
          this.resource.grantWriteData(context.resource);
        },
        preWarm: (context) => {
          context.getOrInit(DocumentDBClient);
        },
        call: async ([item, props], context) => {
          const ddb: AWS.DynamoDB.DocumentClient =
            context.getOrInit<AWS.DynamoDB.DocumentClient>(DocumentDBClient);

          const response = await ddb
            .put({
              ...(props ?? {}),
              Item: item,
              TableName: tableName,
            })
            .promise();

          return response as any;
        },
      },
    });

    this.updateItem = makeIntegration<
      "Table.updateItem",
      ITable<Item, PartitionKey, RangeKey>["updateItem"]
    >({
      kind: "Table.updateItem",
      native: {
        bind: (context) => {
          this.resource.grantWriteData(context.resource);
        },
        preWarm: (context) => {
          context.getOrInit(DocumentDBClient);
        },
        call: async ([request], context) => {
          const ddb: AWS.DynamoDB.DocumentClient =
            context.getOrInit<AWS.DynamoDB.DocumentClient>(DocumentDBClient);

          const response = await ddb
            .update({
              ...request,
              TableName: tableName,
            })
            .promise();

          return response as any;
        },
      },
    });

    this.deleteItem = makeIntegration<
      "Table.deleteItem",
      ITable<Item, PartitionKey, RangeKey>["deleteItem"]
    >({
      kind: "Table.deleteItem",
      native: {
        bind: (context) => {
          this.resource.grantWriteData(context.resource);
        },
        preWarm: (context) => {
          context.getOrInit(DocumentDBClient);
        },
        call: async ([request], context) => {
          const ddb: AWS.DynamoDB.DocumentClient =
            context.getOrInit<AWS.DynamoDB.DocumentClient>(DocumentDBClient);

          const response = await ddb
            .delete({
              ...request,
              TableName: tableName,
            })
            .promise();

          return response as any;
        },
      },
    });

    this.query = makeIntegration<
      "Table.query",
      ITable<Item, PartitionKey, RangeKey>["query"]
    >({
      kind: "Table.query",
      native: {
        bind: (context) => {
          this.resource.grantReadData(context.resource);
        },
        preWarm: (context) => {
          context.getOrInit(DocumentDBClient);
        },
        call: async ([request], context) => {
          const ddb =
            context.getOrInit<AWS.DynamoDB.DocumentClient>(DocumentDBClient);

          const response = await ddb
            .query({
              ...(request ?? {}),
              TableName: tableName,
            })
            .promise();

          return response as any;
        },
      },
    });

    this.scan = makeIntegration<
      "Table.scan",
      ITable<Item, PartitionKey, RangeKey>["scan"]
    >({
      kind: "Table.scan",
      native: {
        bind: (context) => {
          this.resource.grantReadData(context.resource);
        },
        preWarm: (context) => {
          context.getOrInit(DocumentDBClient);
        },
        call: async ([request], context) => {
          const ddb =
            context.getOrInit<AWS.DynamoDB.DocumentClient>(DocumentDBClient);

          const response = await ddb
            .scan({
              ...(request ?? {}),
              TableName: tableName,
            })
            .promise();

          return response as any;
        },
      },
    });
  }
}

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
 * >(async ($context, personId: string) => {
 *   const person = await personTable.appsync.get({
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
  Item extends object = any,
  PartitionKey extends keyof Item = any,
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
    super(
      new aws_dynamodb.Table(scope, id, {
        ...props,
        billingMode:
          props.billingMode ?? aws_dynamodb.BillingMode.PAY_PER_REQUEST,
      } as aws_dynamodb.TableProps)
    );
  }
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
