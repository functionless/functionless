import { aws_iam } from "aws-cdk-lib";
import { ASLGraph } from "../asl";
import { ErrorCodes, SynthError } from "../error-code";
import { Expr, Argument } from "../expression";
import { isArgument } from "../guards";
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
export const SDK: TSDK = new Proxy<any>(
  {},
  {
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
  }
);

class ServiceProxy {
  constructor(serviceName: ServiceKeys) {
    return new Proxy(
      {},
      {
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
      }
    );
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
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            new (require("aws-sdk")[serviceName])(
              props?.clientConfigRetriever?.(key)
            ),
        });
      },
      call(args, preWarmContext) {
        const client: any = preWarmContext.getOrInit({
          key: `$AWS.SDK.${serviceName}`,
          init: (key, props) =>
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            new (require("aws-sdk")[serviceName])(
              props?.clientConfigRetriever?.(key)
            ),
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

  const options = evalToConstant(inputExpr)?.constant as SdkCallOptions;

  if (!options || typeof options !== "object") {
    throw new SynthError(
      ErrorCodes.Expected_an_object_literal,
      `Argument ('options') into a SDK call should be an object literal, found ${inputExpr.kindName}`
    );
  }

  const { iam, aslServiceName } = options;

  if (aslServiceName && !(typeof aslServiceName === "string")) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'aslServiceName' of a SDK call should be a string literal, found ${aslServiceName}`
    );
  }

  if (!iam) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam' of a SDK call is required`
    );
  }

  const { resources, actions, conditions } = iam;

  if (!resources) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam.resources' of a SDK call is required`
    );
  }

  if (
    !Array.isArray(resources) ||
    resources.some((r) => typeof r !== "string")
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam.resources' of a SDK call should be an array of strings, found ${resources}`
    );
  }

  if (
    actions &&
    (!Array.isArray(actions) || actions.some((r) => typeof r !== "string"))
  ) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam.actions' of a SDK call should be an array of strings, found ${actions}`
    );
  }

  if (conditions && !(typeof conditions === "object")) {
    throw new SynthError(
      ErrorCodes.Invalid_Input,
      `Option 'iam.conditions' of a SDK call should be an object, found ${conditions}`
    );
  }

  return options;
}
