/* eslint-disable @typescript-eslint/no-require-imports */
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import {
  AnyFunction,
  CallExpr,
  Expr,
  isIdentifier,
  isObjectLiteralExpr,
  isPropAssignExpr,
  isStringLiteralExpr,
} from "@functionless/ast";
import { ApiGatewayVtlIntegration } from "@functionless/aws-apigateway";
import { aws_apigateway, aws_dynamodb, aws_iam } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { AppSyncVtlIntegration } from "@functionless/aws-appsync";
import { ASL, ASLGraph, Task } from "@functionless/asl";
import { ErrorCodes, SynthError } from "@functionless/error-code";
import {
  NativeIntegration,
  NativeRuntimeInitializer,
} from "@functionless/aws-lambda";
import { VTL } from "@functionless/vtl";
import { ITable } from "./table";
import { DocumentDBClient, DynamoDBClient } from "@functionless/aws-dynamodb";

export type DynamoDBAccess = "read" | "write" | "read-write" | "full";

export function createDynamoIntegration<
  F extends AnyFunction,
  Format extends JsonFormat
>(
  table: aws_dynamodb.ITable,
  operationName: keyof AWS.DynamoDB,
  format: JsonFormat,
  access: DynamoDBAccess,
  body: (
    client: Format extends JsonFormat.Document
      ? AWS.DynamoDB.DocumentClient
      : AWS.DynamoDB,
    params: Parameters<F>
  ) => ReturnType<F>,
  asl?:
    | {
        prepareParams?: (params: any) => any;
        resultSelector?: Task["ResultSelector"];
        override?: never;
      }
    | {
        prepareParams?: never;
        resultSelector?: never;
        override: (input: Expr, context: ASL) => ASLGraph.NodeResults;
      }
): F {
  return {
    kind: operationName,
    native: <NativeIntegration<F>>{
      bind: (func) => grantPermissions(func),
      preWarm: (context) => {
        context.getOrInit(
          (format === JsonFormat.Document
            ? DocumentDBClient
            : DynamoDBClient) as NativeRuntimeInitializer<
            any,
            AWS.DynamoDB | AWS.DynamoDB.DocumentClient
          >
        );
      },
      call: (params, context) =>
        body(
          context.getOrInit<
            Format extends JsonFormat.Document
              ? AWS.DynamoDB.DocumentClient
              : AWS.DynamoDB
          >(
            (format === JsonFormat.Document
              ? DocumentDBClient
              : DynamoDBClient) as any
          ),
          params
        ),
    },
    asl(call: CallExpr, context: ASL): ASLGraph.NodeResults {
      if (format === JsonFormat.Document) {
        throw new SynthError(
          ErrorCodes.Unsupported_Feature,
          `cannot use 'document' behavior of DynamoDB in AWS Step Functions`
        );
      }
      grantPermissions(context.role);

      const input = call.args[0]?.expr;
      if (input === undefined) {
        return context.stateWithHeapOutput({
          Type: "Task",
          Resource: `arn:aws:states:::aws-sdk:dynamodb:${operationName}`,
          Parameters: {
            TableName: table.tableName,
          },
          Next: ASLGraph.DeferNext,
        });
      } else if (asl?.override) {
        return asl.override(input, context);
      } else {
        return context.evalExpr(input, (output) => {
          if (
            !ASLGraph.isLiteralValue(output) ||
            typeof output.value !== "object" ||
            output.value === null ||
            Array.isArray(output.value)
          ) {
            throw new Error("TODO");
          }

          return context.stateWithHeapOutput({
            Type: "Task",
            Resource: `arn:aws:states:::aws-sdk:dynamodb:${operationName}`,
            Parameters: asl?.prepareParams?.(output.value) ?? {
              ...output.value,
              TableName: table.tableName,
            },
            ResultSelector: asl?.resultSelector,
            Next: ASLGraph.DeferNext,
          });
        });
      }
    },
    apiGWVtl: <ApiGatewayVtlIntegration>{
      createIntegration: (options) => {
        return new aws_apigateway.AwsIntegration({
          service: "dynamodb",
          action: operationName,
          integrationHttpMethod: "POST",
          options: {
            ...options,
            passthroughBehavior: aws_apigateway.PassthroughBehavior.NEVER,
          },
        });
      },
      renderRequest(call, context) {
        const input = call.args[0]?.expr;
        if (format === JsonFormat.Document) {
          throw new SynthError(
            ErrorCodes.Unsupported_Feature,
            `cannot use 'document' behavior of DynamoDB in AWS Step Functions`
          );
        } else if (!isObjectLiteralExpr(input)) {
          throw new SynthError(
            ErrorCodes.Expected_an_object_literal,
            `input to $AWS.DynamoDB.${operationName} must be an object literal`
          );
        }
        grantPermissions(context.role);

        return `{
  "TableName":"${table.tableName}",
  ${input.properties
    .flatMap((prop) => {
      if (isPropAssignExpr(prop)) {
        const name = isIdentifier(prop.name)
          ? prop.name.name
          : isStringLiteralExpr(prop.name)
          ? prop.name.value
          : undefined;

        if (name === undefined) {
          throw new SynthError(
            ErrorCodes.API_Gateway_does_not_support_computed_property_names
          );
        }
        if (name === "Table") {
          return [];
        }
        return [`"${name}":${context.exprToJson(prop.expr)}`];
      } else {
        throw new SynthError(
          ErrorCodes.API_Gateway_does_not_support_spread_assignment_expressions
        );
      }
    })
    .join(",\n  ")}
}`;
      },
    },
  } as any as F;

  function grantPermissions(principal: aws_iam.IGrantable) {
    if (access === "read") {
      table.grantReadData(principal);
    } else if (access === "write") {
      table.grantWriteData(principal);
    } else if (access === "read-write") {
      table.grantReadData(principal);
      table.grantWriteData(principal);
    } else if (access === "full") {
      table.grantFullAccess(principal);
    }
  }
}

export function makeAppSyncTableIntegration<F extends AnyFunction>(
  table: ITable<any, any, any>,
  methodName: string,
  integration: {
    appSyncVtl: Omit<AppSyncVtlIntegration, "dataSource" | "dataSourceId">;
  }
): F {
  return {
    ...integration,
    kind: `Table.AppSync.${methodName}`,
    appSyncVtl: <AppSyncVtlIntegration>{
      dataSourceId: () => table.resource.node.addr,
      dataSource: (api, dataSourceId) => {
        return new appsync.DynamoDbDataSource(api, dataSourceId, {
          api,
          table: table.resource,
        });
      },
      ...integration.appSyncVtl,
    },
  } as any as F;
}

export function addIfDefined(vtl: VTL, from: string, to: string, key: string) {
  vtl.add(
    `#if(${from}.containsKey('${key}'))`,
    `$util.qr(${to}.put('${key}', ${from}.get('${key}')))`,
    "#end"
  );
}
