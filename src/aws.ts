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
  isObjectLiteralExpr,
  isVariableReference,
  ObjectLiteralExpr,
} from "./expression";
import { ASL } from "./asl";
import { Function, isFunction, NativePreWarmContext } from "./function";
import { isTable } from "./table";

import type { DynamoDB as AWSDynamoDB } from "aws-sdk";
import { Integration, makeIntegration } from "./integration";
import { AnyFunction } from "./util";
import { IEventBus } from "./event-bridge/event-bus";

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
    export const DeleteItem =
      makeDynamoIntegration<
        <
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
        ) => DeleteItemOutput<Item<T>, ReturnValue, JsonFormat.AttributeValue>
      >("deleteItem");

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    export const GetItem =
      makeDynamoIntegration<
        <
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
        ) => GetItemOutput<
          Item<T>,
          PartitionKey<T>,
          RangeKey<T>,
          Key,
          AttributesToGet,
          ProjectionExpression,
          JsonFormat.AttributeValue
        >
      >("getItem");

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    export const UpdateItem =
      makeDynamoIntegration<
        <
          T extends Table<any, any, any>,
          Key extends TableKey<
            Item<T>,
            PartitionKey<T>,
            RangeKey<T>,
            JsonFormat.AttributeValue
          >,
          UpdateExpression extends string,
          ConditionExpression extends string | undefined = undefined,
          ReturnValue extends AWSDynamoDB.ReturnValue = "NONE"
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
        ) => UpdateItemOutput<
          Item<T>,
          PartitionKey<T>,
          RangeKey<T>,
          Key,
          ReturnValue,
          JsonFormat.AttributeValue
        >
      >("updateItem");

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    export const PutItem =
      makeDynamoIntegration<
        <
          T extends Table<any, any, any>,
          I extends Item<T>,
          ConditionExpression extends string | undefined = undefined,
          ReturnValue extends AWSDynamoDB.ReturnValue = "NONE"
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
        ) => PutItemOutput<I, ReturnValue, JsonFormat.AttributeValue>
      >("putItem");

    export const Query =
      makeDynamoIntegration<
        <
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
        ) => QueryOutput<Item<T>, AttributesToGet, JsonFormat.AttributeValue>
      >("query");

    export const Scan =
      makeDynamoIntegration<
        <
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
        ) => ScanOutput<Item<T>, AttributesToGet, JsonFormat.AttributeValue>
      >("scan");

    function makeDynamoIntegration<F extends AnyFunction>(
      operationName:
        | "deleteItem"
        | "getItem"
        | "putItem"
        | "updateItem"
        | "scan"
        | "query",
      integration?: Omit<Integration, "name">
    ): F {
      return makeIntegration<F>({
        kind: `$AWS.${operationName}`,
        asl(call, context) {
          const input = call.getArgument("input")?.expr;
          if (!isObjectLiteralExpr(input)) {
            throw new Error(
              `input parameter must be an ObjectLiteralExpr, but was ${input?.kind}`
            );
          }
          const tableProp = (input as ObjectLiteralExpr).getProperty(
            "TableName"
          );

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
        },
        unhandledContext(kind, context) {
          throw new Error(
            `${kind} is only available within an '${ASL.ContextName}' context, but was called from within a '${context}' context.`
          );
        },
        ...integration,
      });
    }
  }

  export namespace Lambda {
    /**
     * @param input
     * @see https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html
     */
    export const Invoke = makeIntegration<
      <Input, Output>(input: {
        FunctionName: Function<Input, Output>;
        Payload: Input;
        ClientContext?: string;
        InvocationType?: "Event" | "RequestResponse" | "DryRun";
        LogType?: "None" | "Tail";
        Qualifier?: string;
      }) => Omit<AWS.Lambda.InvocationResponse, "payload"> & {
        Payload: Output;
      }
    >({
      kind: "Lambda.Invoke",
      asl(call) {
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
        return {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: functionRef.resource.functionName,
            [`Payload${payload && isVariableReference(payload) ? ".$" : ""}`]:
              payload ? ASL.toJson(payload) : null,
          },
        };
      },
      unhandledContext(kind, context) {
        throw new Error(
          `$AWS.${kind} is only available within an '${ASL.ContextName}' context, but was called from within a '${context}' context.`
        );
      },
    });
  }

  type PutEventEntry<B extends IEventBus = IEventBus<any>> = Omit<
    AWS.EventBridge.Types.PutEventsRequestEntry,
    "EventBusName"
  > & {
    EventBusName: B;
  };

  export namespace EventBridge {
    export const putEvents = makeIntegration<
      <B extends IEventBus>(
        request: Omit<AWS.EventBridge.Types.PutEventsRequest, "Entries"> & {
          Entries: PutEventEntry<B>[];
        }
      ) => AWS.EventBridge.Types.PutEventsResponse,
      "EventBridge.putEvent"
    >({
      kind: "EventBridge.putEvent",
      native: {
        // Access needs to be granted manually
        bootstrap: () => {},
        preWarm: (prewarmContext: NativePreWarmContext) => {
          prewarmContext.eventBridge();
        },
        call: async ([request], preWarmContext) => {
          const eventBridge = preWarmContext.eventBridge();
          return await eventBridge
            .putEvents({
              Entries: request.Entries.map((e) => ({
                ...e,
                EventBusName: e.EventBusName.eventBusArn,
              })),
            })
            .promise();
        },
      },
    });
  }
}
