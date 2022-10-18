import StepFunctions from "aws-sdk/clients/stepfunctions";

const stepFunctionClient = new StepFunctions();

/**
 * A shim that is loaded in when invoking step functions from lambdas, in synth target
 * @param stateMachineArn Arn of the step function to invoke
 * @returns
 */
export const _invokeStepFunction =
  (stateMachineArn: string) =>
  async (...args: any) =>
    stepFunctionClient
      .startExecution({
        stateMachineArn: stateMachineArn,
        input: JSON.stringify(args),
      })
      .promise();
