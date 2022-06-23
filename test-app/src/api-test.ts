import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_logs,
  Stack,
} from "aws-cdk-lib";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import {
  AwsMethod,
  MockMethod,
  ExpressStepFunction,
  Function,
  Table,
  ApiGatewayInput,
  $AWS,
  LambdaMethod,
} from "functionless";

export const app = new App();

const stack = new Stack(app, "api-test-app-stack");

const restApi = new aws_apigateway.RestApi(stack, "api", {
  restApiName: "api-test-app-api",
});

const fn = new Function(
  stack,
  "fn",
  async (event: { inNum: number; inStr: string; inBool: boolean }) => {
    return {
      fnNum: event.inNum,
      fnStr: event.inStr,
      nested: {
        again: {
          num: event.inNum,
        },
      },
    };
  }
);

const fnResource = restApi.root
  .addResource("fn")
  .addResource("{num}")
  .addResource("{str}");

new AwsMethod(
  {
    httpMethod: "POST",
    resource: fnResource,
  },
  (
    $input: ApiGatewayInput<{
      path: {
        num: string;
      };
      query: {
        str: string;
      };
      body: {
        isTrue: boolean;
      };
    }>
  ) => {
    return fn({
      inNum: Number($input.params("num")),
      inStr: $input.params("str"),
      inBool: $input.data.isTrue,
    });
  },
  ($input) => ({
    resultNum: $input.data.fnNum,
    resultStr: $input.data.fnStr,
    nested: $input.data.nested.again.num,
    numFromParams: $input.params("num"),
    strFromParams: $input.params("str"),
  }),
  {
    400: () => ({ msg: "400" }),
  }
);

const mockResource = restApi.root.addResource("mock").addResource("{num}");
new MockMethod(
  {
    httpMethod: "POST",
    resource: mockResource,
  },
  (
    $input: ApiGatewayInput<{
      path: { num: string };
      body: {
        name: string;
      };
    }>
  ) => ({
    statusCode: Number($input.params("num")),
  }),
  {
    200: ($input) => ({
      body: {
        num: Number($input.params("num")),
      },
    }),
    500: () => ({
      msg: "error",
    }),
  }
);

interface Item {
  id: string;
  name: string;
}
const table = new Table<Item, "id">(stack, "table", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.NUMBER,
  },
});

const dynamoResource = restApi.root.addResource("dynamo").addResource("{num}");
new AwsMethod(
  {
    httpMethod: "GET",
    resource: dynamoResource,
  },
  ($input) =>
    $AWS.DynamoDB.GetItem({
      Table: table,
      Key: {
        id: {
          S: `${$input.params("id")}`,
        },
      },
    }),
  ($input) => ({ id: $input.data.Item?.id.S }),
  {
    400: () => ({ msg: "400" }),
  }
);

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

const sfnResource = restApi.root.addResource("sfn").addResource("{num}");

new AwsMethod(
  {
    httpMethod: "GET",
    resource: sfnResource,
  },
  ($input) =>
    sfn({
      input: {
        num: Number($input.params("num")),
        str: $input.params("str") as string,
      },
    }),
  ($input, $context) => {
    if ($input.data.status === "SUCCEEDED") {
      return $input.data.output;
    } else {
      $context.responseOverride.status = 500;
      return $input.data.error;
    }
  }
);

const proxyResource = restApi.root.addResource("proxy");

const proxy = new Function<APIGatewayProxyEvent, APIGatewayProxyResult>(
  stack,
  "LambdaProxy",
  async (request) => {
    return {
      statusCode: 200,
      body: JSON.stringify(request.body),
    };
  }
);

new LambdaMethod({
  httpMethod: "GET",
  resource: proxyResource,
  function: proxy,
});

new LambdaMethod({
  httpMethod: "POST",
  resource: proxyResource,
  function: proxy,
});
