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
import type { SDK as TSDK, ServiceKeys, SdkCallOptions } from "./types";

/**
 * A proxy to the AWS JavaScript SDK that allows to call any SDK method
 * in a StepFunctions StateMachine or a Lambda Function.
 *
 * The returned proxy does not allow to override any properties
 */
export const SDK: TSDK = new Proxy<any>(AWS, {
  isExtensible() {
    return false;
  },
  setPrototypeOf() {
    return false;
  },
  set() {
    return false;
  },
  get(_, serviceName: ServiceKeys) {
    return new ServiceProxy(serviceName);
  },
});

class ServiceProxy {
  constructor(serviceName: ServiceKeys) {
    return new Proxy(new AWS[serviceName](), {
      isExtensible() {
        return false;
      },
      setPrototypeOf() {
        return false;
      },
      set() {
        return false;
      },
      get: (_, methodName: string) => {
        return makeSdkIntegration(serviceName, methodName);
      },
    });
  }
}

function makeSdkIntegration(serviceName: ServiceKeys, methodName: string) {
  return makeIntegration<
    `$AWS.SDK.${ServiceKeys}`,
    (input: any) => Promise<any>
  >({
    kind: `$AWS.SDK.${serviceName}`,
    native: {
      bind(context, args) {
        const [_, optionsArg] = args;
        const options = validateSdkCallOptions(optionsArg);

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

        const [payloadArg] = args;

        return client[methodName](payloadArg).promise();
      },
    },
    asl: (call, context) => {
      const [payloadArg, optionsArg] = call.args;
      const options = validateSdkCallOptions(optionsArg);

      context.role.addToPrincipalPolicy(
        policyStatementForSdkCall(serviceName, methodName, options)
      );

      const sdkIntegrationServiceName =
        options.aslServiceName ??
        SDK_INTEGRATION_SERVICE_NAME[serviceName] ??
        serviceName.toLowerCase();
      const input = payloadArg?.expr;

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
}

/**
 * This generates the iam.PolicyStatement
 *
 * @param serviceName the name of the AWS Service to call, in Pascal Case (e.g. `CloudWatch`)
 * @param methodName the api method used (e.g. `describeAlarms`)
 * @param options additional options to the sdk call including iam overrides
 * @returns the iam PolicyStatement that grant the caller the requested permissions
 *
 * @example
 * policyStatementForSdkCall("CloudWatch", "describeAlarms", { iam: { resources: ["arn:aws:cloudwatch:us-east-1:123456789012:alarm/test-*"] } }) =>
 * {
 *   "Effect": "Allow",
 *   "Action": "cloudwatch:DescribeAlarms",
 *   "Resource": "arn:aws:cloudwatch:us-east-1:123456789012:alarm/test-*"
 * }
 */
function policyStatementForSdkCall(
  serviceName: ServiceKeys,
  methodName: string,
  options: SdkCallOptions
): aws_iam.PolicyStatement {
  // if not explicitly mapped default to the lowercase service name, which is correct ~60% of the time
  const defaultServicePrefix =
    IAM_SERVICE_PREFIX[serviceName] ?? serviceName.toLowerCase();
  const defaultMethod =
    methodName.charAt(0).toUpperCase() + methodName.slice(1);
  const defaultIamActions = [`${defaultServicePrefix}:${defaultMethod}`];

  return new aws_iam.PolicyStatement({
    effect: aws_iam.Effect.ALLOW,
    actions: options.iam.actions ?? defaultIamActions,
    resources: options.iam.resources,
    conditions: options.iam.conditions,
  });
}

function validateSdkCallOptions(
  arg: Argument | Expr | undefined
): SdkCallOptions {
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

  const iam = inputExpr.getProperty("iam");
  const aslServiceName = inputExpr.getProperty("aslServiceName");

  if (!iam) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam' of a SDK call is required`
    );
  }

  if (!isPropAssignExpr(iam) || !isObjectLiteralExpr(iam.expr)) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam' of a SDK call should be an object literal, found ${iam.kindName}`
    );
  }

  const iamResources = iam.expr.getProperty("resources");
  const iamActions = iam.expr.getProperty("actions");
  const iamConditions = iam.expr.getProperty("conditions");

  if (!iamResources) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam.resources' of a SDK call is required`
    );
  }

  if (
    !isPropAssignExpr(iamResources) ||
    !isArrayLiteralExpr(iamResources.expr)
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam.resources' of a SDK call should be an array literal, found ${iamResources.kindName}`
    );
  }

  if (
    iamActions &&
    (!isPropAssignExpr(iamActions) || !isArrayLiteralExpr(iamActions.expr))
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam.actions' of a SDK call should be an array literal, found ${iamActions.kindName}`
    );
  }

  if (
    aslServiceName &&
    (!isPropAssignExpr(aslServiceName) ||
      !isStringLiteralExpr(aslServiceName.expr))
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'aslServiceName' of a SDK call should be a string literal, found ${aslServiceName.kindName}`
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
      `Option 'iam.conditions' of a SDK call should be an object literal, found ${iamConditions.kindName}`
    );
  }

  return {
    iam: {
      resources: evalToConstant(iamResources.expr)?.constant as any,
      actions: iamActions && (evalToConstant(iamActions.expr)?.constant as any),
      conditions:
        iamConditions && (evalToConstant(iamConditions.expr)?.constant as any),
    },
    aslServiceName:
      aslServiceName && (evalToConstant(aslServiceName.expr)?.constant as any),
  };
}
