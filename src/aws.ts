import { Table } from "./table";
import {
  UpdateItemInput,
  UpdateItemOutput,
} from "typesafe-dynamodb/lib/update-item";
import { PutItemInput, PutItemOutput } from "typesafe-dynamodb/lib/put-item";
import { ScanInput, ScanOutput } from "typesafe-dynamodb/lib/scan";
import { QueryInput, QueryOutput } from "typesafe-dynamodb/lib/query";
import { GetItemInput, GetItemOutput } from "typesafe-dynamodb/lib/get-item";
import {
  DeleteItemInput,
  DeleteItemOutput,
} from "typesafe-dynamodb/lib/delete-item";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { JsonFormat } from "typesafe-dynamodb";
import { CallExpr, isObjectLiteralExpr, ObjectLiteralExpr } from "./expression";
import { ASL, isASL, Task } from "./asl";
import { CallContext } from "./context";
import { VTL } from "./vtl";

import type { DynamoDB as AWSDynamoDB } from "aws-sdk";

type Item<T extends Table<any, any, any>> = T extends Table<infer I, any, any>
  ? I
  : never;

type PartitionKey<T extends Table<any, any, any>> = T extends Table<
  any,
  infer PK,
  any
>
  ? PK
  : never;

type RangeKey<T extends Table<any, any, any>> = T extends Table<
  any,
  any,
  infer SK
>
  ? SK
  : never;

/**
 * The `AWS` namespace exports functions that map to AWS Step Functions AWS-SDK Integrations.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html
 */
export namespace $AWS {
  export const kind = "AWS";

  export namespace DynamoDB {
    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    // @ts-ignore
    export function DeleteItem<
      T extends Table<any, any, any>,
      Key extends TableKey<
        Item<T>,
        PartitionKey<T>,
        RangeKey<T>,
        JsonFormat.AttributeValue
      >,
      ConditionExpression extends string | undefined,
      ReturnValue extends AWSDynamoDB.ReturnValue = "NONE"
    >(
      input: { TableName: T } & Omit<
        DeleteItemInput<
          Item<T>,
          PartitionKey<T>,
          RangeKey<T>,
          Key,
          ConditionExpression,
          ReturnValue,
          JsonFormat.AttributeValue
        >,
        "TableName"
      >
    ): DeleteItemOutput<Item<T>, ReturnValue, JsonFormat.AttributeValue>;

    // @ts-ignore
    export function DeleteItem(
      call: CallExpr,
      context: CallContext
    ): Partial<Task> {
      return dynamoRequest(call, context, "deleteItem");
    }

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    // @ts-ignore
    export function GetItem<
      T extends Table<any, any, any>,
      Key extends TableKey<
        Item<T>,
        PartitionKey<T>,
        RangeKey<T>,
        JsonFormat.AttributeValue
      >,
      AttributesToGet extends keyof Item<T> | undefined = undefined,
      ProjectionExpression extends string | undefined = undefined
    >(
      input: { TableName: T } & Omit<
        GetItemInput<
          Item<T>,
          PartitionKey<T>,
          RangeKey<T>,
          Key,
          AttributesToGet,
          ProjectionExpression,
          JsonFormat.AttributeValue
        >,
        "TableName"
      >
    ): GetItemOutput<
      Item<T>,
      PartitionKey<T>,
      RangeKey<T>,
      Key,
      AttributesToGet,
      ProjectionExpression,
      JsonFormat.AttributeValue
    >;

    export function GetItem(
      call: CallExpr,
      context: CallContext
    ): Partial<Task> {
      return dynamoRequest(call, context, "getItem");
    }

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    // @ts-ignore
    export function UpdateItem<
      T extends Table<any, any, any>,
      Key extends TableKey<
        Item<T>,
        PartitionKey<T>,
        RangeKey<T>,
        JsonFormat.AttributeValue
      >,
      UpdateExpression extends string,
      ConditionExpression extends string | undefined = undefined,
      ReturnValue extends AWSDynamoDB.ReturnValue = "NONE",
      AttributesToGet extends keyof Item<T> | undefined = undefined,
      ProjectionExpression extends string | undefined = undefined
    >(
      input: { TableName: T } & Omit<
        UpdateItemInput<
          Item<T>,
          PartitionKey<T>,
          RangeKey<T>,
          Key,
          UpdateExpression,
          ConditionExpression,
          ReturnValue,
          JsonFormat.AttributeValue
        >,
        "TableName"
      >
    ): UpdateItemOutput<
      Item<T>,
      PartitionKey<T>,
      RangeKey<T>,
      Key,
      ReturnValue,
      JsonFormat.AttributeValue
    >;

    export function UpdateItem(
      call: CallExpr,
      context: CallContext
    ): Partial<Task> {
      return dynamoRequest(call, context, "updateItem");
    }

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    // @ts-ignore
    export function PutItem<
      T extends Table<any, any, any>,
      I extends Item<T>,
      ConditionExpression extends string | undefined = undefined,
      ReturnValue extends AWSDynamoDB.ReturnValue = "NONE",
      ProjectionExpression extends string | undefined = undefined
    >(
      input: { TableName: T } & Omit<
        PutItemInput<
          Item<T>,
          ConditionExpression,
          ReturnValue,
          JsonFormat.AttributeValue
        >,
        "TableName"
      >
    ): PutItemOutput<I, ReturnValue, JsonFormat.AttributeValue>;

    export function PutItem(
      call: CallExpr,
      context: CallContext
    ): Partial<Task> {
      return dynamoRequest(call, context, "putItem");
    }

    // @ts-ignore
    export function Query<
      T extends Table<any, any, any>,
      KeyConditionExpression extends string,
      FilterExpression extends string | undefined = undefined,
      ProjectionExpression extends string | undefined = undefined,
      AttributesToGet extends keyof Item<T> | undefined = undefined
    >(
      input: { TableName: T } & Omit<
        QueryInput<
          Item<T>,
          KeyConditionExpression,
          FilterExpression,
          ProjectionExpression,
          AttributesToGet,
          JsonFormat.AttributeValue
        >,
        "TableName"
      >
    ): QueryOutput<Item<T>, AttributesToGet, JsonFormat.AttributeValue>;

    // @ts-ignore
    export function Query(call: CallExpr, context: CallContext): Partial<Task> {
      return dynamoRequest(call, context, "query");
    }

    // @ts-ignore
    export function Scan<
      T extends Table<any, any, any>,
      FilterExpression extends string | undefined = undefined,
      ProjectionExpression extends string | undefined = undefined,
      AttributesToGet extends keyof Item<T> | undefined = undefined
    >(
      input: { TableName: T } & Omit<
        ScanInput<
          Item<T>,
          FilterExpression,
          ProjectionExpression,
          AttributesToGet,
          JsonFormat.AttributeValue
        >,
        "TableName"
      >
    ): ScanOutput<Item<T>, AttributesToGet, JsonFormat.AttributeValue>;

    // @ts-ignore
    export function Scan(call: CallExpr, context: CallContext): Partial<Task> {
      return dynamoRequest(call, context, "scan");
    }

    function dynamoRequest(
      call: CallExpr,
      context: VTL | ASL,
      operationName:
        | "deleteItem"
        | "getItem"
        | "putItem"
        | "updateItem"
        | "scan"
        | "query"
    ): Partial<Task> {
      assertIsASL(context, `DynamoDB.${operationName}`);

      const input = call.args.input;
      if (!isObjectLiteralExpr(input)) {
        throw new Error(
          `input parameter must be an ObjectLiteralExpr, but was ${input?.kind}`
        );
      }
      const tableProp = (call.args.input as ObjectLiteralExpr).getProperty(
        "TableName"
      );

      if (
        tableProp?.kind !== "PropAssignExpr" ||
        tableProp.expr.kind !== "ReferenceExpr"
      ) {
        throw new Error(``);
      }

      const table = tableProp.expr.ref();
      if (table.kind !== "Table") {
        throw new Error(``);
      }
      table.resource.grantReadData(context.role);

      return {
        Type: "Task",
        Resource: `arn:aws:states:::aws-sdk:dynamodb:${operationName}`,
        Parameters: ASL.toJson(input),
      };
    }
  }
}

function assertIsASL(
  context: CallContext,
  apiName: string
): asserts context is ASL {
  if (!isASL(context)) {
    throw new Error(
      `AWS.${apiName} is only available within an '${ASL.ContextName}' context, but was called from within a '${context.kind}' context.`
    );
  }
}
