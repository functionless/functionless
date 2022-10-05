import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { AttributeKeyToObject } from "./util";
/**
 *
 */
export interface BatchGetItemInput<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Keys extends TableKey<Item, PartitionKey, RangeKey, Format>, Format extends JsonFormat = JsonFormat.Document> {
    Keys: Keys[];
}
export interface BatchGetItemOutput<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Keys extends TableKey<Item, PartitionKey, RangeKey, Format>, Format extends JsonFormat> extends Omit<AWS.DynamoDB.BatchGetItemOutput, "Responses" | "ConsumedCapacity"> {
    Items?: FormatObject<Narrow<Item, Keys, Format>, Format>[];
}
/**
 * The signature of the {@link BatchGetItem} API.
 *
 * @param request the input {@link BatchGetItemInput} request payload
 * @returns a {@link BatchGetItemOutput} response Promise
 * @tparam {@link Item} - the type of data in the DynamoDB Table
 * @tparam {@link PartitionKey} - the name of the Partition Key field
 * @tparam {@link RangeKey} - the name of the Range Key field if specified, otherwise undefined
 * @tparam {@link Format} - the data format of the values ({@link JsonFormat.AttributeValue} or {@link JsonFormat.Document})
 */
export declare type BatchGetItem<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Format extends JsonFormat> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(request: BatchGetItemInput<Item, PartitionKey, RangeKey, Keys, Format>) => Promise<BatchGetItemOutput<Item, PartitionKey, RangeKey, Keys, Format>>;
/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 *
 * @tparam {@link Item} - the type of data in the DynamoDB Table
 * @tparam {@link PartitionKey} - the name of the Partition Key field
 * @tparam {@link RangeKey} - the name of the Range Key field if specified, otherwise undefined
 * @tparam {@link Format} - the data format of the values ({@link JsonFormat.AttributeValue} or {@link JsonFormat.Document})
 */
export declare type BatchGetItemAppsync<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined> = <Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>>(input: {
    keys: Key[];
    consistentRead?: boolean;
}) => Promise<{
    items: Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>[];
    unprocessedKeys: Key[];
}>;
//# sourceMappingURL=batch-get-item.d.ts.map