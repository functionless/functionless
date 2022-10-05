import { AttributeValue } from "typesafe-dynamodb/lib/attribute-value";
import { BatchGetItemAppsync } from "./batch-get-item";
import { BatchDeleteItemAppsync, BatchPutItemAppsync } from "./batch-write-item";
import { DeleteItemAppsync } from "./delete-item";
import { GetItemAppsync } from "./get-item";
import { PutItemAppsync } from "./put-item";
import { QueryAppsync } from "./query";
import { ScanAppsync } from "./scan";
import { TransactGetItemsAppsync } from "./transact-get-item";
import { TransactWriteItemsAppsync } from "./transact-write-item";
import { UpdateItemAppsync } from "./update-item";
export interface TableAppsyncApi<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined = undefined> {
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
    readonly transactWrite: TransactWriteItemsAppsync<Item, PartitionKey, RangeKey>;
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
//# sourceMappingURL=appsync.d.ts.map