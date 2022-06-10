import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_logs,
  Stack,
} from "aws-cdk-lib";
import {
  AwsMethod,
  MockMethod,
  ExpressStepFunction,
  Function,
  Table,
  ApiGatewayInput,
  $AWS,
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

const fnResource = restApi.root.addResource("fn").addResource("{num}");

new AwsMethod(
  {
    httpMethod: "POST",
    resource: fnResource,
  },
  (
    $input: ApiGatewayInput<{
      path: {
        num: number;
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
      inNum: $input.params("num"),
      inStr: $input.params("str"),
      inBool: $input.data.isTrue,
    });
  },
  ($input) => ({
    resultNum: $input.data.fnNum,
    resultStr: $input.data.fnStr,
    nested: $input.data.nested.again.num,
    numFromParams: $input.params("num"),
    strFromParams: $input.params().str,
  }),
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

const mockResource = restApi.root.addResource("mock").addResource("{num}");
new MockMethod(
  {
    httpMethod: "POST",
    resource: mockResource,
  },
  (
    $input: ApiGatewayInput<{
      path: { num: number };
      body: {
        name: string;
      };
    }>
  ) => ({
    statusCode: $input.params("num"),
  }),
  {
    200: () => ({
      body: {
        num: 12345,
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
const table = new Table<Item, "id">(
  new aws_dynamodb.Table(stack, "table", {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.NUMBER,
    },
  })
);

const dynamoResource = restApi.root.addResource("dynamo").addResource("{num}");
new AwsMethod(
  {
    httpMethod: "GET",
    resource: dynamoResource,
  },
  ($input) =>
    $AWS.DynamoDB.GetItem({
      TableName: table,
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

const sfnResource = restApi.root.addResource("sfn").addResource("{num}");

new AwsMethod(
  {
    httpMethod: "GET",
    resource: sfnResource,
  },
  ($input) =>
    sfn({
      input: {
        num: $input.params("num") as number,
        str: $input.params("str") as string,
      },
    }),
  ($input, $context) => {
    if ($input.data.status === "SUCCEEDED") {
      return {
        resultNum: $input.data.output.sfnNum,
        resultStr: $input.data.output.sfnStr,
      };
    } else {
      $context.responseOverride.status = 500;
      return $input.data.error;
    }
  }
);