import { aws_dynamodb } from "aws-cdk-lib";
import { ToAttributeMap } from "typesafe-dynamodb/lib/attribute-value";
import {
  ExpressionAttributeNames,
  ExpressionAttributeValues,
} from "typesafe-dynamodb/lib/expression-attributes";

import { KeyAttribute } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { CallExpr } from "./expression";
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

  public getItem(call: CallExpr, vtl: VTL): any {
    // cast to an Expr - the functionless ts-transform will ensure we are passed an Expr
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "GetItem", "version": "2018-05-20"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    vtl.add(
      `#if(${input}.containsKey('consistentRead'))
$util.qr(${request}.put('consistentRead', ${input}.get('consistentRead')))
#end`
    );
    return vtl.json(request);
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

  public putItem(call: CallExpr, vtl: VTL): any {
    // cast to an Expr - the functionless ts-transform will ensure we are passed an Expr
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "PutItem", "version": "2018-05-20"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    vtl.qr(
      `${request}.put('attributeValues', ${input}.get('attributeValues'))`
    );
    vtl.add(
      `#if(${input}.containsKey('condition'))
$util.qr(${request}.put('condition', ${input}.get('condition')))
#end`
    );
    vtl.add(
      `#if(${input}.containsKey('_version'))
$util.qr(${request}.put('_version', ${input}.get('_version')))
#end`
    );
    return vtl.json(request);
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
