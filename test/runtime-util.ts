// eslint-disable-next-line import/no-extraneous-dependencies
import { DynamoDB, Lambda, StepFunctions, SQS, EventBridge } from "aws-sdk";
import { clientConfig } from "./localstack";

export const localLambda = new Lambda(clientConfig);
export const localSFN = new StepFunctions({
  ...clientConfig,
  hostPrefixEnabled: false,
});
export const localSQS = new SQS({
  ...clientConfig,
  hostPrefixEnabled: false,
});
export const localEventBridge = new EventBridge(clientConfig);
export const localDynamoDB = new DynamoDB({
  ...clientConfig,
  hostPrefixEnabled: false,
});

export const testFunction = async (
  functionName: string,
  payload: any,
  expected: any
) => {
  const result = await localLambda
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
  stateMachineArn: string,
  payload: any,
  expected: any
) => {
  const result = await localSFN
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
  stateMachineArn: string,
  payload: any
) => {
  const execResult = await localSFN
    .startExecution({
      stateMachineArn,
      input: JSON.stringify(payload),
    })
    .promise();

  return retry(
    () =>
      localSFN
        .describeExecution({
          executionArn: execResult.executionArn,
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
