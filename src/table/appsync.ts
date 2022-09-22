import { AttributeValue } from "typesafe-dynamodb/lib/attribute-value";
import {
  BatchGetItemAppsync,
  createBatchGetItemAppsyncIntegration,
} from "./batch-get-item";
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
  readonly put: PutItemAppsync<Item, PartitionKey, RangeKey>;
  readonly delete: DeleteItemAppsync<Item, PartitionKey, RangeKey>;
  readonly update: UpdateItemAppsync<Item, PartitionKey, RangeKey>;
  readonly query: QueryAppsync<Item>;
  readonly scan: ScanAppsync<Item>;

  constructor(readonly table: ITable<Item, PartitionKey, RangeKey>) {
    this.get = createGetItemAppsyncIntegration(this.table);
    this.batchGet = createBatchGetItemAppsyncIntegration(this.table);
    this.put = createPutItemAppsyncIntegration(this.table);
    this.delete = createDeleteItemAppsyncIntegration(this.table);
    this.update = createUpdateItemAppsyncIntegration(this.table);
    this.query = createQueryAppsyncIntegration(this.table);
    this.scan = createScanAppsyncIntegration(this.table);
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
