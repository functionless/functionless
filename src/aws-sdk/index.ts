import { aws_iam } from "aws-cdk-lib";
// eslint-disable-next-line import/no-extraneous-dependencies
import * as AWS from "aws-sdk";
import { ASLGraph } from "../asl";
import { ErrorCodes, SynthError } from "../error-code";
import { Expr, Argument } from "../expression";
import {
  isArgument,
  isObjectLiteralExpr,
  isStringLiteralExpr,
  isArrayLiteralExpr,
  isPropAssignExpr,
} from "../guards";
import { makeIntegration } from "../integration";
import { evalToConstant } from "../util";
import { SDK_INTEGRATION_SERVICE_NAME } from "./asl";
import { IAM_SERVICE_PREFIX } from "./iam";
import type { SDK as TSDK, ServiceKeys, SdkCallInput } from "./types";

export const SDK: TSDK = new Proxy<any>(
  {},
  {
    get(_, serviceName: ServiceKeys) {
      return new Proxy<any>(
        {},
        {
          get: (_, methodName: string) => {
            return makeIntegration<
              `$AWS.SDK.${ServiceKeys}`,
              (input: any) => Promise<any>
            >({
              kind: `$AWS.SDK.${serviceName}`,
              native: {
                bind(context, args) {
                  const [optionsArg] = args;
                  const options = validateSdkCallArgument(optionsArg);

                  context.resource.addToRolePolicy(
                    policyStatementForSdkCall(serviceName, methodName, options)
                  );
                },
                preWarm(preWarmContext) {
                  preWarmContext.getOrInit({
                    key: `$AWS.SDK.${serviceName}`,
                    init: (key, props) =>
                      new AWS[serviceName](props?.clientConfigRetriever?.(key)),
                  });
                },
                call(args, preWarmContext) {
                  const client: any = preWarmContext.getOrInit({
                    key: `$AWS.SDK.${serviceName}`,
                    init: (key, props) =>
                      new AWS[serviceName](props?.clientConfigRetriever?.(key)),
                  });

                  return client[methodName](args[0].params).promise();
                },
              },
              asl: (call, context) => {
                const [optionsArg] = call.args;
                const options = validateSdkCallArgument(optionsArg);

                context.role.addToPrincipalPolicy(
                  policyStatementForSdkCall(serviceName, methodName, options)
                );

                const sdkIntegrationServiceName =
                  options.aslServiceName ??
                  SDK_INTEGRATION_SERVICE_NAME[serviceName] ??
                  serviceName.toLowerCase();
                const input = options.params?.expr;

                if (!input) {
                  throw new SynthError(
                    ErrorCodes.Invalid_Input,
                    "SDK integrations need parameters"
                  );
                }

                // normalized any output to a jsonPath or literal
                return context.evalExprToJsonPathOrLiteral(input, (output) => {
                  if (
                    ASLGraph.isLiteralValue(output) &&
                    typeof output.value !== "object"
                  ) {
                    // could still be not an object at runtime, but at least we validate passing non-object literals.
                    throw new SynthError(
                      ErrorCodes.Invalid_Input,
                      "SDK integrations require a object literal or a reference to an object."
                    );
                  }

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
                });
              },
            });
          },
        }
      );
    },
  }
);

function policyStatementForSdkCall(
  serviceName: ServiceKeys,
  methodName: string,
  options: SdkCallInput<any>
): aws_iam.PolicyStatement {
  // if not explicitly mapped default to the lowercase service name, which is correct ~60% of the time
  const defaultServicePrefix =
    IAM_SERVICE_PREFIX[serviceName] ?? serviceName.toLowerCase();
  const defaultMethod =
    methodName.charAt(0).toUpperCase() + methodName.slice(1);
  const defaultIamActions = [`${defaultServicePrefix}:${defaultMethod}`];

  return new aws_iam.PolicyStatement({
    effect: aws_iam.Effect.ALLOW,
    actions: options.iamActions ?? defaultIamActions,
    resources: options.iamResources,
    conditions: options.iamConditions,
  });
}

function validateSdkCallArgument(
  arg: Argument | Expr | undefined
): SdkCallInput<any> {
  const inputExpr = isArgument(arg) ? arg.expr : arg;

  if (!inputExpr) {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      "Argument ('input') into a SDK call is required"
    );
  }

  if (!isObjectLiteralExpr(inputExpr)) {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      `Argument ('input') into a SDK call should be an object, found ${inputExpr.kindName}`
    );
  }

  const params = inputExpr.getProperty("params");
  const iamResources = inputExpr.getProperty("iamResources");
  const iamActions = inputExpr.getProperty("iamActions");
  const iamConditions = inputExpr.getProperty("iamConditions");
  const aslServiceName = inputExpr.getProperty("aslServiceName");

  if (!iamResources) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iamResources' of a SDK call is required`
    );
  }

  if (
    !isPropAssignExpr(iamResources) ||
    !isArrayLiteralExpr(iamResources.expr)
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iamResources' of a SDK call should be an array, found ${iamResources.kindName}`
    );
  }

  if (
    iamActions &&
    (!isPropAssignExpr(iamActions) || !isArrayLiteralExpr(iamActions.expr))
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iamActions' of a SDK call should be an array, found ${iamActions.kindName}`
    );
  }

  if (
    aslServiceName &&
    (!isPropAssignExpr(aslServiceName) ||
      !isStringLiteralExpr(aslServiceName.expr))
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iamActions' of a SDK call should be an array, found ${aslServiceName.kindName}`
    );
  }

  if (
    iamConditions &&
    (!isPropAssignExpr(iamConditions) ||
      // TODO: I don't think this is correct as the iamConditions most likely can be a variable as well, maybe a evalConstant here?
      !isObjectLiteralExpr(iamConditions.expr))
  ) {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      `Option 'iamConditions' of a SDK call should be an object, found ${iamConditions.kindName}`
    );
  }

  return {
    params,
    iamResources: evalToConstant(iamResources.expr)?.constant as any,
    iamActions:
      iamActions && (evalToConstant(iamActions.expr)?.constant as any),
    iamConditions:
      iamConditions && (evalToConstant(iamConditions.expr)?.constant as any),
    aslServiceName:
      aslServiceName && (evalToConstant(aslServiceName.expr)?.constant as any),
  };
}
