import { Lambda, StepFunctions } from "aws-sdk";
import { logicalIdForPath, resolveStackDetail } from "../../logical-id";
import { File } from "../../tree/file";
import path from "path";
import { isLambdaFunction } from "@functionless/aws-lambda";
import { isMethod } from "@functionless/aws-apigateway";
import { isStepFunction } from "@functionless/aws-stepfunctions";
import { isExpressStepFunction } from "@functionless/aws-stepfunctions";

const lambda = new Lambda();
const stepFunctions = new StepFunctions();

export async function getFileArn(file: File): Promise<string> {
  const logicalId = logicalIdForPath(file.address);
  return (await resolveStackDetail(file.stackName, logicalId))
    ?.PhysicalResourceId!;
}

export async function getFunctionRoleArn(entryFile: File): Promise<string> {
  const functionArn = await getFileArn(entryFile);
  if (
    isLambdaFunction(entryFile.resource) ||
    (isMethod(entryFile.resource) &&
      isLambdaFunction(entryFile.resource.handler))
  ) {
    const functionResponse = await lambda
      .getFunction({
        FunctionName: path.basename(functionArn),
      })
      .promise();

    return functionResponse.Configuration?.Role!;
  } else if (
    isStepFunction(entryFile.resource) ||
    isExpressStepFunction(entryFile.resource)
  ) {
    const response = await stepFunctions
      .describeStateMachine({ stateMachineArn: functionArn })
      .promise();
    return response.roleArn;
  }
  throw new Error("Entry file was not a function");
}
