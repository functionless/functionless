import { aws_dynamodb } from "aws-cdk-lib";
import { Construct } from "constructs";
import { AppsyncResolver } from "../appsync";
import { TableAppsyncInterface } from "./appsync";
import { TableAttributesInterface } from "./attributes";
import {
  BatchGetItemDocument,
  createBatchGetItemDocumentIntegration,
} from "./batch-get-item";
import {
  createDeleteItemDocumentIntegration,
  DeleteItemDocument,
} from "./delete-item";
import { createGetItemDocumentIntegration, GetItemDocument } from "./get-item";
import { createPutItemDocumentIntegration, PutItemDocument } from "./put-item";
import { createQueryDocumentIntegration, QueryDocument } from "./query";
import { createScanDocumentIntegration, ScanDocument } from "./scan";
import {
  createUpdateItemDocumentIntegration,
  UpdateItemDocument,
} from "./update-item";

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

  readonly appsync: TableAppsyncInterface<Item, PartitionKey, RangeKey>;

  readonly attributes: TableAttributesInterface<Item, PartitionKey, RangeKey>;

  get: GetItemDocument<Item, PartitionKey, RangeKey>;

  batchGet: BatchGetItemDocument<Item, PartitionKey, RangeKey>;

  update: UpdateItemDocument<Item, PartitionKey, RangeKey>;

  put: PutItemDocument<Item>;

  delete: DeleteItemDocument<Item, PartitionKey, RangeKey>;

  query: QueryDocument<Item>;

  scan: ScanDocument<Item>;
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

  readonly appsync: TableAppsyncInterface<Item, PartitionKey, RangeKey>;

  readonly attributes: TableAttributesInterface<Item, PartitionKey, RangeKey>;

  readonly get: GetItemDocument<Item, PartitionKey, RangeKey>;

  readonly batchGet: BatchGetItemDocument<Item, PartitionKey, RangeKey>;

  readonly update: UpdateItemDocument<Item, PartitionKey, RangeKey>;

  readonly put: PutItemDocument<Item>;

  readonly delete: DeleteItemDocument<Item, PartitionKey, RangeKey>;

  readonly query: QueryDocument<Item>;

  readonly scan: ScanDocument<Item>;

  constructor(readonly resource: aws_dynamodb.ITable) {
    this.tableName = resource.tableName;
    this.tableArn = resource.tableArn;

    this.appsync = new TableAppsyncInterface(this);
    this.attributes = new TableAttributesInterface(this);

    this.get = createGetItemDocumentIntegration(this);
    this.batchGet = createBatchGetItemDocumentIntegration(this);
    this.delete = createDeleteItemDocumentIntegration(this);
    this.put = createPutItemDocumentIntegration(this);
    this.query = createQueryDocumentIntegration(this);
    this.scan = createScanDocumentIntegration(this);
    this.update = createUpdateItemDocumentIntegration(this);
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
