import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_logs,
  Stack,
} from "aws-cdk-lib";
import {
  ApiIntegrations,
  EventBus,
  EventBusRuleInput,
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

// interface SfnRequest {
//   pathParameters: {
//     num: number;
//   };
//   queryStringParameters: {
//     str: string;
//   };
// }

// const sfnResource = restApi.root.addResource("sfn").addResource("{num}");
// const sfnIntegration = ApiIntegrations.aws({
//   request: (req: SfnRequest) => ({
//     input: {
//       num: req.pathParameters.num,
//       str: req.queryStringParameters.str,
//     },
//   }),
//   integration: sfn,
//   response: (resp) => ({ resultNum: resp.sfnNum, resultStr: resp.sfnStr }),
// });
// sfnIntegration.addMethod("GET", sfnResource);

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

interface ExperimentalDynamoRequest {
  pathParameters: {
    id: number;
  };
}

const experimentalDynamoResource = restApi.root
  .addResource("experimental-dynamo")
  .addResource("{num}");
const experimentalDynamoIntegration = ApiIntegrations.aws({
  request: (req: ExperimentalDynamoRequest) =>
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
experimentalDynamoIntegration.addMethod("GET", experimentalDynamoResource);

interface ExperimentalEventBusRequest {
  pathParameters: {
    num: number;
  };
  body: {
    nested: {
      again: {
        num: number;
      };
    };
  };
}

const bus = new EventBus<EventBusRuleInput<{ id: number }>>(stack, "bus");

const experimentalEventBusResource = restApi.root
  .addResource("experimental-event-bus")
  .addResource("{num}");
const experimentalEventBusIntegration = ApiIntegrations.aws({
  request: (req: ExperimentalEventBusRequest) =>
    bus({
      detail: { id: req.body.nested.again.num },
      "detail-type": "test",
      source: "test",
    }),
  response: () => ({ msg: "sent successfully" }),
  errors: {
    400: () => ({ message: "bad request" }),
    500: () => ({ message: "internal error" }),
  },
});
experimentalEventBusIntegration.addMethod("POST", experimentalEventBusResource);

interface ExperimentalSfnRequest {
  pathParameters: {
    num: number;
  };
  queryStringParameters: {
    str: string;
  };
}

const experimentalSfnResource = restApi.root
  .addResource("experimental-sfn")
  .addResource("{num}");
const experimentalSfnIntegration = ApiIntegrations.aws({
  // @ts-ignore TODO: output is only on success, need to support if stmt
  request: (req: ExperimentalSfnRequest) =>
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
experimentalSfnIntegration.addMethod("GET", experimentalSfnResource);
