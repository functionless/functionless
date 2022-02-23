import {
  ToAttributeMap,
  ToAttributeValue,
} from "typesafe-dynamodb/lib/attribute-value";
import { Call } from "./expression";

export const dynamodb = {
  toDynamoDB<T>(value: T): ToAttributeValue<T> {
    return new Call("$util.dynamodb.toDynamoDBJson(${value})", {
      value: value as any,
    }) as any;
  },
  toMapValues<T extends object>(value: T): ToAttributeMap<T> {
    return new Call(`$util.dynamodb.toMapValues(${value})`, {
      value: value as any,
    }) as any;
  },
};

export const $util = {
  dynamodb,
};
