import { ToAttributeMap } from "typesafe-dynamodb/lib/attribute-value";
import { FormatObject, JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { DynamoDBAppsyncExpression } from "./appsync";
import { AttributeKeyToObject } from "./util";

export type PutItemReturnValues = "NONE" | "ALL_OLD";

export interface PutItemInput<
  Item extends object,
  ReturnValue extends PutItemReturnValues | undefined,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.PutItemInput, "Item" | "TableName"> {
  Item: FormatObject<Item, Format>;
  ReturnValues?: ReturnValue;
}

export interface PutItemOutput<
  Item extends object,
  ReturnValue extends PutItemReturnValues | undefined,
  Format extends JsonFormat
> extends Omit<AWS.DynamoDB.PutItemOutput, "Attributes"> {
  Attributes?: ReturnValue extends undefined | "NONE"
    ? undefined
    : FormatObject<Item, Format>;
}

export type PutItem<Item extends object, Format extends JsonFormat> = <
  I extends Item,
  ReturnValue extends PutItemReturnValues | undefined
>(
  input: PutItemInput<I, ReturnValue, Format>
) => Promise<PutItemOutput<I, ReturnValue, Format>>;

/**
 * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
 */
export type PutItemAppsync<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined
> = <
  Key extends TableKey<Item, PartitionKey, RangeKey, JsonFormat.AttributeValue>
>(input: {
  key: Key;
  attributeValues: ToAttributeMap<
    Omit<
      Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>,
      Exclude<PartitionKey | RangeKey, undefined>
    >
  >;
  condition?: DynamoDBAppsyncExpression;
  _version?: number;
}) => Promise<Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>>;
