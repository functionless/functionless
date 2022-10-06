import { StackResourceDetail } from "aws-sdk/clients/cloudformation";
import StepFunctions from "aws-sdk/clients/stepfunctions";
import { registerCommand } from "../../command-provider";
import { getClientProps } from "@functionless/aws-util";
import { ExpressStepFunctionKind } from "@functionless/aws-lib";
import { openConsole } from "./open-console";

registerCommand({
  resourceKind: ExpressStepFunctionKind,
  handler(command, _resource, detail) {
    command.command("invoke [payload]").action(async (maybePayload) => {
      await invokeExpressStepFunction(maybePayload, detail);
    });

    command.command("console").action(async () => {
      openConsole(detail);
    });
  },
});

export async function invokeExpressStepFunction(
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
    .startSyncExecution({
      stateMachineArn: stateMachineArn,
      input: payload,
    })
    .promise();

  console.log(JSON.stringify(response, null, 2));
}
