import { App, aws_apigateway, aws_logs, Stack } from "aws-cdk-lib";
import { ApiIntegrations, ExpressStepFunction, Function } from "functionless";

export const app = new App();

const stack = new Stack(app, "api-test-app-stack");

const restApi = new aws_apigateway.RestApi(stack, "api", {
  restApiName: "api-test-app-api",
});

const fn = new Function<
  { inNum: number; inStr: string; inBool: boolean },
  { fnNum: number; fnStr: string; fnBool: boolean }
>(stack, "fn", async (event) => ({
  fnNum: event.inNum,
  fnStr: event.inStr,
  fnBool: event.inBool,
}));

interface FnRequest {
  pathParameters: {
    num: number;
  };
  queryStringParameters: {
    str: string;
  };
  body: {
    bool: boolean;
  };
}

const fnResource = restApi.root.addResource("fn").addResource("{num}");
const fnIntegration = ApiIntegrations.aws({
  request: (req: FnRequest) => ({
    inNum: req.pathParameters.num,
    inStr: req.queryStringParameters.str,
    inBool: req.body.bool,
  }),
  integration: fn,
  response: (resp) => ({
    outNum: resp.fnNum,
    outStr: resp.fnStr,
    outBool: resp.fnBool,
  }),
});
fnIntegration.addMethod("POST", fnResource);

const sfn = new ExpressStepFunction(
  stack,
  "express-sfn",
  {
    logs: {
      destination: new aws_logs.LogGroup(stack, "express-sfn-logs"),
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
sfnIntegration.addMethod("GET", sfnResource);

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
mock.addMethod("GET", mockResource);
