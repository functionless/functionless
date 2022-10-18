import type { aws_dynamodb } from "aws-cdk-lib";
import DynamoDB from "aws-sdk/clients/dynamodb";
import { TableAppsyncApi } from "./appsync";
import { AttributeType } from "./attribute-type";
import { TableAttributesApi, TableDocumentApi } from "./runtime";
import { Request, PromiseResult } from "aws-sdk/lib/request";
import { AWSError } from "aws-sdk/lib/error";
import { createTargetClient, TargetClientData } from "@functionless/aws-util";
import { DocumentClient } from "aws-sdk/clients/dynamodb";

export const TableKind = "fl.Table";

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
    type: AttributeType;
  };
  /**
   * Sort key attribute definition.
   *
   * @default no sort key
   */
  readonly sortKey?: RangeKey extends undefined
    ? undefined
    : { name: Exclude<RangeKey, undefined>; type: AttributeType };
}

export interface Table<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> extends TableDocumentApi<Item, PartitionKey, RangeKey> {
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

export function isTable(a: any): a is TableDecl {
  return a?.kind === TableKind;
}

export interface TableDecl<
  Item extends object = object,
  PK extends keyof Item = keyof Item,
  SK extends keyof Item | undefined = keyof Item | undefined
> {
  kind: typeof TableKind;
  props: TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>;
}

export function Table<
  Item extends object,
  PK extends keyof Item,
  SK extends keyof Item | undefined = undefined
>(
  props: TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>
): Table<Item, PK, SK>;

export function Table<
  Item extends object,
  PK extends keyof Item,
  SK extends keyof Item | undefined = undefined
>(
  props: TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>
): Table<Item, PK, SK> {
  return new TableDocumentClient(props as any) as unknown as Table<
    Item,
    PK,
    SK
  >;
}

export class TableDocumentClient<
  Item extends object,
  PK extends keyof Item,
  SK extends keyof Item | undefined = undefined
> {
  readonly kind = TableKind;
  readonly attributes: TableAttributesClient;

  //Following properties will be set by transform plugin
  //Document client is a function as we want to assume role each time we invoke,
  //lest it expire
  private declare readonly documentClient: () => Promise<DocumentClient>;
  private declare readonly tableName: string;
  private declare readonly tableArn: string;

  private withTableName(request: any) {
    return { ...request, TableName: this.tableName };
  }

  private async performRequest<F>(
    request: any,
    action: (d: DocumentClient) => (request: any) => Request<F, AWSError>
  ): Promise<PromiseResult<F, AWSError>> {
    const documentClient = await this.documentClient();
    return action(documentClient).bind(documentClient)(request).promise();
  }

  constructor(
    readonly props: TableProps<
      Exclude<PK, number | Symbol>,
      Exclude<SK, number | Symbol>
    >
  ) {
    this.attributes = new TableAttributesClient();
  }

  get(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.get);
  }

  put(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.put);
  }

  update(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.update);
  }

  delete(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.delete);
  }

  query(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.query);
  }

  scan(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.scan);
  }

  wrapInRequestItems(request: any) {
    return { RequestItems: { [this.tableName]: request } };
  }

  async batchGet(request: any) {
    const response = await this.performRequest(
      this.wrapInRequestItems(request),
      (d) => d.batchGet
    );
    return {
      ...response,
      Items: response.Responses?.[this.tableName],
    };
  }

  async batchWrite(request: any) {
    const response = await this.performRequest(
      this.wrapInRequestItems(request),
      (d) => d.batchWrite
    );

    return {
      ...response,
      UnprocessedItems: response.UnprocessedItems?.[this.tableName] as any,
    };
  }

  async transactGet({ TransactItems }: any) {
    const input: any = {
      TransactItems: TransactItems.map(({ Get }: any) => ({
        Get: this.withTableName(Get),
      })),
    };
    const response = await this.performRequest(input, (d) => d.transactGet);

    return {
      Items: response.Responses?.map(({ Item }) => Item),
    } as any;
  }

  async transactWrite({ TransactItems }: any) {
    const input: AWS.DynamoDB.TransactWriteItemsInput = {
      TransactItems: TransactItems.flatMap((item: any) =>
        Object.keys(item).map((key) => ({
          [key]: this.withTableName(item[key as keyof typeof item]),
        }))
      ),
    };
    return this.performRequest(input, (d) => d.transactWrite);
  }
}

export class TableAttributesClient {
  //Will be set by transform plugin
  declare readonly tableName: string;
  private declare dynamoClient: () => Promise<DynamoDB>;

  constructor() {}

  private withTableName(request: any) {
    return { ...request, TableName: this.tableName };
  }

  private async performRequest<F>(
    request: any,
    action: (d: DynamoDB) => (request: any) => Request<F, AWSError>
  ): Promise<PromiseResult<F, AWSError>> {
    const dynamoClient = await this.dynamoClient();
    return action(dynamoClient).bind(dynamoClient)(request).promise();
  }

  get(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.getItem);
  }

  put(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.putItem);
  }

  update(request: any) {
    return this.performRequest(
      this.withTableName(request),
      (d) => d.updateItem
    );
  }

  delete(request: any) {
    return this.performRequest(
      this.withTableName(request),
      (d) => d.deleteItem
    );
  }

  query(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.query);
  }

  scan(request: any) {
    return this.performRequest(this.withTableName(request), (d) => d.scan);
  }

  wrapInRequestItems(request: any) {
    return { RequestItems: { [this.tableName]: request } };
  }

  async batchGet(request: any) {
    const response = await this.performRequest(
      this.wrapInRequestItems(request),
      (d) => d.batchGetItem
    );
    return {
      ...response,
      Items: response.Responses?.[this.tableName] as any,
    };
  }
  async batchWrite(request: any) {
    const response = await this.performRequest(
      this.wrapInRequestItems(request),
      (d) => d.batchWriteItem
    );

    return {
      ...response,
      UnprocessedItems: response.UnprocessedItems?.[this.tableName] as any,
    };
  }

  async transactGet({ TransactItems }: any) {
    const input: any = {
      TransactItems: TransactItems.map(({ Get }: any) => ({
        Get: this.withTableName(Get),
      })),
    };
    const response = await this.performRequest(
      input,
      (d) => d.transactGetItems
    );

    return {
      Items: response.Responses?.map(({ Item }) => Item),
    } as any;
  }

  async transactWrite({ TransactItems }: any) {
    const input: AWS.DynamoDB.TransactWriteItemsInput = {
      TransactItems: TransactItems.flatMap((item: any) =>
        Object.keys(item).map((key) => ({
          [key]: this.withTableName(item[key as keyof typeof item]),
        }))
      ),
    };
    return this.performRequest(input, (d) => d.transactWriteItems);
  }
}

//Called by transform plugin to set up the client
export function _initTable(
  table: TableDocumentClient<any, any, any>,
  {
    targetClientData,
    tableName,
    tableArn,
  }: {
    targetClientData: TargetClientData;
    tableName: string;
    tableArn: string;
  }
) {
  Object.defineProperty(table, "documentClient", {
    value: () => createTargetClient(DocumentClient, targetClientData),
  });

  Object.defineProperty(table, "tableArn", { value: tableArn });
  Object.defineProperty(table, "tableName", { value: tableName });

  Object.defineProperty(table.attributes, "dynamoClient", {
    value: () => createTargetClient(DynamoDB, targetClientData),
  });
  Object.defineProperty(table.attributes, "tableName", { value: tableName });
  return table;
}
