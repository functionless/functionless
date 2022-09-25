import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb";
import { BatchGetItem, createBatchGetItemIntegration } from "./batch-get-item";
import {
  BatchWriteItem,
  createBatchWriteItemIntegration,
} from "./batch-write-item";
import { createDeleteItemIntegration, DeleteItem } from "./delete-item";
import { createGetItemIntegration, GetItem } from "./get-item";
import { createPutItemIntegration, PutItem } from "./put-item";
import { createQueryIntegration, Query } from "./query";
import { createScanIntegration, Scan } from "./scan";
import type { Table } from "./table";
import {
  createTransactGetItemsIntegration,
  TransactGetItems,
} from "./transact-get-item";
import {
  createTransactWriteItemsIntegration,
  TransactWriteItems,
} from "./transact-write-item";
import { createUpdateItemIntegration, UpdateItem } from "./update-item";

declare const a: AWS.DynamoDB;

/**
 * The Runtime API for a DynamoDB {@link Table}.
 *
 * @tparam {@link Item} - the type of data in the DynamoDB Table
 * @tparam {@link PartitionKey} - the name of the Partition Key field
 * @tparam {@link RangeKey} - the name of the Range Key field if specified, otherwise undefined
 * @tparam {@link Format} - the data format of the values ({@link JsonFormat.AttributeValue} or {@link JsonFormat.Document})
 */
class TableRuntimeApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined,
  Format extends JsonFormat
> {
  readonly get: GetItem<Item, PartitionKey, RangeKey, Format>;

  readonly batchGet: BatchGetItem<Item, PartitionKey, RangeKey, Format>;

  readonly transactGet: TransactGetItems<Item, PartitionKey, RangeKey, Format>;

  readonly transactWrite: TransactWriteItems<
    Item,
    PartitionKey,
    RangeKey,
    Format
  >;

  readonly put: PutItem<Item, Format>;

  readonly update: UpdateItem<Item, PartitionKey, RangeKey, Format>;

  readonly batchWrite: BatchWriteItem<Item, PartitionKey, RangeKey, Format>;

  readonly delete: DeleteItem<Item, PartitionKey, RangeKey, Format>;

  readonly query: Query<Item, Format>;

  readonly scan: Scan<Item, Format>;

  constructor(resource: aws_dynamodb.ITable, format: Format) {
    this.get = createGetItemIntegration(resource, format);
    this.batchGet = createBatchGetItemIntegration(resource, format);
    this.transactGet = createTransactGetItemsIntegration(resource, format);
    this.put = createPutItemIntegration(resource, format);
    this.update = createUpdateItemIntegration(resource, format);
    this.batchWrite = createBatchWriteItemIntegration(resource, format);
    this.transactWrite = createTransactWriteItemsIntegration(resource, format);
    this.delete = createDeleteItemIntegration(resource, format);
    this.query = createQueryIntegration(resource, format);
    this.scan = createScanIntegration(resource, format);
  }
}

export class TableDocumentApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> extends TableRuntimeApi<Item, PartitionKey, RangeKey, JsonFormat.Document> {}

/**
 * The Runtime API for a DynamoDB {@link Table} using the Document JSON format.
 *
 * @tparam {@link Item} - the type of data in the DynamoDB Table
 * @tparam {@link PartitionKey} - the name of the Partition Key field
 * @tparam {@link RangeKey} - the name of the Range Key field if specified, otherwise undefined
 */
export interface TableDocumentApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> extends TableRuntimeApi<Item, PartitionKey, RangeKey, JsonFormat.Document> {
  /**
   * The `get` operation returns a set of attributes for the item with the given
   * primary key. If there is no matching item, `get` does not return any data
   * and there will be no `Item` element in the response.
   *
   *
   * ```ts
   * declare const table: Table<Item, "pk">
   *
   * const response = await table.get({
   *   Key: {
   *     pk: "key"
   *   }
   * });
   *
   * response.Item; // Item | undefined
   * ```
   *
   * `get` provides an eventually consistent read by default. If your application
   * requires a strongly consistent read, set `ConsistentRead` to `true`. Although a
   * strongly consistent read might take more time than an eventually consistent
   * read,it always returns the last updated value.
   *
   * ```ts
   * await table.get({
   *   Key: {
   *     pk: "key"
   *   },
   *   ConsistentRead: true
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html
   */
  readonly get: GetItem<Item, PartitionKey, RangeKey, JsonFormat.Document>;

  /**
   * The `batchGet` operation returns a list of items for each of the given primary
   * keys. If there are no matching items, both the `Items` and `UnprocessedKeys` properties
   * will be empty in the response.
   *
   * ```ts
   * const response = await table.batchGet({
   *   Keys: [
   *     {
   *       pk: "pk",
   *       sk: "sk",
   *     },
   *     {
   *       ..
   *     }
   *   ],
   * });
   *
   * response.Items; // Item[]
   * ```
   *
   * A request can have partial failures where some of the requested keys are not
   * retrieved successfully. The failed keys are available on the `UnprocessedKeys`
   * property and should be retried by the caller.
   *
   * ```ts
   * const response = await table.batchGet({ .. })
   *
   * if (response.UnprocessedKeys) {
   *   // retry the failed keys
   *   const retryResponse = await table.batchGet({
   *     Keys: response.UnprocessedKeys
   *   });
   * }
   * ```
   *
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html
   */
  readonly batchGet: BatchGetItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  readonly transactGet: TransactGetItems<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  readonly transactWrite: TransactWriteItems<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  readonly put: PutItem<Item, JsonFormat.Document>;

  readonly update: UpdateItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  readonly batchWrite: BatchWriteItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  readonly delete: DeleteItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  readonly query: Query<Item, JsonFormat.Document>;

  readonly scan: Scan<Item, JsonFormat.Document>;
}

export class TableAttributesApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> extends TableRuntimeApi<
  Item,
  PartitionKey,
  RangeKey,
  JsonFormat.AttributeValue
> {}

/**
 * The Runtime API for a DynamoDB {@link Table} using the Attribute Value JSON format.
 *
 * @tparam {@link Item} - the type of data in the DynamoDB Table
 * @tparam {@link PartitionKey} - the name of the Partition Key field
 * @tparam {@link RangeKey} - the name of the Range Key field if specified, otherwise undefined
 */
export interface TableAttributesApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> {
  /**
   * The `get` operation returns a set of attributes for the item with the given
   * primary key. If there is no matching item, `get` does not return any data
   * and there will be no `Item` element in the response.
   *
   * ```ts
   * declare const table: Table<Item, "pk">
   *
   * const response = await table.attributes.get({
   *   Key: {
   *     pk: {
   *       S: "key"
   *     }
   *   }
   * });
   *
   * response.Item?.pk.S // string | undefined
   * ```
   *
   * `get` provides an eventually consistent read by default. If your application
   * requires a strongly consistent read, set `ConsistentRead` to `true`. Although a
   * strongly consistent read might take more time than an eventually consistent
   * read,it always returns the last updated value.
   *
   * ```ts
   * await table.attributes.get({
   *   Key: {
   *     pk: {
   *       S: "key"
   *     }
   *   },
   *   ConsistentRead: true
   * });
   * ```
   *
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_AttributeValue.html
   */
  readonly get: GetItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  /**
   * The `batchGet` operation returns a list of items for each of the given primary
   * keys. If there are no matching items, both the `Items` and `UnprocessedKeys` properties
   * will be empty in the response.
   *
   * ```ts
   * const response = await table.attributes.batchGet({
   *   Keys: [
   *     {
   *       pk: { S: "pk" },
   *       sk: { S: "sk" },
   *     },
   *     {
   *       ..
   *     }
   *   ],
   * });
   *
   * response.Items; // Array<{ pk: { S: string }, sk: { S: string }, .. }>
   * ```
   *
   * A request can have partial failures where some of the requested keys are not
   * retrieved successfully. The failed keys are available on the `UnprocessedKeys`
   * property and should be retried by the caller.
   *
   * ```ts
   * const response = await table.attributes.batchGet({ .. })
   *
   * if (response.UnprocessedKeys) {
   *   // retry the failed keys
   *   const retryResponse = await table.attributes.batchGet({
   *     Keys: response.UnprocessedKeys
   *   });
   * }
   * ```
   *
   * @see https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html
   */
  readonly batchGet: BatchGetItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  readonly transactGet: TransactGetItems<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  readonly transactWrite: TransactWriteItems<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  readonly put: PutItem<Item, JsonFormat.AttributeValue>;

  readonly update: UpdateItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  readonly batchWrite: BatchWriteItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  readonly delete: DeleteItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  readonly query: Query<Item, JsonFormat.AttributeValue>;

  readonly scan: Scan<Item, JsonFormat.AttributeValue>;
}
