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

// @ts-ignore - imported for typedoc
import type { AppsyncFunction } from "./appsync";

export function isTable(a: any): a is AnyTable {
  return a?.kind === "Table";
}

export type AnyTable = Table<object, keyof object, keyof object | undefined>;

/**
 * Wraps an {@link aws_dynamodb.Table} with a type-safe interface that can be
 * called from within an {@link AppsyncFunction}.
 *
 * Its interface, e.g. `getItem`, `putItem`, is in 1:1 correspondence with the
 * AWS Appsync Resolver API https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html
 *
 * For example:
 * ```ts
 * interface Person {
 *   id: string;
 *   name: string;
 *   age: number;
 * }
 *
 * const personTable = new Table<Person, "id">(
 *   new aws_dynamodb.Table(..)
 * );
 *
 * const getPerson = new AppsyncFunction<
 *   (personId: string) => Person | undefined
 * >(($context, personId: string) => {
 *   const person = personTable.get({
 *     key: {
 *       id: $util.toDynamoDB(personId)
 *     }
 *   });
 *
 *   return person;
 * });
 * ```
 *
 * Note the type-signature of `Table<Person, "id">`. This declares a table whose contents
 * are of the shape, `Person`, and that the PartitionKey is the `id` field.
 *
 * You can also specify the RangeKey:
 * ```ts
 * new Table<Person, "id", "age">(..)
 * ```
 * @see https://github.com/sam-goodwin/typesafe-dynamodb - for more information on how to model your DynamoDB table with TypeScript
 */
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
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "GetItem", "version": "2018-05-29"}`
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
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "PutItem", "version": "2018-05-29"}`
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

  // @ts-ignore
  public updateItem<
    Key extends KeyAttribute<Item, PartitionKey, RangeKey>,
    UpdateExpression extends string,
    ConditionExpression extends string | undefined
  >(input: {
    key: Key;
    update: DynamoExpression<UpdateExpression>;
    condition?: DynamoExpression<ConditionExpression>;
    _version?: number;
  }): Narrow<Item, Key>;

  public updateItem(call: CallExpr, vtl: VTL): any {
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "UpdateItem", "version": "2018-05-29"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    vtl.qr(`${request}.put('update', ${input}.get('update'))`);
    vtl.add(
      `#if(${input}.containsKey('condition'))`,
      `$util.qr(${request}.put('condition', ${input}.get('condition')))`,
      `#end`
    );
    vtl.add(
      `#if(${input}.containsKey('_version'))`,
      `$util.qr(${request}.put('_version', ${input}.get('_version')))`,
      `#end`
    );
    return vtl.json(request);
  }

  // @ts-ignore
  public deleteItem<
    Key extends KeyAttribute<Item, PartitionKey, RangeKey>,
    ConditionExpression extends string | undefined
  >(input: {
    key: Key;
    condition?: DynamoExpression<ConditionExpression>;
    _version?: number;
  }): Narrow<Item, Key>;

  public deleteItem(call: CallExpr, vtl: VTL): any {
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "DeleteItem", "version": "2018-05-29"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    vtl.add(
      `#if(${input}.containsKey('condition'))`,
      `$util.qr(${request}.put('condition', ${input}.get('condition')))`,
      `#end`
    );
    vtl.add(
      `#if(${input}.containsKey('_version'))`,
      `$util.qr(${request}.put('_version', ${input}.get('_version')))`,
      `#end`
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
