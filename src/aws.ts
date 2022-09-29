import type {
  EventBridge as AWSEventBridge,
  Lambda as AWSLambda,
} from "aws-sdk";
import { ASLGraph } from "./asl";
import { SDK as _SDK } from "./aws-sdk";
import { ErrorCodes, SynthError } from "./error-code";
import { Function, isFunction } from "./function";
import { NativePreWarmContext, PrewarmClients } from "./function-prewarm";
import {
  isObjectLiteralExpr,
  isPropAssignExpr,
  isReferenceExpr,
} from "./guards";
import { makeIntegration } from "./integration";

/**
 * The `AWS` namespace exports functions that map to AWS Step Functions AWS-SDK Integrations.
 *
 * @see https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html
 */

export namespace $AWS {
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

        functionRef.resource.grantInvoke(context.role);

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
        request: AWSEventBridge.Types.PutEventsRequest
      ) => Promise<AWSEventBridge.Types.PutEventsResponse>
    >({
      kind: "$AWS.EventBridge.putEvent",
      native: {
        // Access needs to be granted manually
        bind: () => {},
        preWarm: (prewarmContext: NativePreWarmContext) => {
          prewarmContext.getOrInit(PrewarmClients.EventBridge);
        },
        call: async ([request], preWarmContext) => {
          const eventBridge = preWarmContext.getOrInit<AWSEventBridge>(
            PrewarmClients.EventBridge
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

  export const SDK = _SDK;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
