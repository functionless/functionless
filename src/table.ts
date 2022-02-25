import { aws_dynamodb } from "aws-cdk-lib";

import { KeyAttribute } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { Call } from "./expression";
import { VTLContext, toVTL } from "./vtl";

export function isTable(a: any): a is AnyTable {
  return a?.kind === "Table";
}

export type AnyTable = Table<object, keyof object, keyof object | undefined>;

export class Table<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> {
  readonly kind: "Table" = "Table";

  constructor(readonly resource: aws_dynamodb.ITable) {}

  // @ts-ignore
  public getItem<
    Key extends KeyAttribute<Item, PartitionKey, RangeKey>
  >(input: { key: Key; consistentRead?: boolean }): Narrow<Item, Key>;

  public getItem(call: Call, context: VTLContext): any {
    // cast to an Expr - the functionless ts-transform will ensure we are passed an Expr
    const input = call.args.input;
    if (input.kind === "ObjectLiteral") {
      const keyProp = input.properties.find(
        (prop) => prop.kind === "PropertyAssignment" && prop.name === "key"
      );
      if (keyProp) {
        const key = toVTL(keyProp.expr, context);
        return `{
  "operation": "GetItem",
  "version": "2018-05-29,
  "key": ${key}
}` as any;
      }
    }

    return null as any;
  }
}

export interface Table<
  Item extends object,
  PartitionKey extends keyof Item,
  RangeKey extends keyof Item | undefined = undefined
> {
  getItem<Key extends KeyAttribute<Item, PartitionKey, RangeKey>>(input: {
    key: Key;
    consistentRead?: boolean;
  }): Narrow<Item, Key>;
}
