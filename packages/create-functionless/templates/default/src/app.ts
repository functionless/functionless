import { App, Stack } from "aws-cdk-lib";
import { Function } from "@functionless/aws-lambda-constructs";
import { StepFunction } from "@functionless/aws-stepfunctions-constructs";

const app = new App();

const stack = new Stack(app, "MyStack");

const sayFunction = new Function(
  stack,
  "SayFunction",
  async (event: { message: string }) => {
    console.log(event.message);
    return;
  }
);

new StepFunction(stack, "Workflow", async (event: { name: string }) => {
  await sayFunction({ message: `Hello ${event.name}` });
});
