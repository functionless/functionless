import { App, aws_lambda, Stack } from "aws-cdk-lib";
import { clientConfig, deployStack } from "./localstack";
import { CloudFormation, Lambda } from "aws-sdk";
import { Function } from "../src";

jest.setTimeout(500000);

const CF = new CloudFormation(clientConfig);
let stack: Stack;

// Inspiration: https://github.com/aws/aws-cdk/pull/18667#issuecomment-1075348390
beforeAll(async () => {
  const app = new App();
  stack = new Stack(app, "testStack2", {
    env: {
      account: "000000000000",
      region: "us-east-1",
    },
  });

  new Function(
    new aws_lambda.Function(stack, "testFunc", {
      code: aws_lambda.Code.fromInline(`
    exports.handler = async (event) => {
        console.log('event: ', event)
      };
    `),
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
    })
  );

  new Function(stack, "func2", (event) => event);

  await deployStack(app, stack);
});

const lambda = new Lambda(clientConfig);

test("Call Lambda", async () => {
  const resources = await CF.listStackResources({
    StackName: stack.artifactId,
  }).promise();

  console.log(
    resources.StackResourceSummaries?.map((s) => [
      s.PhysicalResourceId,
      s.LogicalResourceId,
      s.ResourceType,
    ])
  );

  const testFunc = resources.StackResourceSummaries?.find(
    (r) =>
      r.ResourceType === "AWS::Lambda::Function" &&
      r.LogicalResourceId?.startsWith("testFunc")
  );

  expect(testFunc).not.toBeUndefined();

  const result = await lambda
    .invoke({
      FunctionName: testFunc?.PhysicalResourceId!,
      Payload: JSON.stringify({}),
    })
    .promise();

  expect(result.Payload).toEqual(`null
`);
});

test("Call Lambda from closure", async () => {
  const resources = await CF.listStackResources({
    StackName: stack.artifactId,
  }).promise();

  console.log(
    resources.StackResourceSummaries?.map((s) => [
      s.PhysicalResourceId,
      s.LogicalResourceId,
      s.ResourceType,
    ])
  );

  const testFunc = resources.StackResourceSummaries?.find(
    (r) =>
      r.ResourceType === "AWS::Lambda::Function" &&
      r.LogicalResourceId?.startsWith("func2")
  );

  expect(testFunc).not.toBeUndefined();

  const result = await lambda
    .invoke({
      FunctionName: testFunc?.PhysicalResourceId!,
      Payload: JSON.stringify({}),
    })
    .promise();

  expect(result.Payload).toEqual(`null
`);
});
