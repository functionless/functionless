import { aws_dynamodb } from "aws-cdk-lib";
import {
  NativeBinaryAttribute,
  ToAttributeMap,
} from "typesafe-dynamodb/lib/attribute-value";
import {
  ExpressionAttributeNames,
  ExpressionAttributeValues,
} from "typesafe-dynamodb/lib/expression-attributes";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { Narrow } from "typesafe-dynamodb/lib/narrow";
import { CallExpr } from "./expression";
import { VTL } from "./vtl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";
import { JsonFormat } from "typesafe-dynamodb";

export function isTable(a: any): a is AnyTable {
  return a?.kind === "Table";
}

export type AnyTable = Table<object, keyof object, keyof object | undefined>;

/**
 * Wraps an {@link aws_dynamodb.Table} with a type-safe interface that can be
 * called from within an {@link AppsyncResolver}.
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
 * const getPerson = new AppsyncResolver<
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
  readonly kind = "Table";

  constructor(readonly resource: aws_dynamodb.ITable) {}

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-getitem
   */
  // @ts-ignore
  public getItem<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >
  >(input: {
    key: Key;
    consistentRead?: boolean;
  }): Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>;

  public getItem(call: CallExpr, vtl: VTL): any {
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "GetItem", "version": "2018-05-29"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    addIfDefined(vtl, input, request, "consistentRead");

    return vtl.json(request);
  }

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-putitem
   */
  // @ts-ignore
  public putItem<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >,
    ConditionExpression extends string | undefined = undefined
  >(input: {
    key: Key;
    attributeValues: ToAttributeMap<
      Omit<
        Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>,
        Exclude<PartitionKey | RangeKey, undefined>
      >
    >;
    condition?: DynamoExpression<ConditionExpression>;
    _version?: number;
  }): Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>;

  public putItem(call: CallExpr, vtl: VTL): any {
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "PutItem", "version": "2018-05-29"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    vtl.qr(
      `${request}.put('attributeValues', ${input}.get('attributeValues'))`
    );
    addIfDefined(vtl, input, request, "condition");
    addIfDefined(vtl, input, request, "_version");

    return vtl.json(request);
  }

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-updateitem
   */
  // @ts-ignore
  public updateItem<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >,
    UpdateExpression extends string,
    ConditionExpression extends string | undefined
  >(input: {
    key: Key;
    update: DynamoExpression<UpdateExpression>;
    condition?: DynamoExpression<ConditionExpression>;
    _version?: number;
  }): Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>;

  public updateItem(call: CallExpr, vtl: VTL): any {
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "UpdateItem", "version": "2018-05-29"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    vtl.qr(`${request}.put('update', ${input}.get('update'))`);
    addIfDefined(vtl, input, request, "condition");
    addIfDefined(vtl, input, request, "_version");

    return vtl.json(request);
  }

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-deleteitem
   */
  // @ts-ignore
  public deleteItem<
    Key extends TableKey<
      Item,
      PartitionKey,
      RangeKey,
      JsonFormat.AttributeValue
    >,
    ConditionExpression extends string | undefined
  >(input: {
    key: Key;
    condition?: DynamoExpression<ConditionExpression>;
    _version?: number;
  }): Narrow<Item, AttributeKeyToObject<Key>, JsonFormat.Document>;

  public deleteItem(call: CallExpr, vtl: VTL): any {
    const input = vtl.eval(call.args.input);
    const request = vtl.var(
      `{"operation": "DeleteItem", "version": "2018-05-29"}`
    );
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    addIfDefined(vtl, input, request, "condition");
    addIfDefined(vtl, input, request, "_version");

    return vtl.json(request);
  }

  /**
   * @see https://docs.aws.amazon.com/appsync/latest/devguide/resolver-mapping-template-reference-dynamodb.html#aws-appsync-resolver-mapping-template-reference-dynamodb-query
   */
  // @ts-ignore
  public query<Query extends string, Filter extends string | undefined>(input: {
    query: DynamoExpression<Query>;
    filter?: DynamoExpression<Filter>;
    index?: string;
    nextToken?: string;
    limit?: number;
    scanIndexForward?: boolean;
    consistentRead?: boolean;
    select?: "ALL_ATTRIBUTES" | "ALL_PROJECTED_ATTRIBUTES";
  }): {
    items: Item[];
    nextToken: string;
    scannedCount: number;
  };

  public query(call: CallExpr, vtl: VTL): any {
    const input = vtl.eval(call.args.input);
    const request = vtl.var(`{"operation": "Query", "version": "2018-05-29"}`);
    vtl.qr(`${request}.put('key', ${input}.get('key'))`);
    vtl.qr(`${request}.put('query', ${input}.get('query'))`);
    addIfDefined(vtl, input, request, "index");
    addIfDefined(vtl, input, request, "nextToken");
    addIfDefined(vtl, input, request, "limit");
    addIfDefined(vtl, input, request, "scanIndexForward");
    addIfDefined(vtl, input, request, "consistentRead");
    addIfDefined(vtl, input, request, "select");

    return vtl.json(request);
  }
}

type AttributeKeyToObject<T> = {
  [k in keyof T]: T[k] extends { S: infer S }
    ? S
    : T[k] extends { N: `${infer N}` }
    ? N
    : T[k] extends { B: any }
    ? NativeBinaryAttribute
    : never;
};

function addIfDefined(vtl: VTL, from: string, to: string, key: string) {
  vtl.add(
    `#if(${from}.containsKey('${key}'))`,
    `$util.qr(${to}.put('${key}', ${from}.get('${key}')))`,
    `#end`
  );
}

export type DynamoExpression<Expression extends string | undefined> =
  {} & RenameKeys<
    ExpressionAttributeNames<Expression> &
      ExpressionAttributeValues<Expression, JsonFormat.AttributeValue> & {
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
