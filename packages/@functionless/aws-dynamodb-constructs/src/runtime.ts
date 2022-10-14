import type {
  BatchGetItem,
  BatchWriteItem,
  DeleteItem,
  GetItem,
  PutItem,
  Query,
  ReturnValues,
  TransactGetItems,
  TransactWriteItems,
  UpdateItem,
} from "@functionless/aws-dynamodb";
import type { aws_dynamodb } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb";
import { createBatchGetItemIntegration } from "./batch-get-item";
import { createBatchWriteItemIntegration } from "./batch-write-item";
import { createDeleteItemIntegration } from "./delete-item";
import { createGetItemIntegration } from "./get-item";
import { createPutItemIntegration } from "./put-item";
import { createQueryIntegration } from "./query";
import { createScanIntegration, Scan } from "./scan";
import type { Table } from "./table";
import { createTransactGetItemsIntegration } from "./transact-get-item";
import { createTransactWriteItemsIntegration } from "./transact-write-item";
import { createUpdateItemIntegration } from "./update-item";

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
  batchGet: BatchGetItem<Item, PartitionKey, RangeKey, Format>;
  batchWrite: BatchWriteItem<Item, PartitionKey, RangeKey, Format>;
  delete: DeleteItem<Item, PartitionKey, RangeKey, Format>;
  get: GetItem<Item, PartitionKey, RangeKey, Format>;
  put: PutItem<Item, Format>;
  query: Query<Item, PartitionKey, RangeKey, Format>;
  scan: Scan<Item, PartitionKey, RangeKey, Format>;
  transactGet: TransactGetItems<Item, PartitionKey, RangeKey, Format>;
  transactWrite: TransactWriteItems<Item, PartitionKey, RangeKey, Format>;
  update: UpdateItem<Item, PartitionKey, RangeKey, Format>;

  constructor(resource: aws_dynamodb.ITable, format: Format) {
    this.get = createGetItemIntegration(resource, format);
    this.batchGet = createBatchGetItemIntegration(resource, format);
    this.batchWrite = createBatchWriteItemIntegration(resource, format);
    this.delete = createDeleteItemIntegration(resource, format);
    this.put = createPutItemIntegration(resource, format);
    this.query = createQueryIntegration<Item, PartitionKey, RangeKey, Format>(
      resource,
      format
    );
    this.scan = createScanIntegration(resource, format);
    this.transactGet = createTransactGetItemsIntegration(resource, format);
    this.transactWrite = createTransactWriteItemsIntegration(resource, format);
    this.update = createUpdateItemIntegration(resource, format);
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
   * `FilterExpression` is applied after a `Query` finishes, but before the results are returned.
   * A `FilterExpression` cannot contain partition key or sort key attributes. You need to specify
   * those attributes in the `KeyConditionExpression`.
   * ```ts
   * const response = await table.query({
   *   KeyConditionExpression: ..,
   *   FilterExpression: "#field = :val"
   * });
   * ```
   *
   * A `Query` operation can return an empty result set and a `LastEvaluatedKey` if all the items
   * read for the page of results are filtered out.
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

  /**
   * The `scan` operation returns one or more items and item attributes by accessing every item in
   * table or a secondary index.
   * ```ts
   * const response = await table.scan();
   *
   * response.Items // Item[] | undefined;
   * ```
   *
   * To have DynamoDB return fewer items, you can provide a `FilterExpression` operation.
   * ```ts
   * await table.scan({
   *   FilterExpression: "#field = :val"
   * });
   * ```
   *
   * If the total number of scanned items exceeds the maximum dataset size limit of **1 MB**,
   * the scan stops and results are returned to the user along with a `LastEvaluatedKey` value to
   * continue the scan in a subsequent operation. The results also include the number of
   * items exceeding the limit.
   *
   * ```ts
   * const response = await table.scan();
   *
   * if (response.LastEvaluatedKey) {
   *   await table.scan({
   *     ExclusiveStartKey: response.LastEvaluatedKey
   *   });
   * }
   * ```
   *
   * A single `scan` operation reads up to the maximum number of items set (if using the Limit
   * parameter) or a maximum of 1 MB of data and then apply any filtering to the results using
   * `FilterExpression`. If `LastEvaluatedKey` is present in the response, you need to paginate the
   * result set.
   *
   * `scan` operations proceed sequentially; however, for faster performance on a large table or
   * secondary index, applications can request a parallel `scan` operation by providing the `Segment`
   * and `TotalSegments` parameters.
   *
   * `scan` uses eventually consistent reads when accessing the data in a table; therefore, the result
   * set might not include the changes to data in the table immediately before the operation began.
   * If you need a consistent copy of the data, as of the time that the `scan` begins, you can set the
   * `ConsistentRead` parameter to true.
   */
  readonly scan: Scan<Item, PartitionKey, RangeKey, JsonFormat.Document>;

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

  /**
   * The `batchWrite` operation puts or deletes multiple items in one or more tables.
   *
   * ```ts
   * let batchWrite = await table.batchWrite({
   *   RequestItems: [
   *     {
   *       DeleteRequest: {
   *         Key: {
   *           pk: "partition key 1",
   *         },
   *       },
   *     },
   *     {
   *       PutRequest: {
   *         Item: {
   *           pk: "partition key 2",
   *           .. // rest of the item
   *         },
   *       },
   *     },
   *   ],
   * });
   * ```
   *
   * A single call to `batchWrite` can transmit up to 16MB of data over the network, consisting
   * of up to 25 item put or delete operations. While individual items can be up to 400 KB once stored,
   * it's important to note that an item's representation might be greater than 400KB while being
   * sent in DynamoDB's JSON format for the API call. For more details on this distinction, see
   * [Naming Rules and Data Types](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html).
   *
   * `batchWrite` cannot update items. To update items, use the {@link update} action.
   *
   * The individual {@link put} and {@link delete} operations specified in `batchWrite` are atomic;
   * however `batchWrite` as a whole is not. If any requested operations fail because the table's
   * provisioned throughput is exceeded or an internal processing failure occurs, the failed
   * operations are returned in the `UnprocessedItems` response parameter.
   *
   * ```ts
   * const response = await table.batchWrite(..);
   *
   * response.UnprocessedItems; // items that failed to process will be available here
   * ```
   *
   *
   * You can investigate and optionally resend the requests. Typically, you would call `batchWrite`
   * in a loop. Each iteration would check for unprocessed items and submit a new `batchWrite`
   * request with those unprocessed items until all items have been processed.
   * ```ts
   * let writeItems;
   * do {
   *   writeItems = await table.batchWrite(..);
   * } while (writeItems?.UnprocessedItems?.length);
   * ```
   *
   * If none of the items can be processed due to insufficient provisioned throughput
   * on all of the tables in the request, then `batchWrite` throws a `ProvisionedThroughputExceededException`.
   * ```ts
   * try {
   *   await table.batchWrite(..);
   * } catch (err) {
   *   if (err.code === "ProvisionedThroughputExceededException") {
   *     // handle
   *   }
   * }
   * ```
   *
   * However, we strongly recommend that you use an exponential backoff algorithm. If you retry the
   * batch operation immediately, the underlying read or write requests can still fail due to
   * throttling on the individual tables. If you delay the batch operation using exponential backoff,
   * the individual requests in the batch are much more likely to succeed. For more information,
   * see [Batch Operations and Error Handling](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html#Programming.Errors.BatchOperations).
   *
   * ```ts
   * let writeItems;
   * let backoff = 100;
   * let maxRetries = 10;
   * let attempt = 0;
   * while (attempt < maxRetries) {
   *   writeItems = await table.batchWrite(..);
   *   if (!writeItems.UnprocessedItems?.length) {
   *     break;
   *   }
   *   attempt += 1;
   *   if (attempt > maxRetries) {
   *     // don't retry forever, fail after so many attempts
   *     throw new Error("failed");
   *   }
   *   // sleep for some time before trying again
   *   await new Promise((resolve) => setTimeout(resolve, backoff);
   *   backoff *= 2; // exponentially increases backoff
   * }
   * ```
   *
   * With `batchWrite`, you can efficiently write or delete large amounts of data, such as from Amazon EMR,
   * or copy data from another database into DynamoDB. In order to improve performance with these large-scale
   * operations, `batchWrite` does not behave in the same way as individual {@link put} and {@link delete} calls
   * would. For example, you cannot specify conditions on individual put and delete requests, and
   * `batchWrite` does not return deleted items in the response. `batchWrite` performs the specified put
   * and delete operations in parallel, giving you the power of the thread pool approach without having to
   * introduce complexity into your application. Parallel processing reduces latency, but each specified put
   * and delete request consumes the same number of write capacity units whether it is processed in parallel
   * or not. Delete operations on nonexistent items consume one write capacity unit.
   *
   * If one or more of the following is true, DynamoDB rejects the entire batch write operation:
   * * One or more tables specified in the `batchWrite` request does not exist.
   * * Primary key attributes specified on an item in the request do not match those in the corresponding table's primary key schema.
   * * You try to perform multiple operations on the same item in the same `batchWrite` request. For example, you cannot put and delete the same item
   * in the same `batchWrite` request.
   * * Your request contains at least two items with identical hash and range keys (which essentially is two put operations).
   * * There are more than 25 requests in the batch.
   * * Any individual item in a batch exceeds 400 KB. The total request size exceeds 16 MB.
   *
   * @see {@link DeleteRequest}
   * @see {@link PutRequest}
   * @see {@link BatchWriteItem}
   * @see [BatchWriteItem API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html)
   */
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
   * Creates a new item, or replaces an old item with a new item. If an item that
   * has the same primary key as the new item already exists in the specified table,
   * the new item completely replaces the existing item.
   *
   * ```ts
   * await table.attributes.put({
   *   Item: newItem
   * });
   * ```
   *
   * You can perform a conditional put operation (add a new item if one with the
   * specified primary key doesn't exist), or replace an existing item if it has certain
   * attribute values.
   *
   * ```ts
   * await table.attributes.put({
   *   Item: newItem,
   *   ConditionExpression: "attribute = value"
   * });
   * ```
   *
   * You can return the item's attribute values in the same operation, using the
   * {@link ReturnValues} parameter.
   * ```ts
   * await table.attributes.put({
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
   * await table.attributes.put({
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
  readonly put: PutItem<Item, JsonFormat.AttributeValue>;

  /**
   * Edits an existing item's attributes, or adds a new item to the table if it does not
   * already exist. You can put, delete, or add attribute values.
   * ```ts
   * await table.attributes.update({
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
   * await table.attributes.update({
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
   * await table.attributes.update({
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
   * await table.attributes.update({
   *   Key: key,
   *   UpdateExpression: "SET attribute = <new-val>",
   *   ConditionExpression: "attribute = <old-val>"
   * })
   * ```
   *
   * You can also return the item's attribute values in the same `update` operation using
   * the {@link ReturnValues} parameter.
   * ```ts
   * const response = await table.attributes.update({
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
    JsonFormat.AttributeValue
  >;

  /**
   * Deletes a single item in a table by primary key.
   *
   * ```ts
   * await table.attributes.delete({
   *   Key: {
   *     pk: {
   *       S: "partition key"
   *     }
   *   }
   * });
   * ```
   *
   * You can perform a conditional delete operation that deletes the item if it has an expected
   * attribute value.
   * ```ts
   * await table.attributes.delete({
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
   * await table.attributes.delete({
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
   * await table.attributes.delete({
   *   Key: key,
   *   ConditionExpression: "attribute = :val",
   *   ExpressionAttributeValues: {
   *     ":val": {
   *       S: "my value"
   *     }
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
    JsonFormat.AttributeValue
  >;

  /**
   * `query` returns all items that contain a partition key value. Use the `KeyConditionExpression`
   * parameter to provide a specific value for the partition key. The `query` operation will return
   * all of the items from the table or index with that partition key value.
   *
   * ```ts
   * await table.attributes.query({
   *   KeyConditionExpression: "pk = :pk",
   *   ExpressionAttributeValues: {
   *     ":pk": {
   *       S: "partition key"
   *     }
   *   }
   * })
   * ```
   *
   * You can optionally narrow the scope of the `query` operation by specifying a sort key value
   * and a comparison operator in `KeyConditionExpression`.
   * ```ts
   * await table.attributes.query({
   *   KeyConditionExpression: "pk = :pk AND starts_with(sk, :prefix)",
   *   ExpressionAttributeValues: {
   *     ":pk": { S: "partition key" },
   *     ":prefix": { S: "prefix" }
   *   }
   * })
   * ```
   *
   * To further refine the `query` results, you can optionally provide a `FilterExpression`. A `FilterExpression`
   * determines which items within the results should be returned to you. All of the other results are
   * discarded.
   *
   * ```ts
   * await table.attributes.query({
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
   * await table.attributes.query({
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
   * await table.attributes.query({
   *   ..,
   *   Limit: 10
   * });
   * ```
   *
   * If `LastEvaluatedKey` is present in the response, you will need to paginate the result set by
   * setting the `ExclusiveStartKey` in subsequent requests.
   * ```ts
   * const KeyConditionExpression: string = ..
   * const response = await table.attributes.query({
   *   KeyConditionExpression
   * });
   * if (response.LastEvaluatedKey) {
   *   await table.attributes.query({
   *     // the KeyConditionExpression must be the same across query requests
   *     KeyConditionExpression,
   *     // use the LastEvaluatedKey as the starting point
   *     ExclusiveStartKey: response.LastEvaluatedKey
   *   });
   * }
   * ```
   *
   * `FilterExpression` is applied after a `Query` finishes, but before the results are returned.
   * A `FilterExpression` cannot contain partition key or sort key attributes. You need to specify
   * those attributes in the `KeyConditionExpression`.
   * ```ts
   * const response = await table.attributes.query({
   *   KeyConditionExpression: ..,
   *   FilterExpression: "#field = :val"
   * });
   * ```
   *
   * A `Query` operation can return an empty result set and a `LastEvaluatedKey` if all the items
   * read for the page of results are filtered out.
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
  readonly query: Query<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
  >;

  /**
   * The `scan` operation returns one or more items and item attributes by accessing every item in
   * table or a secondary index.
   * ```ts
   * const response = await table.scan();
   *
   * response.Items?.forEach(item => ..);
   * ```
   *
   * To have DynamoDB return fewer items, you can provide a `FilterExpression` operation.
   * ```ts
   * await table.scan({
   *   FilterExpression: "#field = :val"
   * });
   * ```
   *
   * If the total number of scanned items exceeds the maximum dataset size limit of **1 MB**,
   * the scan stops and results are returned to the user along with a `LastEvaluatedKey` value to
   * continue the scan in a subsequent operation. The results also include the number of
   * items exceeding the limit.
   *
   * ```ts
   * const response = await table.scan();
   *
   * if (response.LastEvaluatedKey) {
   *   await table.scan({
   *     ExclusiveStartKey: response.LastEvaluatedKey
   *   });
   * }
   * ```
   *
   * A single `scan` operation reads up to the maximum number of items set (if using the Limit
   * parameter) or a maximum of 1 MB of data and then apply any filtering to the results using
   * `FilterExpression`. If `LastEvaluatedKey` is present in the response, you need to paginate the
   * result set.
   *
   * `scan` operations proceed sequentially; however, for faster performance on a large table or
   * secondary index, applications can request a parallel `scan` operation by providing the `Segment`
   * and `TotalSegments` parameters.
   *
   * `scan` uses eventually consistent reads when accessing the data in a table; therefore, the result
   * set might not include the changes to data in the table immediately before the operation began.
   * If you need a consistent copy of the data, as of the time that the `scan` begins, you can set the
   * `ConsistentRead` parameter to true.
   */
  readonly scan: Scan<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>;

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

  /**
   * The `batchWrite` operation puts or deletes multiple items in one or more tables.
   *
   * ```ts
   * let batchWrite = await table.batchWrite({
   *   RequestItems: [
   *     {
   *       DeleteRequest: {
   *         Key: {
   *           pk: { S: "partition key 1" },
   *         },
   *       },
   *     },
   *     {
   *       PutRequest: {
   *         Item: {
   *           pk: { S: "partition key 2" },
   *           .. // rest of the item
   *         },
   *       },
   *     },
   *   ],
   * });
   * ```
   *
   * A single call to `batchWrite` can transmit up to 16MB of data over the network, consisting
   * of up to 25 item put or delete operations. While individual items can be up to 400 KB once stored,
   * it's important to note that an item's representation might be greater than 400KB while being
   * sent in DynamoDB's JSON format for the API call. For more details on this distinction, see
   * [Naming Rules and Data Types](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html).
   *
   * `batchWrite` cannot update items. To update items, use the {@link update} action.
   *
   * The individual {@link put} and {@link delete} operations specified in `batchWrite` are atomic;
   * however `batchWrite` as a whole is not. If any requested operations fail because the table's
   * provisioned throughput is exceeded or an internal processing failure occurs, the failed
   * operations are returned in the `UnprocessedItems` response parameter.
   *
   * ```ts
   * const response = await table.batchWrite(..);
   *
   * response.UnprocessedItems; // items that failed to process will be available here
   * ```
   *
   *
   * You can investigate and optionally resend the requests. Typically, you would call `batchWrite`
   * in a loop. Each iteration would check for unprocessed items and submit a new `batchWrite`
   * request with those unprocessed items until all items have been processed.
   * ```ts
   * let writeItems;
   * do {
   *   writeItems = await table.batchWrite(..);
   * } while (writeItems?.UnprocessedItems?.length);
   * ```
   *
   * If none of the items can be processed due to insufficient provisioned throughput
   * on all of the tables in the request, then `batchWrite` throws a `ProvisionedThroughputExceededException`.
   * ```ts
   * try {
   *   await table.batchWrite(..);
   * } catch (err) {
   *   if (err.code === "ProvisionedThroughputExceededException") {
   *     // handle
   *   }
   * }
   * ```
   *
   * However, we strongly recommend that you use an exponential backoff algorithm. If you retry the
   * batch operation immediately, the underlying read or write requests can still fail due to
   * throttling on the individual tables. If you delay the batch operation using exponential backoff,
   * the individual requests in the batch are much more likely to succeed. For more information,
   * see [Batch Operations and Error Handling](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Programming.Errors.html#Programming.Errors.BatchOperations).
   *
   * ```ts
   * let writeItems;
   * let backoff = 100;
   * let maxRetries = 10;
   * let attempt = 0;
   * while (attempt < maxRetries) {
   *   writeItems = await table.batchWrite(..);
   *   if (!writeItems.UnprocessedItems?.length) {
   *     break;
   *   }
   *   attempt += 1;
   *   if (attempt > maxRetries) {
   *     // don't retry forever, fail after so many attempts
   *     throw new Error("failed");
   *   }
   *   // sleep for some time before trying again
   *   await new Promise((resolve) => setTimeout(resolve, backoff);
   *   backoff *= 2; // exponentially increases backoff
   * }
   * ```
   *
   * With `batchWrite`, you can efficiently write or delete large amounts of data, such as from Amazon EMR,
   * or copy data from another database into DynamoDB. In order to improve performance with these large-scale
   * operations, `batchWrite` does not behave in the same way as individual {@link put} and {@link delete} calls
   * would. For example, you cannot specify conditions on individual put and delete requests, and
   * `batchWrite` does not return deleted items in the response. `batchWrite` performs the specified put
   * and delete operations in parallel, giving you the power of the thread pool approach without having to
   * introduce complexity into your application. Parallel processing reduces latency, but each specified put
   * and delete request consumes the same number of write capacity units whether it is processed in parallel
   * or not. Delete operations on nonexistent items consume one write capacity unit.
   *
   * If one or more of the following is true, DynamoDB rejects the entire batch write operation:
   * * One or more tables specified in the `batchWrite` request does not exist.
   * * Primary key attributes specified on an item in the request do not match those in the corresponding table's primary key schema.
   * * You try to perform multiple operations on the same item in the same `batchWrite` request. For example, you cannot put and delete the same item
   * in the same `batchWrite` request.
   * * Your request contains at least two items with identical hash and range keys (which essentially is two put operations).
   * * There are more than 25 requests in the batch.
   * * Any individual item in a batch exceeds 400 KB. The total request size exceeds 16 MB.
   *
   * @see {@link DeleteRequest}
   * @see {@link PutRequest}
   * @see {@link BatchWriteItem}
   * @see [BatchWriteItem API](https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_BatchWriteItem.html)
   */
  readonly batchWrite: BatchWriteItem<
    Item,
    PartitionKey,
    RangeKey,
    JsonFormat.AttributeValue
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
   *           pk: { S: "partition key" },
   *           sk: { S: "sort key" },
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
    JsonFormat.AttributeValue
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
    JsonFormat.AttributeValue
  >;
}
