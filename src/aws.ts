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
import {
  CallExpr,
  isObjectLiteralExpr,
  isVariableReference,
  ObjectLiteralExpr,
} from "./expression";
import { ASL, isASL, Task } from "./asl";
import { CallContext } from "./context";
import { VTL } from "./vtl";
import { Function, isFunction } from "./function";
import { isTable } from "./table";

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

export function isAWS(a: any): a is typeof $AWS {
  return a?.kind === "AWS";
}

/**
 * The `AWS` namespace exports functions that map to AWS Step Functions AWS-SDK Integrations.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html
 */
export namespace $AWS {
  export const kind = "AWS";

  /**
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
   */
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

      const input = call.getArgument("input")?.expr;
      if (!isObjectLiteralExpr(input)) {
        throw new Error(
          `input parameter must be an ObjectLiteralExpr, but was ${input?.kind}`
        );
      }
      const tableProp = (input as ObjectLiteralExpr).getProperty("TableName");

      if (
        tableProp?.kind !== "PropAssignExpr" ||
        tableProp.expr.kind !== "ReferenceExpr"
      ) {
        throw new Error(``);
      }

      const table = tableProp.expr.ref();
      if (!isTable(table)) {
        throw new Error(``);
      }
      if (
        operationName === "deleteItem" ||
        operationName === "putItem" ||
        operationName === "updateItem"
      ) {
        table.resource.grantWriteData(context.role);
      } else {
        table.resource.grantReadData(context.role);
      }

      return {
        Type: "Task",
        Resource: `arn:aws:states:::aws-sdk:dynamodb:${operationName}`,
        Parameters: ASL.toJson(input),
      };
    }
  }

  export namespace Lambda {
    /**
     * @param input
     * @see https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html
     */
    // @ts-ignore
    export function Invoke<Input, Output>(input: {
      FunctionName: Function<Input, Output>;
      Payload: Input;
      ClientContext?: string;
      InvocationType?: "Event" | "RequestResponse" | "DryRun";
      LogType?: "None" | "Tail";
      Qualifier?: string;
    }): Omit<AWS.Lambda.InvocationResponse, "payload"> & {
      Payload: Output;
    };

    export function Invoke(call: CallExpr, context: CallContext): any {
      const input = call.args[0].expr;
      if (input === undefined) {
        throw new Error(`missing argument 'input'`);
      } else if (input.kind !== "ObjectLiteralExpr") {
        throw new Error(`argument 'input' must be an ObjectLiteralExpr`);
      }
      const functionName = input.getProperty("FunctionName")?.expr;
      if (functionName === undefined) {
        throw new Error(`missing required property 'FunctionName'`);
      } else if (functionName.kind !== "ReferenceExpr") {
        throw new Error(
          `property 'FunctionName' must reference a functionless.Function`
        );
      }
      const functionRef = functionName.ref();
      if (!isFunction(functionRef)) {
        throw new Error(
          `property 'FunctionName' must reference a functionless.Function`
        );
      }
      const payload = input.getProperty("Payload")?.expr;
      if (payload === undefined) {
        throw new Error(`missing property 'payload'`);
      }

      if (isASL(context)) {
        const task: Partial<Task> = {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: functionRef.resource.functionName,
            [`Payload${payload && isVariableReference(payload) ? ".$" : ""}`]:
              payload ? ASL.toJson(payload) : null,
          },
        };
        return task;
      }
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
