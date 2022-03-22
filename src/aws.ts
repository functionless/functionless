import { Table } from "./table";
import { GetItemInput, GetItemOutput } from "typesafe-dynamodb/lib/get-item";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { JsonFormat } from "typesafe-dynamodb";
import { CallExpr, isObjectLiteralExpr, ObjectLiteralExpr } from "./expression";
import { ASL, isASL, Task } from "./asl";
import { CallContext } from "./context";

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

    // @ts-ignore
    export function GetItem(
      call: CallExpr,
      context: CallContext
    ): Partial<Task> {
      assertIsASL(context, "DynamoDB.GetItem");

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
        Resource: "arn:aws:states:::aws-sdk:dynamodb:getItem",
        Parameters: context.toJson(input),
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
