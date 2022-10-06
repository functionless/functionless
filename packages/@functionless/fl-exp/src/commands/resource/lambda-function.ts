import { registerCommand } from "../../command-provider";
import Lambda from "aws-sdk/clients/lambda";
import Logs from "aws-sdk/clients/cloudwatchlogs";
import { LambdaFunctionKind } from "@functionless/aws-lib";
import { promisify } from "util";
import { StackResourceDetail } from "aws-sdk/clients/cloudformation";
import { getClientProps } from "@functionless/aws-util";
import { openConsole } from "./open-console";

export async function invokeLambda(
  maybePayload: string | undefined,
  detail: StackResourceDetail
) {
  const payload = typeof maybePayload === "string" ? maybePayload : "{}";
  const lambdaName = detail.PhysicalResourceId;

  if (!lambdaName) {
    throw new Error("Could not determine lambda name");
  }

  const lambda = new Lambda(getClientProps());

  const { Payload } = await lambda
    .invoke({
      FunctionName: lambdaName,
      Payload: payload,
    })
    .promise();

  console.log(JSON.stringify(JSON.parse(Payload?.toString() ?? ""), null, 2));
}

registerCommand({
  resourceKind: LambdaFunctionKind,
  handler: async (command, _resourceKind, detail) => {
    command.command("invoke [payload]").action(async (maybePayload) => {
      await invokeLambda(maybePayload, detail);
    });

    command.command("logs").action(async () => {
      const lambdaName = detail.PhysicalResourceId;

      const logsClient = new Logs();
      let lastEventTime: undefined | number = new Date().getTime();
      console.log("Starting logs...");
      while (true) {
        const logs = await logsClient
          .filterLogEvents({
            logGroupName: `/aws/lambda/${lambdaName}`,
            startTime: lastEventTime ? lastEventTime + 1 : undefined,
          })
          .promise();
        logs.events?.forEach((event) => {
          process.stdout.write(`[${event.timestamp}] -- ${event.message}`);
          if (event.timestamp) {
            lastEventTime = event.timestamp;
          }
        });

        await promisify(setTimeout)(1000);
      }
    });

    command.command("console").action(async () => {
      await openConsole(detail);
    });
  },
});
