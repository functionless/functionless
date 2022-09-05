import { StepFunctions } from "aws-sdk";
import Lambda from "aws-sdk/clients/lambda";

export const testFunction = async (
  lambda: Lambda,
  functionName: string,
  payload: any,
  expected: any
) => {
  const result = await lambda
    .invoke({
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
    })
    .promise();

  try {
    expect(
      result.Payload ? JSON.parse(result.Payload.toString()) : undefined
    ).toEqual(expected);
  } catch (e) {
    console.error(result);
    throw e;
  }
};

/**
 * Localstack does not currently support express step functions...
 * https://github.com/localstack/localstack/issues/5258
 */
export const testExprStepFunction = async (
  sfn: StepFunctions,
  stateMachineArn: string,
  payload: any,
  expected: any
) => {
  const result = await sfn
    .startSyncExecution({
      stateMachineArn,
      input: JSON.stringify(payload),
    })
    .promise();

  try {
    expect(result.output ? JSON.parse(result.output) : undefined).toEqual(
      expected
    );
  } catch (e) {
    throw e;
  }
};

export const testStepFunction = async (
  sfn: StepFunctions,
  executionArn: string
) => {
  return retry(
    () =>
      sfn
        .describeExecution({
          executionArn: executionArn,
        })
        .promise(),
    (exec) => exec.status !== "RUNNING",
    10,
    1000,
    2
  );
};

const wait = (waitMillis: number) =>
  new Promise((resolve) => setTimeout(resolve, waitMillis));

export const retry = async <T>(
  call: () => T | Promise<T>,
  predicate: (val: T) => boolean,
  attempts: number,
  waitMillis: number,
  factor: number
): Promise<Awaited<T>> => {
  const item = await call();
  if (!predicate(item)) {
    if (attempts) {
      await wait(waitMillis);
      return retry(call, predicate, attempts - 1, waitMillis * factor, factor);
    } else {
      throw Error("Retry attempts exhausted");
    }
  }
  return item;
};
