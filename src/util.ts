import {
  ToAttributeMap,
  ToAttributeValue,
} from "typesafe-dynamodb/lib/attribute-value";

export interface dynamodb {
  toDynamoDB<T>(value: T): ToAttributeValue<T>;
  toMapValues<T extends object>(value: T): ToAttributeMap<T>;
}

export interface $util {
  readonly dynamodb: dynamodb;
}

export declare const $util: $util;
