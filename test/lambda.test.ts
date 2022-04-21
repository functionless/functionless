import { aws_lambda, Stack } from "aws-cdk-lib";
import { deployStack } from "./localstack";
import { AsyncApp, Function } from "../src";
// import { runtime } from "@pulumi/pulumi";

jest.setTimeout(500000);

// const CF = new CloudFormation(clientConfig);
let stack: Stack;
let app: AsyncApp;

// Inspiration: https://github.com/aws/aws-cdk/pull/18667#issuecomment-1075348390
beforeAll(async () => {
  app = new AsyncApp();
  
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

  new Function(stack, "func2", async (event) => event);

  // const create = () => new Function(stack, "func3", (event) => event);
  // create();

  // const create2 = () => {
  //   const val = "a";
  //   new Function(stack, "func4", () => val);
  // };

  // create2();

  // const create3 = (val: string) => {
  //   new Function(stack, "func5", () => val);
  // };

  // create3("b");

  // const create4 = (id: string, val: string) => {
  //   new Function(stack, id, () => val);
  // };

  // create4("func6", "c");
  // create4("func7", "d");

  // await flushPromises();

  await deployStack(app, stack);
});

test("simple", async () => {
  // runtime.serializeFunction(() => {}).then((x) => console.log(x.text));
  // new Function(stack, "func2", (event) => event);
});

// const lambda = new Lambda(clientConfig);

// test("Call Lambda", async () => {
//   await flushPromises();

//   const resources = await CF.listStackResources({
//     StackName: stack.artifactId,
//   }).promise();

//   console.log(
//     resources.StackResourceSummaries?.map((s) => [
//       s.PhysicalResourceId,
//       s.LogicalResourceId,
//       s.ResourceType,
//     ])
//   );

//   const testFunc = resources.StackResourceSummaries?.find(
//     (r) =>
//       r.ResourceType === "AWS::Lambda::Function" &&
//       r.LogicalResourceId?.startsWith("testFunc")
//   );

//   expect(testFunc).not.toBeUndefined();

//   const result = await lambda
//     .invoke({
//       FunctionName: testFunc?.PhysicalResourceId!,
//       Payload: JSON.stringify({}),
//     })
//     .promise();

//   expect(result.Payload).toEqual(`null
// `);
// });

// test("Call Lambda from closure", async () => {
//   const resources = await CF.listStackResources({
//     StackName: stack.artifactId,
//   }).promise();

//   const testFunc = resources.StackResourceSummaries?.find(
//     (r) =>
//       r.ResourceType === "AWS::Lambda::Function" &&
//       r.LogicalResourceId?.startsWith("func2")
//   );

//   expect(testFunc).not.toBeUndefined();

//   const result = await lambda
//     .invoke({
//       FunctionName: testFunc?.PhysicalResourceId!,
//       Payload: JSON.stringify({ test: "me" }),
//     })
//     .promise();

//   console.log(result);

//   expect(result.Payload).toEqual(`null
// `);
// });

// test("Call Lambda from closure basic", async () => {
//   const resources = await CF.listStackResources({
//     StackName: stack.artifactId,
//   }).promise();

//   const testFunc = resources.StackResourceSummaries?.find(
//     (r) =>
//       r.ResourceType === "AWS::Lambda::Function" &&
//       r.LogicalResourceId?.startsWith("func3")
//   );

//   expect(testFunc).not.toBeUndefined();

//   const result = await lambda
//     .invoke({
//       FunctionName: testFunc?.PhysicalResourceId!,
//       Payload: JSON.stringify({}),
//     })
//     .promise();

//   expect(result.Payload).toEqual(`null
// `);
// });

// test("Call Lambda from closure with variables", async () => {
//   await deployStack(app, stack);

//   const resources = await CF.listStackResources({
//     StackName: stack.artifactId,
//   }).promise();

//   const testFunc = resources.StackResourceSummaries?.find(
//     (r) =>
//       r.ResourceType === "AWS::Lambda::Function" &&
//       r.LogicalResourceId?.startsWith("func2")
//   );

//   expect(testFunc).not.toBeUndefined();

//   const result = await lambda
//     .invoke({
//       FunctionName: testFunc?.PhysicalResourceId!,
//       Payload: JSON.stringify({}),
//     })
//     .promise();

//   expect(result.Payload).toEqual(`null
// `);
// });

// test("Call Lambda from closure with parameter", async () => {
//   const resources = await CF.listStackResources({
//     StackName: stack.artifactId,
//   }).promise();

//   const testFunc = resources.StackResourceSummaries?.find(
//     (r) =>
//       r.ResourceType === "AWS::Lambda::Function" &&
//       r.LogicalResourceId?.startsWith("func2")
//   );

//   expect(testFunc).not.toBeUndefined();

//   const result = await lambda
//     .invoke({
//       FunctionName: testFunc?.PhysicalResourceId!,
//       Payload: JSON.stringify({}),
//     })
//     .promise();

//   expect(result.Payload).toEqual(`null
// `);
// });

// test("Call Lambda from closure with parameter multiple", async () => {
//   await deployStack(app, stack);

//   const resources = await CF.listStackResources({
//     StackName: stack.artifactId,
//   }).promise();

//   const testFunc = resources.StackResourceSummaries?.find(
//     (r) =>
//       r.ResourceType === "AWS::Lambda::Function" &&
//       r.LogicalResourceId?.startsWith("func2")
//   );

//   expect(testFunc).not.toBeUndefined();

//   const result = await lambda
//     .invoke({
//       FunctionName: testFunc?.PhysicalResourceId!,
//       Payload: JSON.stringify({}),
//     })
//     .promise();

//   expect(result.Payload).toEqual(`null
// `);
// });
