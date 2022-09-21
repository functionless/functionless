/* eslint-disable @typescript-eslint/no-require-imports */
import { aws_apigateway, aws_iam } from "aws-cdk-lib";
import { JsonFormat } from "typesafe-dynamodb/lib/json-format";
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
import { makeIntegration } from "../integration";
import { AnyFunction } from "../util";
import { ITable } from "./table";

export type DynamoDBAccess = "read" | "write" | "read-write" | "full";

export function createDynamoDocumentIntegration<F extends AnyFunction>(
  table: ITable<any, any, any>,
  kind: string,
  access: DynamoDBAccess,
  native: (
    client: AWS.DynamoDB.DocumentClient,
    params: Parameters<F>
  ) => ReturnType<F>
): F {
  return createDynamoIntegration(
    table,
    kind,
    JsonFormat.Document,
    access,
    native as any
  );
}

export function createDynamoAttributesIntegration<F extends AnyFunction>(
  table: ITable<any, any, any>,
  kind: string,
  access: DynamoDBAccess,
  body: (client: AWS.DynamoDB, params: Parameters<F>) => ReturnType<F>
): F {
  return createDynamoIntegration(
    table,
    kind,
    JsonFormat.AttributeValue,
    access,
    body as any
  );
}

export function createDynamoIntegration<
  F extends AnyFunction,
  Format extends JsonFormat
>(
  table: ITable<any, any, any>,
  operationName: string,
  format: JsonFormat,
  access: DynamoDBAccess,
  body: (
    client: Format extends JsonFormat.Document
      ? AWS.DynamoDB.DocumentClient
      : AWS.DynamoDB,
    params: Parameters<F>
  ) => ReturnType<F>
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
  "TableName":"${table.resource.tableName}",
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
      table.resource.grantReadData(principal);
    } else if (access === "write") {
      table.resource.grantWriteData(principal);
    } else if (access === "read-write") {
      table.resource.grantReadData(principal);
      table.resource.grantWriteData(principal);
    } else if (access === "full") {
      table.resource.grantFullAccess(principal);
    }
  }
}

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
