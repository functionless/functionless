import { aws_dynamodb } from "aws-cdk-lib";
import { ToAttributeMap } from "typesafe-dynamodb/lib/attribute-value";
import {
  ExpressionAttributeNames,
  ExpressionAttributeValues,
} from "typesafe-dynamodb/lib/expression-attributes";

import { KeyAttribute } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { Call } from "./expression";
import { VTL } from "./vtl";

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

  public getItem(call: Call, vtl: VTL): any {
    // cast to an Expr - the functionless ts-transform will ensure we are passed an Expr
    const input = call.args.input;
    if (input.kind === "ObjectLiteral") {
      const key = input.getProperty("key");
      if (key) {
        return `{
  "operation": "GetItem",
  "version": "2018-05-29",
  "key": ${vtl.json(vtl.eval(key.expr))}
  }` as any;
      }
    }
    throw new Error(`unable to interpret expression: ${input.kind}`);
  }

  // @ts-ignore
  public putItem<
    Key extends KeyAttribute<Item, PartitionKey, RangeKey>,
    ConditionExpression extends string | undefined = undefined
  >(input: {
    key: Key;
    attributeValues: ToAttributeMap<
      Omit<Narrow<Item, Key>, Exclude<PartitionKey | RangeKey, undefined>>
    >;
    condition?: DynamoExpression<ConditionExpression>;
    _version?: number;
  }): Narrow<Item, Key>;

  public putItem(call: Call, vtl: VTL): any {
    // cast to an Expr - the functionless ts-transform will ensure we are passed an Expr
    const input = call.args.input;
    if (input.kind === "ObjectLiteral") {
      const keyProp = input.getProperty("key")!;
      const attributeValues = input.getProperty("attributeValues")!;
      const condition = input.getProperty("condition");
      const _version = input.getProperty("_version");
      if (keyProp) {
        const obj = vtl.var(
          `{"operation": "PutItem", "version": "2018-05-20", "attributeValues": ${vtl.eval(
            attributeValues
          )}}`
        );
        if (_version) {
          vtl.qr(`${obj}.put("_version", ${vtl.eval(_version)})`);
        }
        if (condition) {
          vtl.qr(`${obj}.put("condition", ${vtl.eval(condition)})`);
        }
        return vtl.json(obj);
      }
    }
    throw new Error(`unable to interpret expression: ${input.kind}`);
  }
}

export type DynamoExpression<Expression extends string | undefined> =
  {} & RenameKeys<
    ExpressionAttributeNames<Expression> &
      ExpressionAttributeValues<Expression> & {
        expression?: Expression;
      },
    {
      ExpressionAttributeValues: "expressionValues";
      ExpressionAttributeNames: "expressionNames";
    }
  >;

type RenameKeys<
  T extends object,
  Substitutions extends Record<string, string>
> = {
  [k in keyof T as k extends keyof Substitutions ? Substitutions[k] : k]: T[k];
};
