import { StackResourceDetail } from "aws-sdk/clients/cloudformation";
import open from "open";

export async function openConsole(detail: StackResourceDetail) {
  const lambdaName = detail.PhysicalResourceId;

  if (detail.ResourceType === "AWS::StepFunctions::StateMachine") {
    const stepFunctionName = detail.PhysicalResourceId;
    open(
      `https://us-east-1.console.aws.amazon.com/states/home?region=us-east-1#/statemachines/view/${stepFunctionName}`
    );
  } else if (detail.ResourceType === "AWS::Lambda::Function") {
    open(
      `https://us-east-1.console.aws.amazon.com/lambda/home?region=us-east-1#/functions/${lambdaName}?tab=code`
    );
  }
}
