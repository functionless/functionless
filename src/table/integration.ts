/* eslint-disable @typescript-eslint/no-require-imports */
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { aws_apigateway, aws_dynamodb, aws_iam } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
import { AppSyncVtlIntegration } from "../appsync";
import { ASL, ASLGraph } from "../asl";
import { ErrorCodes, SynthError } from "../error-code";
import { CallExpr } from "../expression";
import { PrewarmClientInitializer } from "../function-prewarm";
import {
  isIdentifier,
  isObjectLiteralExpr,
  isPropAssignExpr,
  isStringLiteralExpr,
} from "../guards";
import { IntegrationInput, makeIntegration } from "../integration";
import { AnyFunction } from "../util";
import { VTL } from "../vtl";
import { ITable } from "./table";

export const DocumentDBClient: PrewarmClientInitializer<
  "DynamoDB",
  AWS.DynamoDB.DocumentClient
> = {
  key: "DynamoDB",
  init: (key, props) =>
    new (require("aws-sdk/clients/dynamodb").DocumentClient)(
      props?.clientConfigRetriever?.(key)
    ),
};

export const DynamoDBClient: PrewarmClientInitializer<
  "DynamoDBDocument",
  AWS.DynamoDB
> = {
  key: "DynamoDBDocument",
  init: (key, props) =>
    new (require("aws-sdk/clients/dynamodb"))(
      props?.clientConfigRetriever?.(key)
    ),
};

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
  asl?: (
    input: ASLGraph.LiteralValue<{
      [key: string]: ASLGraph.LiteralValueType;
    }>,
    context: ASL
  ) => ASLGraph.NodeResults
): F {
  return makeIntegration({
    kind: operationName,
    native: {
      bind: (func) => grantPermissions(func.resource),
      preWarm: (context) => {
        context.getOrInit(
          (format === JsonFormat.Document
            ? DocumentDBClient
            : DynamoDBClient) as PrewarmClientInitializer<
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

          if (asl) {
            return asl(output as any, context);
          }

          return context.stateWithHeapOutput({
            Type: "Task",
            Resource: `arn:aws:states:::aws-sdk:dynamodb:${operationName}`,
            Parameters: {
              ...output.value,
              TableName: table.tableName,
            },
            Next: ASLGraph.DeferNext,
          });
        });
      }
    },
    apiGWVtl: {
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
  });

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
  integration: Omit<IntegrationInput<string, F>, "kind" | "appSyncVtl"> & {
    appSyncVtl: Omit<AppSyncVtlIntegration, "dataSource" | "dataSourceId">;
  }
): F {
  return makeIntegration<`Table.AppSync.${string}`, F>({
    ...integration,
    kind: `Table.AppSync.${methodName}`,
    appSyncVtl: {
      dataSourceId: () => table.resource.node.addr,
      dataSource: (api, dataSourceId) => {
        return new appsync.DynamoDbDataSource(api, dataSourceId, {
          api,
          table: table.resource,
        });
      },
      ...integration.appSyncVtl,
    },
  });
}

export function addIfDefined(vtl: VTL, from: string, to: string, key: string) {
  vtl.add(
    `#if(${from}.containsKey('${key}'))`,
    `$util.qr(${to}.put('${key}', ${from}.get('${key}')))`,
    "#end"
  );
}
