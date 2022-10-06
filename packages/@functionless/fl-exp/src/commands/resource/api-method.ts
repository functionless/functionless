import { registerCommand } from "../../command-provider";
import { MethodKind } from "@functionless/aws-lib";
import { invokeLambda } from "./lambda-function";
import { openConsole } from "./open-console";
import { invokeExpressStepFunction } from "./express-step-function";

registerCommand({
  resourceKind: MethodKind,
  handler(command, resource, detail) {
    command.command("invoke [payload]").action(async (maybePayload) => {
      await invokeResource(resource);

      async function invokeResource(_resource: string) {
        if (detail.ResourceType === "AWS::StepFunctions::StateMachine") {
          await invokeExpressStepFunction(maybePayload, detail);
        } else if (detail.ResourceType === "AWS::Lambda::Function") {
          await invokeLambda(maybePayload, detail);
        } else {
          throw new Error("Not supported");
        }
      }
    });

    command.command("console").action(async (_maybePayload) => {
      await openConsole(detail);
    });
  },
});
