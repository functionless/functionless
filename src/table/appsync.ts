import { AttributeValue } from "typesafe-dynamodb/lib/attribute-value";
import {
  BatchGetItemAppsync,
  createBatchGetItemAppsyncIntegration,
} from "./batch-get-item";
import {
  BatchDeleteItemAppsync,
  BatchPutItemAppsync,
  createBatchDeleteItemAppsyncIntegration,
  createBatchPutItemAppsyncIntegration,
} from "./batch-write-item";
import {
  createDeleteItemAppsyncIntegration,
  DeleteItemAppsync,
} from "./delete-item";
import { createGetItemAppsyncIntegration, GetItemAppsync } from "./get-item";
import { createPutItemAppsyncIntegration, PutItemAppsync } from "./put-item";
import { createQueryAppsyncIntegration, QueryAppsync } from "./query";
import { createScanAppsyncIntegration, ScanAppsync } from "./scan";
import { ITable } from "./table";
import {
  createTransactGetItemsAppsyncIntegration,
  TransactGetItemsAppsync,
} from "./transact-get-item";
import {
  createTransactWriteItemsAppsyncIntegration,
  TransactWriteItemsAppsync,
} from "./transact-write-item";
import {
  createUpdateItemAppsyncIntegration,
  UpdateItemAppsync,
} from "./update-item";

export class TableAppsyncApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> {
  readonly get: GetItemAppsync<Item, PartitionKey, RangeKey>;
  readonly batchGet: BatchGetItemAppsync<Item, PartitionKey, RangeKey>;
  readonly batchDelete: BatchDeleteItemAppsync<Item, PartitionKey, RangeKey>;
  readonly batchPut: BatchPutItemAppsync<Item, PartitionKey, RangeKey>;
  readonly put: PutItemAppsync<Item, PartitionKey, RangeKey>;
  readonly delete: DeleteItemAppsync<Item, PartitionKey, RangeKey>;
  readonly update: UpdateItemAppsync<Item, PartitionKey, RangeKey>;
  readonly query: QueryAppsync<Item>;
  readonly scan: ScanAppsync<Item>;
  readonly transactGet: TransactGetItemsAppsync<Item, PartitionKey, RangeKey>;
  readonly transactWrite: TransactWriteItemsAppsync<
    Item,
    PartitionKey,
    RangeKey
  >;

  constructor(table: ITable<Item, PartitionKey, RangeKey>) {
    this.get = createGetItemAppsyncIntegration(table);
    this.batchGet = createBatchGetItemAppsyncIntegration(table);
    this.batchDelete = createBatchDeleteItemAppsyncIntegration(table);
    this.batchPut = createBatchPutItemAppsyncIntegration(table);
    this.put = createPutItemAppsyncIntegration(table);
    this.delete = createDeleteItemAppsyncIntegration(table);
    this.update = createUpdateItemAppsyncIntegration(table);
    this.query = createQueryAppsyncIntegration(table);
    this.scan = createScanAppsyncIntegration(table);
    this.transactGet = createTransactGetItemsAppsyncIntegration(table);
    this.transactWrite = createTransactWriteItemsAppsyncIntegration(table);
  }
}

export interface DynamoDBAppsyncExpression {
  expression?: string;
  expressionNames?: {
    [name: string]: string;
  };
  expressionValues?: {
    /**
     * :val
     */
    [value: string]: AttributeValue;
  };
}
