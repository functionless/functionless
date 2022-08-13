import { aws_apigateway, aws_iam } from "aws-cdk-lib";
import type {
  DynamoDB as AWSDynamoDB,
  EventBridge as AWSEventBridge,
  Lambda as AWSLambda,
  Service as AWSService,
} from "aws-sdk";
// eslint-disable-next-line import/no-extraneous-dependencies
import * as AWS from "aws-sdk";
import { JsonFormat } from "typesafe-dynamodb";
import { TypeSafeDynamoDBv2 } from "typesafe-dynamodb/lib/client-v2";
import {
  DeleteItemInput,
  DeleteItemOutput,
} from "typesafe-dynamodb/lib/delete-item";
import { GetItemInput, GetItemOutput } from "typesafe-dynamodb/lib/get-item";
import { TableKey } from "typesafe-dynamodb/lib/key";
import { PutItemInput, PutItemOutput } from "typesafe-dynamodb/lib/put-item";
import { QueryInput, QueryOutput } from "typesafe-dynamodb/lib/query";
import { ScanInput, ScanOutput } from "typesafe-dynamodb/lib/scan";
import {
  UpdateItemInput,
  UpdateItemOutput,
} from "typesafe-dynamodb/lib/update-item";
import { ASLGraph } from "./asl";
import { ErrorCodes, SynthError } from "./error-code";
import { Argument, Expr } from "./expression";
import { Function, isFunction, NativeIntegration } from "./function";
import { NativePreWarmContext, PrewarmClients } from "./function-prewarm";
import {
  isArgument,
  isIdentifier,
  isObjectLiteralExpr,
  isPropAssignExpr,
  isReferenceExpr,
  isStringLiteralExpr,
} from "./guards";
import {
  IntegrationCall,
  IntegrationInput,
  makeIntegration,
} from "./integration";
import { AnyTable, isTable, ITable } from "./table";
import {
  AnyFunction,
  AnyAsyncFunction,
  OverloadUnion,
  evalToConstant,
} from "./util";

/**
 * The `AWS` namespace exports functions that map to AWS Step Functions AWS-SDK Integrations.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html
 */

export namespace $AWS {
  /**
   * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
   */
  export namespace DynamoDB {
    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    export const DeleteItem = makeDynamoIntegration<
      "deleteItem",
      <
        Item extends object,
        PartitionKey extends keyof Item,
        RangeKey extends keyof Item | undefined,
        Key extends TableKey<
          Item,
          PartitionKey,
          RangeKey,
          JsonFormat.AttributeValue
        >,
        ConditionExpression extends string | undefined,
        ReturnValue extends AWSDynamoDB.ReturnValue = "NONE"
      >(
        input: { Table: ITable<Item, PartitionKey, RangeKey> } & Omit<
          DeleteItemInput<
            Item,
            PartitionKey,
            RangeKey,
            Key,
            ConditionExpression,
            ReturnValue,
            JsonFormat.AttributeValue
          >,
          "TableName"
        >
      ) => Promise<
        DeleteItemOutput<Item, ReturnValue, JsonFormat.AttributeValue>
      >
    >("deleteItem", {
      native: {
        bind: (context, table) => {
          table.resource.grantWriteData(context.resource);
        },
        call: async (args, preWarmContext) => {
          const dynamo = preWarmContext.getOrInit<
            TypeSafeDynamoDBv2<object, keyof object, any>
          >(PrewarmClients.DYNAMO);

          const [input] = args;

          const { Table: table, ...rest } = input;

          return dynamo
            .deleteItem({
              ...rest,
              TableName: input.Table.tableName,
            })
            .promise();
        },
      },
    });

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    export const GetItem = makeDynamoIntegration<
      "getItem",
      <
        Item extends object,
        PartitionKey extends keyof Item,
        RangeKey extends keyof Item | undefined,
        Key extends TableKey<
          Item,
          PartitionKey,
          RangeKey,
          JsonFormat.AttributeValue
        >,
        AttributesToGet extends keyof Item | undefined = undefined,
        ProjectionExpression extends string | undefined = undefined
      >(
        input: { Table: ITable<Item, PartitionKey, RangeKey> } & Omit<
          GetItemInput<
            Item,
            PartitionKey,
            RangeKey,
            Key,
            AttributesToGet,
            ProjectionExpression,
            JsonFormat.AttributeValue
          >,
          "TableName"
        >
      ) => Promise<
        GetItemOutput<
          Item,
          PartitionKey,
          RangeKey,
          Key,
          AttributesToGet,
          ProjectionExpression,
          JsonFormat.AttributeValue
        >
      >
    >("getItem", {
      native: {
        bind: (context: Function<any, any>, table: AnyTable) => {
          table.resource.grantReadData(context.resource);
        },
        call: async (
          args: [
            { Table: AnyTable } & Omit<
              GetItemInput<object, keyof object, any, any, any, any, any>,
              "TableName"
            >
          ],
          preWarmContext: NativePreWarmContext
        ) => {
          const dynamo = preWarmContext.getOrInit<
            TypeSafeDynamoDBv2<object, keyof object, any>
          >(PrewarmClients.DYNAMO);

          const [input] = args;

          const { Table: table, AttributesToGet, ...rest } = input;

          const payload = {
            ...rest,
            AttributesToGet: AttributesToGet as any,
            TableName: table.tableName,
          };

          return dynamo.getItem(payload).promise();
        },
        // Typesafe DynamoDB was causing a "excessive depth error"
      } as any,
    });

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    export const UpdateItem = makeDynamoIntegration<
      "updateItem",
      <
        Item extends object,
        PartitionKey extends keyof Item,
        RangeKey extends keyof Item | undefined,
        Key extends TableKey<
          Item,
          PartitionKey,
          RangeKey,
          JsonFormat.AttributeValue
        >,
        UpdateExpression extends string,
        ConditionExpression extends string | undefined = undefined,
        ReturnValue extends AWSDynamoDB.ReturnValue = "NONE"
      >(
        input: { Table: ITable<Item, PartitionKey, RangeKey> } & Omit<
          UpdateItemInput<
            Item,
            PartitionKey,
            RangeKey,
            Key,
            UpdateExpression,
            ConditionExpression,
            ReturnValue,
            JsonFormat.AttributeValue
          >,
          "TableName"
        >
      ) => Promise<
        UpdateItemOutput<
          Item,
          PartitionKey,
          RangeKey,
          Key,
          ReturnValue,
          JsonFormat.AttributeValue
        >
      >
    >("updateItem", {
      native: {
        bind: (context, table) => {
          table.resource.grantWriteData(context.resource);
        },
        call: async (args, preWarmContext) => {
          const dynamo = preWarmContext.getOrInit<
            TypeSafeDynamoDBv2<object, keyof object, any>
          >(PrewarmClients.DYNAMO);

          const [input] = args;

          const { Table: table, ...rest } = input;

          return dynamo
            .updateItem({
              ...rest,
              TableName: table.tableName,
            })
            .promise();
        },
      },
    });

    /**
     * @see https://docs.aws.amazon.com/step-functions/latest/dg/connect-ddb.html
     */
    export const PutItem = makeDynamoIntegration<
      "putItem",
      <
        Item extends object,
        PartitionKey extends keyof Item,
        RangeKey extends keyof Item | undefined = undefined,
        ConditionExpression extends string | undefined = undefined,
        ReturnValue extends AWSDynamoDB.ReturnValue = "NONE"
      >(
        input: { Table: ITable<Item, PartitionKey, RangeKey> } & Omit<
          PutItemInput<
            Item,
            ConditionExpression,
            ReturnValue,
            JsonFormat.AttributeValue
          >,
          "TableName"
        >
      ) => Promise<PutItemOutput<Item, ReturnValue, JsonFormat.AttributeValue>>
    >("putItem", {
      native: {
        bind: (context, table) => {
          table.resource.grantWriteData(context.resource);
        },
        call: async (args, preWarmContext) => {
          const dynamo = preWarmContext.getOrInit<
            TypeSafeDynamoDBv2<object, keyof object, any>
          >(PrewarmClients.DYNAMO);

          const [input] = args;

          const { Table: table, Item, ...rest } = input;

          return dynamo
            .putItem({
              ...rest,
              Item: Item as any,
              TableName: table.tableName,
            })
            .promise();
        },
      },
    });

    export const Query = makeDynamoIntegration<
      "query",
      <
        Item extends object,
        PartitionKey extends keyof Item,
        KeyConditionExpression extends string,
        RangeKey extends keyof Item | undefined = undefined,
        FilterExpression extends string | undefined = undefined,
        ProjectionExpression extends string | undefined = undefined,
        AttributesToGet extends keyof Item | undefined = undefined
      >(
        input: { Table: ITable<Item, PartitionKey, RangeKey> } & Omit<
          QueryInput<
            Item,
            KeyConditionExpression,
            FilterExpression,
            ProjectionExpression,
            AttributesToGet,
            JsonFormat.AttributeValue
          >,
          "TableName"
        >
      ) => Promise<
        QueryOutput<Item, AttributesToGet, JsonFormat.AttributeValue>
      >
    >("query", {
      native: {
        bind: (context, table) => {
          table.resource.grantReadData(context.resource);
        },
        call: async (args, preWarmContext) => {
          const dynamo = preWarmContext.getOrInit<
            TypeSafeDynamoDBv2<object, keyof object, any>
          >(PrewarmClients.DYNAMO);

          const [input] = args;

          const { Table: table, AttributesToGet, ...rest } = input;

          return dynamo
            .query({
              ...rest,
              AttributesToGet: AttributesToGet as any,
              TableName: table.tableName,
            })
            .promise();
        },
      },
    });

    export const Scan = makeDynamoIntegration<
      "scan",
      <
        Item extends object,
        PartitionKey extends keyof Item,
        RangeKey extends keyof Item | undefined = undefined,
        FilterExpression extends string | undefined = undefined,
        ProjectionExpression extends string | undefined = undefined,
        AttributesToGet extends keyof Item | undefined = undefined
      >(
        input: { Table: ITable<Item, PartitionKey, RangeKey> } & Omit<
          ScanInput<
            Item,
            FilterExpression,
            ProjectionExpression,
            AttributesToGet,
            JsonFormat.AttributeValue
          >,
          "TableName"
        >
      ) => Promise<ScanOutput<Item, AttributesToGet, JsonFormat.AttributeValue>>
    >("scan", {
      native: {
        bind: (context, table) => {
          table.resource.grantReadData(context.resource);
        },
        call: async (args, preWarmContext) => {
          const dynamo = preWarmContext.getOrInit<
            TypeSafeDynamoDBv2<object, keyof object, any>
          >(PrewarmClients.DYNAMO);

          const [input] = args;

          const { Table: table, AttributesToGet, ...rest } = input;

          return dynamo
            .scan({
              ...rest,
              AttributesToGet: AttributesToGet as any,
              TableName: table.tableName,
            })
            .promise();
        },
      },
    });
  }

  export namespace Lambda {
    /**
     * @param input
     * @see https://docs.aws.amazon.com/lambda/latest/dg/API_Invoke.html
     */
    export const Invoke = makeIntegration<
      "$AWS.Lambda.Invoke",
      <Input, Output>(
        input: {
          Function: Function<Input, Output>;
          ClientContext?: string;
          InvocationType?: "Event" | "RequestResponse" | "DryRun";
          LogType?: "None" | "Tail";
          Qualifier?: string;
        } & ([Input] extends [undefined]
          ? { Payload?: Input }
          : { Payload: Input })
      ) => Promise<
        Omit<AWSLambda.InvocationResponse, "payload"> & {
          Payload: Output;
        }
      >
    >({
      kind: "$AWS.Lambda.Invoke",
      asl(call, context) {
        const input = call.args[0]?.expr;
        if (input === undefined) {
          throw new Error("missing argument 'input'");
        } else if (!isObjectLiteralExpr(input)) {
          throw new SynthError(
            ErrorCodes.Expected_an_object_literal,
            "The first argument ('input') into $AWS.Lambda.Invoke must be an object."
          );
        }
        const functionName = input.getProperty("Function");

        if (functionName === undefined) {
          throw new Error("missing required property 'Function'");
        } else if (!isPropAssignExpr(functionName)) {
          throw new SynthError(
            ErrorCodes.StepFunctions_property_names_must_be_constant,
            `the Function property must reference a Function construct`
          );
        } else if (!isReferenceExpr(functionName.expr)) {
          throw new Error(
            "property 'Function' must reference a functionless.Function"
          );
        }
        const functionRef = functionName.expr.ref();
        if (!isFunction(functionRef)) {
          throw new Error(
            "property 'Function' must reference a functionless.Function"
          );
        }
        const payload = input.getProperty("Payload");
        if (payload === undefined) {
          throw new Error("missing property 'payload'");
        } else if (!isPropAssignExpr(payload)) {
          throw new SynthError(
            ErrorCodes.Unsupported_Feature,
            `${payload.kindName} is not supported by Step Functions`
          );
        }

        return context.evalExprToJsonPathOrLiteral(payload.expr, (output) => {
          return context.stateWithHeapOutput({
            Type: "Task",
            Resource: "arn:aws:states:::lambda:invoke",
            Parameters: {
              FunctionName: functionRef.resource.functionName,
              ...ASLGraph.jsonAssignment("Payload", output),
            },
            Next: ASLGraph.DeferNext,
          });
        });
      },
    });
  }

  export namespace EventBridge {
    /**
     * @see https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEvents.html
     */
    export const putEvents = makeIntegration<
      "$AWS.EventBridge.putEvent",
      (
        request: AWS.EventBridge.Types.PutEventsRequest
      ) => Promise<AWS.EventBridge.Types.PutEventsResponse>
    >({
      kind: "$AWS.EventBridge.putEvent",
      native: {
        // Access needs to be granted manually
        bind: () => {},
        preWarm: (prewarmContext: NativePreWarmContext) => {
          prewarmContext.getOrInit(PrewarmClients.EVENT_BRIDGE);
        },
        call: async ([request], preWarmContext) => {
          const eventBridge = preWarmContext.getOrInit<AWSEventBridge>(
            PrewarmClients.EVENT_BRIDGE
          );
          return eventBridge
            .putEvents({
              Entries: request.Entries.map((e) => ({
                ...e,
              })),
            })
            .promise();
        },
      },
    });
  }

  export const SDK: SDK = new Proxy<any>(
    {},
    {
      get(_, serviceName: ServiceKeys) {
        return new Proxy<any>(
          {},
          {
            get: (_, methodName: string) => {
              const defaultServicePrefix = serviceName.toLowerCase();
              const defaultMethod =
                methodName.charAt(0).toUpperCase() + methodName.slice(1);
              const defaultIamActions = [
                `${defaultServicePrefix}:${defaultMethod}`,
              ];

              return makeIntegration<
                `$AWS.SDK.${ServiceKeys}`,
                (input: any) => Promise<any>
              >({
                kind: `$AWS.SDK.${serviceName}`,
                native: {
                  bind(context, args) {
                    const options =
                      args[1] &&
                      (evalToConstant(args[1])?.constant as SdkCallOptions);

                    if (!options) {
                      throw new SynthError(
                        ErrorCodes.Expected_an_object_literal,
                        "Second argument ('options') into a SDK call is required"
                      );
                    } else if (typeof options !== "object") {
                      throw new SynthError(
                        ErrorCodes.Expected_an_object_literal,
                        "Second argument ('options') into a SDK call must be an object"
                      );
                    }

                    context.resource.addToRolePolicy(
                      new aws_iam.PolicyStatement({
                        effect: aws_iam.Effect.ALLOW,
                        actions: options.iamActions ?? defaultIamActions,
                        resources: options.iamResources,
                        conditions: options.iamConditions,
                      })
                    );
                  },
                  preWarm(preWarmContext) {
                    preWarmContext.getOrInit({
                      key: `$AWS.SDK.${serviceName}`,
                      init: (key, props) =>
                        new AWS[serviceName](
                          props?.clientConfigRetriever?.(key)
                        ),
                    });
                  },
                  call(args, preWarmContext) {
                    const client: any = preWarmContext.getOrInit({
                      key: `$AWS.SDK.${serviceName}`,
                      init: (key, props) =>
                        new AWS[serviceName](
                          props?.clientConfigRetriever?.(key)
                        ),
                    });

                    return client[methodName](args[0]).promise();
                  },
                },
                asl: (call, context) => {
                  const options =
                    call.args[1]?.expr &&
                    (evalToConstant(call.args[1]?.expr)
                      ?.constant as SdkCallOptions);

                  if (!options) {
                    throw new SynthError(
                      ErrorCodes.Expected_an_object_literal,
                      "Second argument ('options') into a SDK call is required"
                    );
                  } else if (typeof options !== "object") {
                    throw new SynthError(
                      ErrorCodes.Expected_an_object_literal,
                      "Second argument ('options') into a SDK call must be an object"
                    );
                  }

                  context.role.addToPrincipalPolicy(
                    new aws_iam.PolicyStatement({
                      effect: aws_iam.Effect.ALLOW,
                      actions: options.iamActions ?? defaultIamActions,
                      resources: options.iamResources,
                      conditions: options.iamConditions,
                    })
                  );

                  const sdkIntegrationServiceName =
                    mapAslSdkServiceName(serviceName);
                  const input = call.args[0]?.expr;

                  if (!input) {
                    throw (
                      (new SynthError(ErrorCodes.Invalid_Input),
                      "SDK integrations need a single input")
                    );
                  }

                  // normalized any output to a jsonPath or literal
                  return context.evalExprToJsonPathOrLiteral(
                    input,
                    (output) => {
                      return context.stateWithHeapOutput(
                        // can add LiteralValue or JsonPath as the parameter to a task.
                        ASLGraph.taskWithInput(
                          {
                            Type: "Task",
                            Resource: `arn:aws:states:::aws-sdk:${sdkIntegrationServiceName}:${methodName}`,
                            Next: ASLGraph.DeferNext,
                          },
                          output
                        )
                      );
                    }
                  );
                },
              });
            },
          }
        );
      },
    }
  );
}

type AWSServiceClass = { new (): AWSService };

/**
 * First we have to extract the names of all Services in the v2 AWS namespace
 *
 * @returns "AccessAnalyzer" | "Account" | ... | "XRay"
 */
type ServiceKeys = {
  [K in keyof typeof AWS]: typeof AWS[K] extends AWSServiceClass ? K : never;
}[keyof typeof AWS];

type SDK = {
  [serviceName in ServiceKeys]: typeof AWS[serviceName] extends new (
    ...args: any[]
  ) => infer Client
    ? {
        [methodName in keyof Client]: SdkMethod<Client[methodName]>;
      }
    : never;
};

interface SdkCallOptions {
  /**
   * The resources for the IAM statement that will be added to the state machine
   * role's policy to allow the state machine to make the API call.
   *
   * Use `["*"]` to grant access to all resources (discouraged).
   *
   * @example ["arn:aws:s3:::my_bucket"]
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_resource.html
   */
  iamResources: string[];

  /**
   * The action for the IAM statement that will be added to the state machine role's
   * policy to allow the state machine to make the API call.
   *
   * By default the action is inferred from the API call (e.g. `$AWS.SDK.CloudWatch.describeAlarms({})` results in `cloudwatch:DescribeAlarms`)
   *
   * Use in the case where the IAM action name does not match with the API service/action name
   * e.g. `s3:ListBuckets` requires `s3:ListAllMyBuckets`.
   *
   * @default service:method
   * @example s3:ListAllMyBuckets
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_action.html
   */
  iamActions?: string[];

  /**
   * The iam conditions to apply to the IAM Statement that will be added to the state machine role's
   * policy to allow the state machine to make the API call.
   *
   * By default no conditions are applied.
   *
   * @example
   * ```
   * {
   *   "StringEquals" : { "aws:username" : "johndoe" }
   * }
   * ```
   * @see https://docs.aws.amazon.com/IAM/latest/UserGuide/reference_policies_elements_condition.html
   */
  iamConditions: Record<string, any>;
}

type SdkMethod<API> = API extends AnyFunction
  ? Exclude<OverloadUnion<API>, (cb: AnyFunction) => any> extends (
      input: infer Input extends {}
    ) => AWS.Request<infer Output, any>
    ? (input: Input, options: SdkCallOptions) => Promise<Output>
    : never
  : never;

function mapAslSdkServiceName(serviceName: string): string {
  // source: https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html
  switch (serviceName) {
    case "Discovery":
      return "applicationdiscovery";
    // TODO: should I simply remove any trailing `Service` or leave the explicit mapping
    case "ConfigService":
      return "config";
    case "CUR":
      return "costandusagereport";
    case "DMS":
      return "databasemigration";
    case "DirectoryService":
      return "directory";
    case "MarketplaceEntitlementService":
      return "marketplaceentitlement";
    case "RDSDataService":
      return "rdsdata";
    case "StepFunctions":
      return "sfn";
    case "AugmentedAIRuntime":
      return "sagemakera2iruntime";
    case "ForecastQueryService":
      return "forecastquery";
    case "KinesisVideoSignalingChannels":
      return "kinesisvideosignaling";
    case "LexModelBuildingService":
      return "lexmodelbuilding";
    case "TranscribeService":
      return "transcribe";
    case "ELB":
      return "elasticloadbalancing";
    case "ELBv2":
      return "elasticloadbalancingv2";
    default:
      return serviceName.toLowerCase();
  }
}

export type OperationName =
  | "deleteItem"
  | "getItem"
  | "putItem"
  | "updateItem"
  | "scan"
  | "query";

function makeDynamoIntegration<
  Op extends OperationName,
  F extends AnyAsyncFunction
>(
  operationName: Op,
  integration: Omit<
    IntegrationInput<`$AWS.DynamoDB.${Op}`, F>,
    "kind" | "native"
  > & {
    native: Omit<NativeIntegration<F>, "preWarm" | "bind"> & {
      bind: (context: Function<any, any>, table: AnyTable) => void;
    };
  }
): IntegrationCall<`$AWS.DynamoDB.${Op}`, F> {
  return makeIntegration<`$AWS.DynamoDB.${Op}`, F>({
    ...integration,
    kind: `$AWS.DynamoDB.${operationName}`,
    apiGWVtl: {
      renderRequest(call, context) {
        const input = call.args[0]?.expr;
        if (!isObjectLiteralExpr(input)) {
          throw new SynthError(
            ErrorCodes.Expected_an_object_literal,
            `input to $AWS.DynamoDB.${operationName} must be an object literal`
          );
        }
        const table = getTableArgument(operationName, call.args);

        // const table = getTableArgument(call.args.map((arg) => arg.expr!));
        grantTablePermissions(table, context.role, operationName);
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
    },
    asl(call, context) {
      const input = call.args[0]?.expr;
      if (!isObjectLiteralExpr(input)) {
        throw new SynthError(
          ErrorCodes.Expected_an_object_literal,
          `First argument ('input') into $AWS.DynamoDB.${operationName} must be an object.`
        );
      }

      return context.evalExpr(input, (output) => {
        if (
          !ASLGraph.isLiteralValue(output) ||
          typeof output.value !== "object" ||
          !output.value ||
          !("Table" in output.value) ||
          !isTable(output.value.Table)
        ) {
          throw new SynthError(
            ErrorCodes.Unexpected_Error,
            "Expected `Table` parameter in $AWS.DynamoDB for Step Functions to be a Table object."
          );
        }

        const { Table, ...params } = output.value;

        grantTablePermissions(Table, context.role, operationName);

        return context.stateWithHeapOutput({
          Type: "Task",
          Resource: `arn:aws:states:::aws-sdk:dynamodb:${operationName}`,
          Parameters: {
            ...params,
            TableName: Table.tableName,
          },
          Next: ASLGraph.DeferNext,
        });
      });
    },
    native: {
      ...integration.native,
      bind: (context, args) => {
        const table = getTableArgument(operationName, args);
        integration.native.bind(context, table);
      },
      preWarm(prewarmContext) {
        prewarmContext.getOrInit(PrewarmClients.DYNAMO);
      },
    },
  });
}

/**
 * @internal
 */
function grantTablePermissions(
  table: AnyTable,
  role: aws_iam.IRole,
  operationName: OperationName
) {
  if (
    operationName === "deleteItem" ||
    operationName === "putItem" ||
    operationName === "updateItem"
  ) {
    table.resource.grantWriteData(role);
  } else {
    table.resource.grantReadData(role);
  }
}

/**
 * @internal
 */
function getTableArgument(op: string, args: Argument[] | Expr[]) {
  let inputArgument;
  if (isArgument(args[0])) {
    inputArgument = args[0].expr;
  } else {
    inputArgument = args[0];
  }
  // integ(input: { Table })
  if (!inputArgument || !isObjectLiteralExpr(inputArgument)) {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      `First argument into ${op} should be an input object, found ${inputArgument?.kindName}`
    );
  }

  const tableProp = inputArgument.getProperty("Table");

  if (!tableProp || !isPropAssignExpr(tableProp)) {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      `First argument into ${op} should be an input with a property 'Table' that is a Table.`
    );
  }

  const tableRef = tableProp.expr;

  if (!isReferenceExpr(tableRef)) {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      `First argument into ${op} should be an input with a property 'Table' that is a Table.`
    );
  }

  const table = tableRef.ref();
  if (!isTable(table)) {
    throw Error(`'Table' argument should be a Table object.`);
  }

  return table;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
