import type { aws_dynamodb } from "aws-cdk-lib";
import type DynamoDB from "aws-sdk/clients/dynamodb";
import { TableAppsyncApi } from "./appsync";
import { AttributeType } from "./attribute-type";
import { TableAttributesApi, TableDocumentApi } from "./runtime";
import { getEnvironmentVariableName } from "@functionless/util";
import { documentClient, dynamoClient } from "./client";

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
  props: TableProps<Exclude<PK, number | Symbol>, Exclude<SK, number | Symbol>>,
  /**
   * Injected by the compiler.
   */
  resourceId?: string,
  /**
   * Injected by the compiler.
   */
  roleArn?: string
): Table<Item, PK, SK> {
  return new TableDocumentClient(props as any, resourceId!, roleArn) as any;
}

export class TableDocumentClient<
  Item extends object,
  PK extends keyof Item,
  SK extends keyof Item | undefined = undefined
> {
  readonly kind = TableKind;
  readonly attributes: TableAttributesClient;

  constructor(
    readonly props: TableProps<
      Exclude<PK, number | Symbol>,
      Exclude<SK, number | Symbol>
    >,
    readonly resourceId: string,
    readonly roleArn?: string
  ) {
    this.attributes = new TableAttributesClient(resourceId, roleArn);
  }

  private getEnvironmentKey() {
    return getEnvironmentVariableName(this.resourceId);
  }

  public getTableArn(): string {
    return process.env[`${this.getEnvironmentKey()}_ARN`]!;
  }

  public getTableName(): string {
    return process.env[`${this.getEnvironmentKey()}_NAME`]!;
  }

  async get(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };
    return await (await documentClient(this.roleArn)).get(input).promise();
  }
  async put(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await documentClient(this.roleArn)).put(input).promise();
  }
  async update(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await documentClient(this.roleArn)).update(input).promise();
  }
  async delete(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await documentClient(this.roleArn)).delete(input).promise();
  }
  async query(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await documentClient(this.roleArn)).query(input).promise();
  }
  async scan(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await documentClient(this.roleArn)).scan(input).promise();
  }
  async batchGet(request: any) {
    const input: any = {
      RequestItems: {
        [this.getTableName()]: request,
      },
    };
    const response = await (await documentClient(this.roleArn))
      .batchGet(input)
      .promise();
    return {
      ...response,
      Items: response.Responses?.[this.getTableName()] as any,
    };
  }
  async batchWrite(request: any) {
    const input: any = {
      RequestItems: {
        [this.getTableName()]: request,
      },
    };
    const response = await (await documentClient(this.roleArn))
      .batchWrite(input)
      .promise();

    return {
      ...response,
      UnprocessedItems: response.UnprocessedItems?.[this.getTableName()] as any,
    };
  }
  async transactGet({ TransactItems }: any) {
    const input: any = {
      TransactItems: TransactItems.map((item: any) => ({
        Get: {
          ...item.Get,
          TableName: this.getTableName(),
        },
      })),
    };
    const response = await (await documentClient(this.roleArn))
      .transactGet(input)
      .promise();

    return {
      Items: response.Responses?.map(({ Item }) => Item),
    } as any;
  }
  async transactWrite({ TransactItems }: any) {
    const input: DynamoDB.TransactWriteItemsInput = {
      TransactItems: TransactItems.flatMap((item: any) =>
        Object.keys(item).map((key) => ({
          [key]: {
            ...item[key as keyof typeof item],
            TableName: this.getTableName(),
          },
        }))
      ),
    };
    return await (await documentClient(this.roleArn))
      .transactWrite(input)
      .promise();
  }
}

export class TableAttributesClient {
  constructor(readonly resourceId: string, readonly roleArn?: string) {}

  private getEnvironmentKey() {
    return getEnvironmentVariableName(this.resourceId);
  }

  public getTableArn(): string {
    return process.env[`${this.getEnvironmentKey()}_ARN`]!;
  }

  public getTableName(): string {
    return process.env[`${this.getEnvironmentKey()}_NAME`]!;
  }

  async get(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };
    return await (await dynamoClient(this.roleArn)).getItem(input).promise();
  }
  async put(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await dynamoClient(this.roleArn)).putItem(input).promise();
  }
  async update(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await dynamoClient(this.roleArn)).updateItem(input).promise();
  }
  async delete(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await dynamoClient(this.roleArn)).deleteItem(input).promise();
  }
  async query(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await dynamoClient(this.roleArn)).query(input).promise();
  }
  async scan(request: any) {
    const input: any = {
      ...request,
      TableName: this.getTableName(),
    };

    return await (await dynamoClient(this.roleArn)).scan(input).promise();
  }
  async batchGet(request: any) {
    const input: any = {
      RequestItems: {
        [this.getTableName()]: request,
      },
    };
    const response = await (await dynamoClient(this.roleArn))
      .batchGetItem(input)
      .promise();
    return {
      ...response,
      Items: response.Responses?.[this.getTableName()] as any,
    };
  }
  async batchWrite(request: any) {
    const input: any = {
      RequestItems: {
        [this.getTableName()]: request,
      },
    };
    const response = await (await dynamoClient(this.roleArn))
      .batchWriteItem(input)
      .promise();

    return {
      ...response,
      UnprocessedItems: response.UnprocessedItems?.[this.getTableName()] as any,
    };
  }
  async transactGet({ TransactItems }: any) {
    const input: any = {
      TransactItems: TransactItems.map((item: any) => ({
        Get: {
          ...item.Get,
          TableName: this.getTableName(),
        },
      })),
    };
    const response = await (await dynamoClient(this.roleArn))
      .transactGetItems(input)
      .promise();

    return {
      Items: response.Responses?.map(({ Item }) => Item),
    } as any;
  }
  async transactWrite({ TransactItems }: any) {
    const input: DynamoDB.TransactWriteItemsInput = {
      TransactItems: TransactItems.flatMap((item: any) =>
        Object.keys(item).map((key) => ({
          [key]: {
            ...item[key as keyof typeof item],
            TableName: this.getTableName(),
          },
        }))
      ),
    };
    return await (await dynamoClient(this.roleArn))
      .transactWriteItems(input)
      .promise();
  }
}
