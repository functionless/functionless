import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { DynamoDBAppsyncExpression } from "./appsync";
import { AttributeKeyToObject } from "./util";
export interface TransactWriteItemsInput<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Keys extends TableKey<Item, PartitionKey, RangeKey, Format>, Format extends JsonFormat = JsonFormat.Document> extends Omit<AWS.DynamoDB.TransactWriteItemsInput, "TransactItems"> {
    TransactItems: TransactWriteItem<Item, PartitionKey, RangeKey, Keys, Format>[];
}
export interface TransactWriteItem<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, Format>, Format extends JsonFormat> {
    ConditionCheck?: ConditionCheck<Item, PartitionKey, RangeKey, Key, Format>;
    Delete?: Delete<Item, PartitionKey, RangeKey, Key, Format>;
    Put?: Put<Item, Format>;
    Update?: Update<Item, PartitionKey, RangeKey, Key, Format>;
}
export declare type ConditionCheck<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, Format>, Format extends JsonFormat = JsonFormat.Document> = Omit<Format extends JsonFormat.AttributeValue ? AWS.DynamoDB.ConditionCheck : AWS.DynamoDB.DocumentClient.ConditionCheck, "TableName" | "Key"> & {
    Key: Key;
};
export declare type Delete<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, Format>, Format extends JsonFormat = JsonFormat.Document> = Omit<Format extends JsonFormat.AttributeValue ? AWS.DynamoDB.Delete : AWS.DynamoDB.DocumentClient.Delete, "TableName" | "Key"> & {
    Key: Key;
};
/**
 * Initiates a `PutItem` operation to write a new item. This structure
 * specifies the primary key of the item to be written, an optional condition expression
 * that must be satisfied for the write to succeed, a list of the item's attributes, and
 * a field indicating whether to retrieve the item's attributes if the condition is not met.
 */
export declare type Put<Item extends object, Format extends JsonFormat = JsonFormat.Document> = Omit<Format extends JsonFormat.AttributeValue ? AWS.DynamoDB.Put : AWS.DynamoDB.DocumentClient.Put, "TableName" | "Item"> & {
    Item: FormatObject<Item, Format>;
};
export declare type Update<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, Format>, Format extends JsonFormat = JsonFormat.Document> = Omit<Format extends JsonFormat.AttributeValue ? AWS.DynamoDB.Update : AWS.DynamoDB.DocumentClient.Update, "TableName" | "Key"> & {
    Key: Key;
};
export interface TransactWriteItemsOutput extends AWS.DynamoDB.TransactWriteItemsOutput {
}
export declare type TransactWriteItems<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Format extends JsonFormat> = <Keys extends TableKey<Item, PartitionKey, RangeKey, Format>>(request: TransactWriteItemsInput<Item, PartitionKey, RangeKey, Keys, Format>) => Promise<TransactWriteItemsOutput>;
export declare type TransactWriteItemAppsync<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>> = TransactPutItemAppsync<Item, PartitionKey, RangeKey, Key> | TransactUpdateItemAppsync<Item, PartitionKey, RangeKey, Key> | TransactDeleteItemAppsync<Item, PartitionKey, RangeKey, Key> | TransactConditionCheckAppsync<Item, PartitionKey, RangeKey, Key>;
export interface TransactPutItemAppsync<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>> {
    operation: "PutItem";
    key: Key;
    attributeValues: FormatObject<Omit<Item, Exclude<PartitionKey | RangeKey, undefined>>, JsonFormat.AttributeValue>;
    condition?: DynamoDBAppsyncExpression;
}
export interface TransactUpdateItemAppsync<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>> {
    operation: "UpdateItem";
    key: Key;
    update: DynamoDBAppsyncExpression;
    condition?: DynamoDBAppsyncExpression;
}
export interface TransactDeleteItemAppsync<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>> {
    operation: "DeleteItem";
    key: Key;
    condition?: DynamoDBAppsyncExpression;
}
export interface TransactConditionCheckAppsync<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined, Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>> {
    operation: "ConditionCheck";
    key: Key;
    condition?: DynamoDBAppsyncExpression;
}
/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export declare type TransactWriteItemsAppsync<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined> = <Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>>(transactItems: TransactWriteItemAppsync<Item, PartitionKey, RangeKey, Key>[]) => Promise<{
    keys: AttributeKeyToObject<Key>[] | null;
    cancellationReasons: {
        type: string;
        message: string;
    }[] | null;
}>;
//# sourceMappingURL=transact-write-item.d.ts.map