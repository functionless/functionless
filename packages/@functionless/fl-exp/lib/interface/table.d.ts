import type * as functionless from "functionless";
import type { aws_dynamodb } from "aws-cdk-lib";
import { TableAppsyncApi } from "./table/appsync";
import { AttributeType } from "./table/attribute-type";
import { TableAttributesApi, TableDocumentApi } from "./table/runtime";
import DynamoDB from "aws-sdk/clients/dynamodb";
export declare const TableKind = "fl.Table";
export interface TableProps<PartitionKey extends string, RangeKey extends string | undefined = undefined> extends Omit<aws_dynamodb.TableProps, "partitionKey" | "sortKey" | "tableName"> {
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
        type: AttributeType;
    };
    /**
     * Sort key attribute definition.
     *
     * @default no sort key
     */
    readonly sortKey?: RangeKey extends undefined ? undefined : {
        name: Exclude<RangeKey, undefined>;
        type: AttributeType;
    };
}
export interface Table<Item extends object, PartitionKey extends keyof Item, RangeKey extends keyof Item | undefined = undefined> extends TableDocumentApi<Item, PartitionKey, RangeKey> {
    readonly kind: "Table";
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
export declare function isTableDecl(a: any): a is TableDecl;
export interface TableDecl<Item extends object = object, PK extends keyof Item = keyof Item, SK extends keyof Item | undefined = keyof Item | undefined> {
    kind: typeof TableKind;
    props: functionless.TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>;
}
export declare function Table<Item extends object, PK extends keyof Item, SK extends keyof Item | undefined = undefined>(props: functionless.TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>): Table<Item, PK, SK>;
export declare class TableDocumentClient<Item extends object, PK extends keyof Item, SK extends keyof Item | undefined = undefined> {
    readonly props: functionless.TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>;
    readonly resourceId: string;
    readonly roleArn?: string | undefined;
    readonly kind = "fl.Table";
    readonly attributes: TableAttributesClient;
    constructor(props: functionless.TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>, resourceId: string, roleArn?: string | undefined);
    private getEnvironmentKey;
    getTableArn(): string;
    getTableName(): string;
    get(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DocumentClient.GetItemOutput, import("aws-sdk").AWSError>>;
    put(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DocumentClient.PutItemOutput, import("aws-sdk").AWSError>>;
    update(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DocumentClient.UpdateItemOutput, import("aws-sdk").AWSError>>;
    delete(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DocumentClient.DeleteItemOutput, import("aws-sdk").AWSError>>;
    query(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DocumentClient.QueryOutput, import("aws-sdk").AWSError>>;
    scan(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DocumentClient.ScanOutput, import("aws-sdk").AWSError>>;
    batchGet(request: any): Promise<{
        Items: any;
        Responses?: DynamoDB.DocumentClient.BatchGetResponseMap | undefined;
        UnprocessedKeys?: DynamoDB.DocumentClient.BatchGetRequestMap | undefined;
        ConsumedCapacity?: DynamoDB.DocumentClient.ConsumedCapacityMultiple | undefined;
        $response: import("aws-sdk").Response<DynamoDB.DocumentClient.BatchGetItemOutput, import("aws-sdk").AWSError>;
    }>;
    batchWrite(request: any): Promise<{
        UnprocessedItems: any;
        ItemCollectionMetrics?: DynamoDB.DocumentClient.ItemCollectionMetricsPerTable | undefined;
        ConsumedCapacity?: DynamoDB.DocumentClient.ConsumedCapacityMultiple | undefined;
        $response: import("aws-sdk").Response<DynamoDB.DocumentClient.BatchWriteItemOutput, import("aws-sdk").AWSError>;
    }>;
    transactGet({ TransactItems }: any): Promise<any>;
    transactWrite({ TransactItems }: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DocumentClient.TransactWriteItemsOutput, import("aws-sdk").AWSError>>;
}
export declare class TableAttributesClient {
    readonly resourceId: string;
    readonly roleArn?: string | undefined;
    constructor(resourceId: string, roleArn?: string | undefined);
    private getEnvironmentKey;
    getTableArn(): string;
    getTableName(): string;
    get(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.GetItemOutput, import("aws-sdk").AWSError>>;
    put(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.PutItemOutput, import("aws-sdk").AWSError>>;
    update(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.UpdateItemOutput, import("aws-sdk").AWSError>>;
    delete(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.DeleteItemOutput, import("aws-sdk").AWSError>>;
    query(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.QueryOutput, import("aws-sdk").AWSError>>;
    scan(request: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.ScanOutput, import("aws-sdk").AWSError>>;
    batchGet(request: any): Promise<{
        Items: any;
        Responses?: DynamoDB.BatchGetResponseMap | undefined;
        UnprocessedKeys?: DynamoDB.BatchGetRequestMap | undefined;
        ConsumedCapacity?: DynamoDB.ConsumedCapacityMultiple | undefined;
        $response: import("aws-sdk").Response<DynamoDB.BatchGetItemOutput, import("aws-sdk").AWSError>;
    }>;
    batchWrite(request: any): Promise<{
        UnprocessedItems: any;
        ItemCollectionMetrics?: DynamoDB.ItemCollectionMetricsPerTable | undefined;
        ConsumedCapacity?: DynamoDB.ConsumedCapacityMultiple | undefined;
        $response: import("aws-sdk").Response<DynamoDB.BatchWriteItemOutput, import("aws-sdk").AWSError>;
    }>;
    transactGet({ TransactItems }: any): Promise<any>;
    transactWrite({ TransactItems }: any): Promise<import("aws-sdk/lib/request").PromiseResult<DynamoDB.TransactWriteItemsOutput, import("aws-sdk").AWSError>>;
}
//# sourceMappingURL=table.d.ts.map