import {
  CallExpr,
  isObjectLiteralExpr,
  isPropAssignExpr,
  isReferenceExpr,
} from "@functionless/ast";
import type {
  EventBridge as AWSEventBridge,
  Lambda as AWSLambda,
} from "aws-sdk";
import { ASL, ASLGraph } from "@functionless/asl-graph";
import { SDK as _SDK } from "./sdk";
import { ErrorCodes, SynthError } from "@functionless/error-code";
import type { Function } from "@functionless/aws-lambda-constructs";
import { NativeIntegration } from "@functionless/aws-lambda";
import { EventBridgeClient } from "@functionless/aws-events";

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
    export const Invoke: <Input, Output>(
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
    > = {
      kind: "$AWS.Lambda.Invoke",
      asl(call: CallExpr, context: ASL): ASLGraph.NodeResults {
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
        const functionRef: Function<any, any> = functionName.expr.ref() as any;
        if ((functionRef as any)?.kind !== "Function") {
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
    } as any;
  }

  export namespace EventBridge {
    /**
     * @see https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_PutEvents.html
     */
    export const putEvents: (
      request: AWSEventBridge.Types.PutEventsRequest
    ) => Promise<AWSEventBridge.Types.PutEventsResponse> = {
      kind: "$AWS.EventBridge.putEvent",
      native: <
        NativeIntegration<
          (
            request: AWSEventBridge.Types.PutEventsRequest
          ) => Promise<AWSEventBridge.Types.PutEventsResponse>
        >
      >{
        // Access needs to be granted manually
        bind: () => {},
        preWarm: (prewarmContext) => {
          prewarmContext.getOrInit(EventBridgeClient);
        },
        call: async ([request], preWarmContext) => {
          const eventBridge =
            preWarmContext.getOrInit<AWSEventBridge>(EventBridgeClient);
          return eventBridge
            .putEvents({
              Entries: request.Entries.map((e) => ({
                ...e,
              })),
            })
            .promise();
        },
      },
    } as any;
  }

  export const SDK = _SDK;
}
