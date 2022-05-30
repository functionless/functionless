import { App, aws_apigateway, aws_logs, Stack } from "aws-cdk-lib";
import { ApiIntegrations, ExpressStepFunction } from "functionless";

export const app = new App();

const stack = new Stack(app, "fluent-stack");

const restApi = new aws_apigateway.RestApi(stack, "fluent-api");

// const lambdaCode = `exports.handler = async (event, context) => {
//   console.log(event);
//   return { foo: event.num * 2 };
// }`;

// @ts-ignore
// const fn = new Function<{ num: number }, { foo: number }>(
//   new aws_lambda.Function(stack, "fluent-fn", {
//     code: new aws_lambda.InlineCode(lambdaCode),
//     runtime: aws_lambda.Runtime.NODEJS_14_X,
//     handler: "index.handler",
//   })
// );

// const fnResource = restApi.root.addResource("fn").addResource("{num}");
// new ApiIntegration<{ pathParameters: { num: number } }>()
//   .transformRequest((n) => ({
//     num: n.pathParameters.num,
//   }))
//   .call(fn)
//   // .handleResponse((n) => ({ bar: n.foo }))
//   .addMethod(fnResource);

const sfn = new ExpressStepFunction(
  stack,
  "fluent-sfn",
  {
    logs: {
      destination: new aws_logs.LogGroup(stack, "fluent-sfn-logs"),
      includeExecutionData: true,
    },
  },
  (req: { num: number; str: string }) => ({
    sfnNum: req.num,
    sfnStr: req.str,
  })
);

interface SfnRequest {
  pathParameters: {
    num: number;
  };
  queryStringParameters: {
    str: string;
  };
}

const sfnResource = restApi.root.addResource("sfn").addResource("{num}");
const sfnIntegration = ApiIntegrations.aws({
  request: (req: SfnRequest) => ({
    num: req.pathParameters.num,
    str: req.queryStringParameters.str,
  }),
  integration: sfn,
  response: (resp) => ({ resultNum: resp.sfnNum, resultStr: resp.sfnStr }),
});
sfnIntegration.addMethod(sfnResource);

interface MockRequest {
  pathParameters: {
    num: 200 | 500;
  };
}

const mockResource = restApi.root.addResource("mock").addResource("{num}");
const mock = ApiIntegrations.mock({
  request: (req: MockRequest) => ({
    statusCode: req.pathParameters.num,
  }),
  responses: {
    200: () => ({
      body: {
        num: 12345,
      },
    }),
    500: () => ({
      msg: "error",
    }),
  },
});
mock.addMethod(mockResource);

// https://devblogs.microsoft.com/typescript/announcing-typescript-4-7/#improved-function-inference-in-objects-and-methods
// https://github.com/microsoft/TypeScript/pull/41712
