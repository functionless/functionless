import { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb";
import {
  BatchGetItem,
  BatchGetItemInput,
  BatchGetItemOutput,
  createBatchGetItemIntegration,
} from "./batch-get-item";
import {
  BatchWriteItem,
  createBatchWriteItemIntegration,
} from "./batch-write-item";
import {
  createDeleteItemIntegration,
  DeleteItem,
  DeleteItemReturnValues,
  DeleteItemInput,
  DeleteItemOutput,
} from "./delete-item";
import {
  createGetItemIntegration,
  GetItem,
  GetItemInput,
  GetItemOutput,
} from "./get-item";
import {
  createPutItemIntegration,
  PutItem,
  PutItemInput,
  PutItemOutput,
} from "./put-item";
import { createQueryIntegration, Query } from "./query";
import { ReturnValues } from "./return-value";
import { createScanIntegration, Scan } from "./scan";
import type { Table } from "./table";
import {
  createTransactGetItemsIntegration,
  TransactGetItems,
  TransactGetItem,
  Get,
} from "./transact-get-item";
import {
  createTransactWriteItemsIntegration,
  TransactWriteItems,
  TransactWriteItemsInput,
  TransactWriteItemsOutput,
  ConditionCheck,
  Update,
  Put,
  Delete,
} from "./transact-write-item";
import {
  createUpdateItemIntegration,
  UpdateItem,
  UpdateItemInput,
  UpdateItemOutput,
} from "./update-item";

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

  readonly query: Query<Item, PartitionKey, RangeKey, Format>;

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
    this.query = createQueryIntegration<Item, PartitionKey, RangeKey, Format>(
      resource,
      format
    );
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
   * @see {@link GetItem}
   * @see {@link GetItemInput}
   * @see {@link GetItemOutput}
   * @see [AWS API Reference](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_GetItem.html)
   */
  readonly get: GetItem<Item, PartitionKey, RangeKey, JsonFormat.Document>;

  /**
   * Creates a new item, or replaces an old item with a new item. If an item that
   * has the same primary key as the new item already exists in the specified table,
   * the new item completely replaces the existing item.
   *
   * ```ts
   * await table.put({
   *   Item: newItem
   * });
   * ```
   *
   * You can perform a conditional put operation (add a new item if one with the
   * specified primary key doesn't exist), or replace an existing item if it has certain
   * attribute values.
   *
   * ```ts
   * await table.put({
   *   Item: newItem,
   *   ConditionExpression: "attribute = value"
   * });
   * ```
   *
   * You can return the item's attribute values in the same operation, using the
   * {@link ReturnValues} parameter.
   * ```ts
   * await table.put({
   *   Item: newItem,
   *   ReturnValues: "ALL_OLD"
   * });
   * ```
   *
   * When you add an item, the primary key attributes are the only required attributes.
   * Attribute values cannot be `null`. Empty String and Binary attribute values are
   * allowed. Attribute values of type String and Binary must have a length greater than
   * zero if the attribute is used as a key attribute for a table or index. Set type
   * attributes cannot be empty. Invalid Requests with empty values will be rejected with
   * a `ValidationException` exception.
   *
   * To prevent a new item from replacing an existing item, use a conditional expression
   * that contains the `attribute_not_exists` function with the name of the attribute being
   * used as the partition key for the table. Since every record must contain that attribute,
   * the attribute_not_exists function will only succeed if no matching item exists.
   *
   * ```ts
   * await table.put({
   *   Item: newItem,
   *   // ensure the item doesn't already exist
   *   ConditionExpression: "attribute_not_exists(pk)"
   * });
   * ```
   *
   * @see {@link PutItem}
   * @see {@link PutItemInput}
   * @see {@link PutItemOutput}
   * @see [PutItem API Reference](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_PutItem.html)
   * @see [Condition Expressions Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   */
  readonly put: PutItem<Item, JsonFormat.Document>;

  /**
   * Edits an existing item's attributes, or adds a new item to the table if it does not
   * already exist. You can put, delete, or add attribute values.
   * ```ts
   * await table.update({
   *   Key: key,
   *   UpdateExpression: "SET attribute = <val>"
   * })
   * ```
   *
   * Not all names and values are supported in an `UpdateExpression`, such as reserved
   * words, keys with complex names and complex values. To alias names, specify it in the
   * `ExpressionAttributeNames` map with a name prefixed by a `#`. Then, use the alias
   * in your `UpdateExpression`
   * ```ts
   * await table.update({
   *   Key: key,
   *   UpdateExpression: "SET #attribute = <val>",
   *   ExpressionAttributeNames: {
   *     "#attribute": "special name"
   *   }
   * })
   * ```
   *
   * Similarly, to alias a value for use in an `UpdateExpression`, provide  value in the
   * `ExpressionAttributeValues` map prefixed with `:`. Then, use the alias in your
   * `UpdateExpression`.
   * ```ts
   * await table.update({
   *   Key: key,
   *   UpdateExpression: "SET attribute = :val",
   *   ExpressionAttributeValues: {
   *     ":val": "my value"
   *   }
   * })
   * ```
   *
   * You can also perform a conditional update on an existing item (insert a new attribute
   * name-value pair if it doesn't exist, or replace an existing name-value pair if it has
   * certain expected attribute values).
   *
   * ```ts
   * await table.update({
   *   Key: key,
   *   UpdateExpression: "SET attribute = <new-val>",
   *   ConditionExpression: "attribute = <old-val>"
   * })
   * ```
   *
   * You can also return the item's attribute values in the same `update` operation using
   * the {@link ReturnValues} parameter.
   * ```ts
   * const response = await table.update({
   *   Key: key,
   *   UpdateExpression: "SET attribute = <new-val>",
   *   ReturnValues: "ALL_OLD"
   * });
   *
   * response.Attributes; // attributes of the old item (its state prior to this `update` request).
   * ```
   *
   * @see {@link UpdateItem}
   * @see {@link UpdateItemInput}
   * @see {@link UpdateItemOutput}
   * @see [Update Expressions Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.UpdateExpressions.html)
   * @see [Condition Expressions Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   * @see [UpdateItem API Reference](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_UpdateItem.html)
   */
  readonly update: UpdateItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  /**
   * Deletes a single item in a table by primary key.
   *
   * ```ts
   * await table.delete({
   *   Key: {
   *     pk: "partition key"
   *   }
   * });
   * ```
   *
   * You can perform a conditional delete operation that deletes the item if it has an expected
   * attribute value.
   * ```ts
   * await table.delete({
   *   Key: key,
   *   ConditionExpression: "attribute = <val>"
   * });
   * ```
   *
   * Not all names and values are supported in a `ConditionExpression`, such as reserved
   * words, keys with complex names and complex values. To alias names, specify it in the
   * `ExpressionAttributeNames` map with a name prefixed by a `#`. Then, use the alias
   * in your `ConditionExpression`
   * ```ts
   * await table.delete({
   *   Key: key,
   *   ConditionExpression: "$attribute = <val>",
   *   ExpressionAttributeNames: {
   *     "#attribute": "special name"
   *   }
   * })
   * ```
   *
   * Similarly, to alias a value for use in an `ConditionExpression`, provide  value in the
   * `ExpressionAttributeValues` map prefixed with `:`. Then, use the alias in your
   * `ConditionExpression`.
   * ```ts
   * await table.delete({
   *   Key: key,
   *   ConditionExpression: "attribute = :val",
   *   ExpressionAttributeValues: {
   *     ":val": "my value"
   *   }
   * })
   * ```
   *
   * In addition to deleting an item, you can also return the item's attribute values in the same
   * operation, using the `ReturnValues` parameter. Unless you specify conditions, the DeleteItem is
   * an idempotent operation; running it multiple times on the same item or attribute does not
   * result in an error response. Conditional deletes are useful for deleting items only if specific
   * conditions are met. If those conditions are met, DynamoDB performs the delete. Otherwise, the
   * item is not deleted.
   *
   * @see {@link DeleteItem}
   * @see {@link DeleteItemInput}
   * @see {@link DeleteItemOutput}
   * @see {@link DeleteItemReturnValues}
   * @see [Condition Expressions Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   * @see [DeleteItem API Reference](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html)
   */
  readonly delete: DeleteItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  /**
   * `query` returns all items that contain a partition key value. Use the `KeyConditionExpression`
   * parameter to provide a specific value for the partition key. The `query` operation will return
   * all of the items from the table or index with that partition key value.
   *
   * ```ts
   * await table.query({
   *   KeyConditionExpression: "pk = :pk",
   *   ExpressionAttributeValues: {
   *     ":pk": "partition key"
   *   }
   * })
   * ```
   *
   * You can optionally narrow the scope of the `query` operation by specifying a sort key value
   * and a comparison operator in `KeyConditionExpression`.
   * ```ts
   * await table.query({
   *   KeyConditionExpression: "pk = :pk AND starts_with(sk, :prefix)",
   *   ExpressionAttributeValues: {
   *     ":pk": "partition key",
   *     ":prefix": "prefix"
   *   }
   * })
   * ```
   *
   * To further refine the `query` results, you can optionally provide a `FilterExpression`. A `FilterExpression`
   * determines which items within the results should be returned to you. All of the other results are
   * discarded.
   *
   * ```ts
   * await table.query({
   *   KeyConditionExpression: "pk = :pk AND starts_with(sk, :prefix)",
   *   FilterExpression: "field < 0"
   *   ..
   * });
   * ```
   *
   * `Query` results are always sorted by the sort key value. If the data type of the sort key is `Number`, the
   * results are returned in numeric order; otherwise, the results are returned in order of UTF-8 bytes. By
   * default, the sort order is ascending. To reverse the order, set the `ScanIndexForward` parameter to false.
   *
   * ```ts
   * await table.query({
   *   KeyConditionExpression: "pk = :pk",
   *   // query in reverse-order
   *   ScanIndexForward: false
   * });
   * ```
   *
   * A single `Query` operation will read up to the maximum number of items set (if using the `Limit` parameter)
   * or a maximum of **1 MB** of data and then apply any filtering to the results using `FilterExpression`.
   *
   * ```ts
   * await table.query({
   *   ..,
   *   Limit: 10
   * });
   * ```
   *
   * If `LastEvaluatedKey` is present in the response, you will need to paginate the result set by
   * setting the `ExclusiveStartKey` in subsequent requests.
   * ```ts
   * const KeyConditionExpression: string = ..
   * const response = await table.query({
   *   KeyConditionExpression
   * });
   * if (response.LastEvaluatedKey) {
   *   await table.query({
   *     // the KeyConditionExpression must be the same across query requests
   *     KeyConditionExpression,
   *     // use the LastEvaluatedKey as the starting point
   *     ExclusiveStartKey: response.LastEvaluatedKey
   *   });
   * }
   * ```
   *
   * `FilterExpression` is applied after a `Query` finishes, but before the results are returned. A `FilterExpression`
   * cannot contain partition key or sort key attributes. You need to specify those attributes in the
   * `KeyConditionExpression`.
   * ```ts
   * const response = await table.query({
   *   KeyConditionExpression: ..,
   *   FilterExpression: "#field = :val"
   * });
   * ```
   *
   * A `Query` operation can return an empty result set and a `LastEvaluatedKey` if all the items read for the page
   * of results are filtered out.
   *
   * You can query a table, a local secondary index, or a global secondary index. For a query on a table or on
   * a local secondary index, you can set the `ConsistentRead` parameter to true and obtain a strongly consistent
   * result. Global secondary indexes support eventually consistent reads only, so do not specify `ConsistentRead`
   * when querying a global secondary index.
   *
   * A `query` operation always returns a result set. If no matching items are found, the result set will be
   * empty. Queries that do not return results consume the minimum number of read capacity units for that
   * type of read operation. DynamoDB calculates the number of read capacity units consumed based on item
   * size, not on the amount of data that is returned to an application. The number of capacity units consumed
   * will be the same whether you request all of the attributes (the default behavior) or just some of
   * them (using a projection expression). The number will also be the same whether or not you use a
   * `FilterExpression`.
   */
  readonly query: Query<Item, PartitionKey, RangeKey, JsonFormat.Document>;

  readonly scan: Scan<Item, JsonFormat.Document>;

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
   * @see {@link BatchGetItem}
   * @see {@link BatchGetItemInput}
   * @see {@link BatchGetItemOutput}
   * @see [BatchGetItem API Reference](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchGetItem.html)
   */
  readonly batchGet: BatchGetItem<
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

  /**
   * `transactGet` is a synchronous operation that atomically retrieves multiple items
   * from a table. A `transactGet` call can contain up to `25` {@link TransactGetItem} objects,
   * each of which contains a {@link Get} structure that specifies an item to retrieve from the
   * table.
   *
   * ```ts
   * const response = await table.transactGet({
   *   TransactItems: [
   *     {
   *       Get: {
   *         Key: {
   *           pk: "partition key",
   *           sk: "sort key",
   *         },
   *       },
   *     },
   *     ...
   *   ],
   * });
   * ```
   *
   * Unlike the {@link batchGet} operation where some requested keys can fail, `transactGet`
   * ensures that all (or none) {@link Get} requests are successfully retrieved - i.e. the
   * whole operation happens within a single transaction. This comes with the added cost of
   * each {@link Get} request consuming 2 Read Capacity Units.
   *
   * The aggregate size of the items in the transaction cannot exceed **4 MB**. DynamoDB rejects
   * the entire `transactGet` request if any of the following is true:
   * * A conflicting operation is in the process of updating an item to be read.
   * * There is insufficient provisioned capacity for the transaction to be completed.
   * * There is a user error, such as an invalid data format.
   * * The aggregate size of the items in the transaction cannot exceed 4 MB.
   *
   * @see {@link TransactGetItems}
   * @see {@link TransactGetItemsInput}
   * @see {@link TransactGetItemsOutput}
   * @see {@link Get}
   * @see [TransactGetItems API Reference](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactGetItems.html)
   */
  readonly transactGet: TransactGetItems<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;

  /**
   * TransactWriteItems is a synchronous write operation that groups up to **25** action
   * requests. No two actions can target the same item. For example, you cannot both
   * {@link ConditionCheck} and {@link Update} the same item.
   *
   * ```ts
   * await table.transactWrite({
   *   TransactItems: [
   *     {
   *       Put: {
   *         Item: item1,
   *       },
   *     },
   *     {
   *       Update: {
   *         Key: key1,
   *         UpdateExpression: "SET .."
   *       },
   *     },
   *     {
   *       Delete: {
   *         Key: key2
   *       }
   *     },
   *     {
   *       ConditionCheck: {
   *         Key: key3,
   *         ConditionExpression: ".."
   *       }
   *     }
   *   ],
   * });
   * ```
   *
   * Unlike {@link batchWrite}, the actions are completed atomically so that either all
   * of them succeed, or all of them fail. Supported actions include:
   * * {@link Put} — Initiates a `PutItem` operation to write a new item. This structure
   * specifies the primary key of the item to be written, an optional condition expression
   * that must be satisfied for the write to succeed, a list of the item's attributes, and
   * a field indicating whether to retrieve the item's attributes if the condition is not met.
   * * {@link Update} — Initiates an UpdateItem operation to update an existing item. This
   * structure specifies the primary key of the item to be updated, an optional condition
   * expression that must be satisfied for the update to succeed, an expression that defines
   * one or more attributes to be updated, and a field indicating whether to retrieve the
   * item's attributes if the condition is not met.
   * * {@link Delete} — Initiates a DeleteItem operation to delete an existing item. This
   * structure specifies the primary key of the item to be deleted, an optional condition
   * expression that must be satisfied for the deletion to succeed, and a field indicating
   * whether to retrieve the item's attributes if the condition is not met.
   * {@link ConditionCheck} — Applies a condition to an item that is not being modified by
   * the transaction. This structure specifies the primary key of the item to be checked
   * a condition expression that must be satisfied for the transaction to succeed, and a
   * field indicating whether to retrieve the item's attributes if the condition is not met.
   *
   * DynamoDB rejects the entire TransactWriteItems request if any of the following is true:
   * * A condition in one of the condition expressions is not met.
   * * An ongoing operation is in the process of updating the same item.
   * * There is insufficient provisioned capacity for the transaction to be completed.
   * * An item size becomes too large (bigger than **400 KB**), a local secondary index
   * (LSI) becomes too large, or a similar validation error occurs because of changes made
   * by the transaction.   T
   * * The aggregate size of the items in the transaction exceeds **4 MB**.
   * * There is a user error, such as an invalid data format.
   *
   * @see {@link TransactWriteItems}
   * @see {@link TransactWriteItemsInput}
   * @see {@link TransactWriteItemsOutput}
   * @see {@link Put}
   * @see {@link Update}
   * @see {@link Delete}
   * @see {@link ConditionCheck}
   * @see [Condition Expressions Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.ConditionExpressions.html)
   * @see [TransactWriteItems API Reference](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_TransactWriteItems.html)
   */
  readonly transactWrite: TransactWriteItems<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.Document
  >;
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

  readonly query: Query<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  readonly scan: Scan<Item, JsonFormat.AttributeValue>;
}
