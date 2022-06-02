import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_logs,
  Stack,
} from "aws-cdk-lib";
import {
  ApiIntegrations,
  ExpressStepFunction,
  Function,
  SyncExecutionSuccessResult,
  Table,
} from "functionless";

export const app = new App();

const stack = new Stack(app, "api-test-app-stack");

const restApi = new aws_apigateway.RestApi(stack, "api", {
  restApiName: "api-test-app-api",
});

const fn = new Function(
  stack,
  "fn",
  async (event: { inNum: number; inStr: string; inBool: boolean }) => ({
    fnNum: event.inNum,
    fnStr: event.inStr,
    fnBool: event.inBool,
    nested: {
      again: {
        num: 123,
      },
    },
  })
);

const fnResource = restApi.root.addResource("fn").addResource("{num}");
const fnIntegration = ApiIntegrations.aws({
  request: (req: FnRequest) =>
    fn({
      inNum: req.pathParameters.num,
      inStr: req.queryStringParameters.str,
      inBool: req.body.bool,
    }),
  response: (resp) => ({
    resultNum: resp.fnNum,
    resultStr: resp.fnStr,
    nested: resp.nested.again.num,
  }),
  errors: {
    400: () => ({ msg: "400" }),
  },
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
  (input: { num: number; str: string }) => ({
    sfnNum: input.num,
    sfnStr: input.str,
  })
);

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

interface Item {
  id: number;
  name: string;
}
const table = new Table<Item, "id">(
  new aws_dynamodb.Table(stack, "table", {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.NUMBER,
    },
  })
);

interface DynamoRequest {
  pathParameters: {
    id: number;
  };
}

const dynamoResource = restApi.root.addResource("dynamo").addResource("{num}");
const dynamoIntegration = ApiIntegrations.aws({
  request: (req: DynamoRequest) =>
    table.getItem({
      key: {
        id: {
          N: `${req.pathParameters.id}`,
        },
      },
    }),
  // @ts-ignore TODO: resp is never for some reason
  response: (resp) => ({ foo: resp.item.foo }),
  errors: {
    400: () => ({ msg: "400" }),
  },
});
dynamoIntegration.addMethod("GET", dynamoResource);

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
  // @ts-ignore TODO: output is only on success, need to support if stmt
  request: (req: SfnRequest) =>
    sfn({
      input: {
        num: req.pathParameters.num,
        str: req.queryStringParameters.str,
      },
    }),
  response: (resp: SyncExecutionSuccessResult<any>) => ({
    resultNum: resp.output.sfnNum,
    resultStr: resp.output.sfnStr,
  }),
  // TODO: make errors optional?
  errors: {},
});
sfnIntegration.addMethod("GET", sfnResource);
