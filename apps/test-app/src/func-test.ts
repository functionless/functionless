import { App, Stack } from "aws-cdk-lib";
import { EventBus } from "@functionless/aws-events-constructs";
import { Function } from "@functionless/aws-lambda-constructs";
import { StepFunction } from "@functionless/aws-stepfunctions-constructs";

export const app = new App();
export const stack = new Stack(app, "func-test");

/**
 * Just playing with functions
 */

const eventBus = new EventBus(stack, "eventBus");

const workflow = new StepFunction<undefined, { status: "SUCCESS" | "FAIL" }>(
  stack,
  "workflow",
  async () => {
    // do a job
    // send an email
    return { status: "SUCCESS" };
  }
);

new Function(stack, "startworkflow", async () => {
  const execution = await workflow({}); // start execution
  let result: string | undefined = undefined;
  while (!result) {
    await new Promise((resolve) => setTimeout(resolve, 100)); // sleep 100ms
    const executionOut = await workflow.describeExecution(
      execution.executionArn
    );
    if (executionOut.output) {
      // check if the execution is done
      result = JSON.parse(executionOut.output).status;
    }
  }
  console.log(result);
  // broadcast dynamic result message to all consumers
  await eventBus.putEvents({
    "detail-type": "workflowComplete",
    detail: {
      result,
    },
    source: "workflow",
  });
});
