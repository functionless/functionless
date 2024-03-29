import { StackResourceDetail } from "aws-sdk/clients/cloudformation";
import StepFunctions from "aws-sdk/clients/stepfunctions";
import { registerCommand } from "../../command-provider";
import { getClientProps } from "@functionless/aws-util";
import { StepFunctionKind } from "@functionless/aws-stepfunctions";
import { openConsole } from "./open-console";

registerCommand({
  resourceKind: StepFunctionKind,
  handler(command, _resource, details) {
    command.command("invoke [payload]").action(async (maybePayload) => {
      await invokeStandardStepFunction(maybePayload, details);
    });

    command.command("console").action(async () => {
      await openConsole(details);
    });
  },
});

export async function invokeStandardStepFunction(
  maybePayload: string | undefined,
  detail: StackResourceDetail
) {
  const payload = typeof maybePayload === "string" ? maybePayload : "{}";
  const stateMachineArn = detail.PhysicalResourceId;

  if (!stateMachineArn) {
    throw new Error("Could not determine lambda name");
  }

  const lambda = new StepFunctions(getClientProps());

  const response = await lambda
    .startExecution({
      stateMachineArn: stateMachineArn,
      input: payload,
    })
    .promise();

  console.log(JSON.stringify(response, null, 2));
}
