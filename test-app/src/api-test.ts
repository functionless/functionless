import {
  App,
  aws_apigateway,
  aws_dynamodb,
  aws_logs,
  Stack,
} from "aws-cdk-lib";
import {
  AwsApiIntegration,
  MockApiIntegration,
  ExpressStepFunction,
  Function,
  Table,
  APIGatewayInput,
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

new AwsApiIntegration(
  {
    httpMethod: "POST",
    resource: fnResource,
  },
  ($input: APIGatewayInput) =>
    fn({
      inNum: $input.params("num") as number,
      inStr: $input.params("str") as string,
      inBool: $input.json("$.body"),
    }),
  (resp) => ({
    resultNum: resp.fnNum,
    resultStr: resp.fnStr,
    nested: resp.nested.again.num,
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
new MockApiIntegration(
  {
    httpMethod: "POST",
    resource: mockResource,
  },
  ($input) => ({
    statusCode: $input.params("num") as number,
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
new AwsApiIntegration(
  {
    httpMethod: "GET",
    resource: dynamoResource,
  },
  ($input: APIGatewayInput) =>
    table.getItem({
      key: {
        id: {
          S: `${$input.params("id")}`,
        },
      },
    }),
  (resp) => ({ foo: resp.name }),
  {
    400: () => ({ msg: "400" }),
  }
);

const sfnResource = restApi.root.addResource("sfn").addResource("{num}");

new AwsApiIntegration(
  {
    httpMethod: "GET",
    resource: sfnResource,
  },
  ($input: APIGatewayInput) =>
    sfn({
      input: {
        num: $input.params("num") as number,
        str: $input.params("str") as string,
      },
    }),
  (resp, $context) => {
    if (resp.status === "SUCCEEDED") {
      return {
        resultNum: resp.output.sfnNum,
        resultStr: resp.output.sfnStr,
      };
    } else {
      $context.responseOverride.status = 500;
      return resp.error;
    }
  }
);
