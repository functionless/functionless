import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { JsonFormat } from "typesafe-dynamodb";
import { TableAppsyncApi } from "./appsync";
import { TableAttributesApi, TableDocumentApi } from "./runtime";
import { AppsyncResolver } from "@functionless/aws-appsync-constructs";

export function isTableConstruct(a: any): a is AnyTable {
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
> extends TableDocumentApi<Item, PartitionKey, RangeKey> {
  readonly kind: "Table";
  /**
   * This static property identifies this class as an EventBus to the TypeScript plugin.
   */
  readonly functionlessKind: typeof Table.FunctionlessType;

  /**
   * The underlying {@link aws_dynamodb.ITable} Resource.
   */
  readonly resource: aws_dynamodb.ITable;

  /**
   * Name of this table.
   */
  readonly tableName: string;

  /**
   * The ARN of this table.
   */
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

  readonly appsync: TableAppsyncApi<Item, PartitionKey, RangeKey>;

  readonly attributes: TableAttributesApi<Item, PartitionKey, RangeKey>;
}

class BaseTable<
    Item extends object,
    PartitionKey extends keyof Item,
    RangeKey extends keyof Item | undefined = undefined
  >
  extends TableDocumentApi<Item, PartitionKey, RangeKey>
  implements ITable<Item, PartitionKey, RangeKey>
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

  readonly appsync: TableAppsyncApi<Item, PartitionKey, RangeKey>;

  readonly attributes: TableAttributesApi<Item, PartitionKey, RangeKey>;

  constructor(readonly resource: aws_dynamodb.ITable) {
    super(resource, JsonFormat.Document);

    this.tableName = resource.tableName;
    this.tableArn = resource.tableArn;

    this.appsync = new TableAppsyncApi(this);
    this.attributes = new TableAttributesApi(
      resource,
      JsonFormat.AttributeValue
    );
  }
}

/**
 * A DynamoDB Table.
 *
 * To create a Table, first define the type of data that will be stored in the Table.
 *
 * ```ts
 * interface Person {
 *   pk: string;
 *   sk: string;
 *   name: string;
 *   age: number;
 * }
 * ```
 *
 * Then, create the Table and specify the `partitionKey` and (optional) `sortKey`.
 *
 * ```ts
 * const personTable = new Table<Person, "pk", "sk">(scope, id, {
 *   partitionKey: {
 *     name: "pk",
 *     type: aws_dynamodb.AttributeType.STRING
 *   },
 *   sortKey: {
 *     name: "sk",
 *     type: aws_dynamodb.AttributeType.STRING
 *   }}
 * });
 * ```
 *
 * Table provides three interfaces that can be interacted with at Runtime:
 * * Document API (available only in Lambda) provides a friendly JSON format where all values are plain JS objects.
 *
 * ```ts
 * new Function(scope, id, async (): Promise<Person> => {
 *   const response = await table.get({
 *     Key: {
 *       pk: "partition key"
 *     }
 *   });
 *
 *   response.Item; // Person | undefined - a vanilla JS object
 * });
 * ```
 * * Attribute Value API (available in Lambda, Step Functions and API Gateway)
 *
 * The {@link TableAttributesApi} is available on `table.attributes`.
 *
 * ```ts
 * new StepFunction(scope, id, async (): Promise<Person> => {
 *   const response = await table.attributes.get({
 *     Key: {
 *       pk: {
 *         // Step Functions only supports data formatted as Attribute Values
 *         S: "partition key"
 *       }
 *     }
 *   });
 *
 *   response.Item; // Person | undefined - a vanilla JS object
 * });
 * ```
 *
 * * Appsync API (available only in an Appsync Resolver) provides an interface to the
 *    optimized DynamoDB interface provided by the AWS Appsync service.
 *
 * The {@link TableAppsyncApi} is available on `table.appsync`.
 *
 * ```ts
 * new AppsyncResolver(
 *   scope,
 *   id,
 *   {
 *     typeName: "Query",
 *     fieldName: "get"
 *   },
 *   async () => {
 *     return table.appsync.get({
 *       key: {
 *         pk: {
 *           S: "partition key",
 *         },
 *       },
 *     });
 *  });
 * ```
 *
 * @see {@link TableAppsyncApi}
 * @see {@link TableAttributesApi}
 * @see {@link TableDocumentApi}
 * @see https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/DynamoDB/DocumentClient.html
 * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
 * @see https://aws.amazon.com/dynamodb/
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
