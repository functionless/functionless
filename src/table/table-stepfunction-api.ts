import { JsonFormat } from "typesafe-dynamodb";
import { TableKey } from "typesafe-dynamodb/lib/key";
import {
  BatchGetItemOutput,
  DeleteItemInput,
  DeleteItemOutput,
  GetItemOutput,
  PutItemOutput,
  QueryOutput,
  ReturnValues,
  ScanOutput,
  UpdateItemInput,
  UpdateItemOutput,
} from "./table-api";

export interface ITableStepFunctionApi<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> {
  /**
   * Get Item
   * @param key
   * @param props
   */
  getItem<
    Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>
  >(
    key: Key,
    props?: Omit<AWS.DynamoDB.GetItemInput, "TableName" | "Key">
  ): Promise<GetItemOutput<Item, PartitionKey, RangeKey, Key>>;

  batchGetItems(
    keys: readonly TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.Document
    >[],
    props?: Omit<AWS.DynamoDB.KeysAndAttributes, "Keys">
  ): Promise<BatchGetItemOutput<Item>>;

  putItem<I extends Item>(
    item: I,
    props?: Omit<AWS.DynamoDB.PutItemInput, "TableName" | "Item">
  ): Promise<PutItemOutput<I>>;

  updateItem<
    Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>,
    Return extends ReturnValues | undefined = undefined
  >(
    input: UpdateItemInput<Key, Return>
  ): Promise<UpdateItemOutput<Item, Key, Return>>;

  deleteItem<
    Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.Document>,
    Return extends ReturnValues | undefined = undefined
  >(
    input: DeleteItemInput<Key, Return>
  ): Promise<DeleteItemOutput<Item, Return, Key>>;

  query<I extends Item = Item>(
    input: Omit<AWS.DynamoDB.DocumentClient.QueryInput, "TableName">
  ): Promise<QueryOutput<I>>;

  scan(
    input?: Omit<AWS.DynamoDB.DocumentClient.ScanInput, "TableName">
  ): Promise<ScanOutput<Item>>;
}
