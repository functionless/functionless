import { aws_iam } from "aws-cdk-lib";
// eslint-disable-next-line import/no-extraneous-dependencies
import * as AWS from "aws-sdk";
import { ASLGraph } from "../asl";
import { ErrorCodes, SynthError } from "../error-code";
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
                  const options = optionsArg
                    ? evalToConstant(optionsArg)?.constant
                    : undefined;
                  validateSdkCallOptions(options);

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
                const options = optionsArg
                  ? evalToConstant(optionsArg)?.constant
                  : undefined;
                validateSdkCallOptions(options);

                context.role.addToPrincipalPolicy(
                  policyStatementForSdkCall(serviceName, methodName, options)
                );

                const sdkIntegrationServiceName =
                  options.aslServiceName ??
                  SDK_INTEGRATION_SERVICE_NAME[serviceName] ??
                  serviceName.toLowerCase();
                const input = options.params;

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

function validateSdkCallOptions(
  value: any
): asserts value is SdkCallInput<any> {
  if (!value) {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      "Argument ('input') into a SDK call is required"
    );
  } else if (typeof value !== "object") {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      "Argument ('input') into a SDK call must be an object"
    );
  }
}
