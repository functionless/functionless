import "jest";
import { aws_apigateway, aws_dynamodb, Stack } from "aws-cdk-lib";
import {
  AwsMethod,
  MockMethod,
  Function,
  ExpressStepFunction,
  Table,
  ApiGatewayInput,
  StepFunction,
  EventBus,
} from "../src";
import { normalizeCDKJson } from "./util";

let stack: Stack;
let func: Function<any, any>;
beforeEach(() => {
  stack = new Stack();
  func = new Function(stack, "F", (p) => {
    return p;
  });
});

test("mock integration with object literal", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const method = new MockMethod(
    {
      httpMethod: "GET",
      resource: api.root,
    },
    ($input) => ({
      statusCode: Number($input.params("code")),
    }),
    {
      200: () => ({
        response: "OK",
      }),
      500: () => ({
        response: "BAD",
      }),
    }
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

test("mock integration with object literal and literal type in pathParameters", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const method = new MockMethod(
    {
      httpMethod: "GET",
      resource: api.root,
    },
    ($input) => ({
      statusCode: Number($input.params("code")),
    }),
    {
      200: () => ({
        response: "OK",
      }),
      500: () => ({
        response: "BAD",
      }),
    }
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

test("AWS integration with Function", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const method = new AwsMethod(
    {
      httpMethod: "GET",
      resource: api.root,
    },
    ($input) => func($input.data.prop),
    (result) => ({
      result,
    })
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

test("AWS integration with Express Step Function", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const sfn = new ExpressStepFunction(
    stack,
    "SFN",
    (_input: { num: number; str: string }) => {
      return "done";
    }
  );

  const method = new AwsMethod(
    {
      httpMethod: "GET",
      resource: api.root,
    },
    (
      $input: ApiGatewayInput<{
        query: {
          num: string;
          str: string;
        };
      }>
    ) =>
      sfn({
        input: {
          num: Number($input.params("num")),
          str: $input.params("str"),
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

  expect(getTemplates(method)).toMatchSnapshot();
});

test("AWS integration with Standard Step Function", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const sfn = new StepFunction(
    stack,
    "SFN",
    (_input: { num: number; str: string }) => {
      return "done";
    }
  );

  const method = new AwsMethod(
    {
      httpMethod: "GET",
      resource: api.root,
    },
    (
      $input: ApiGatewayInput<{
        query: {
          num: string;
          str: string;
        };
      }>
    ) =>
      sfn({
        input: {
          num: Number($input.params("num")),
          str: $input.params("str"),
        },
      }),
    ($input) => {
      return $input.data.executionArn;
    }
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

test("AWS integration with Standard Step Function using input data", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const sfn = new StepFunction(
    stack,
    "SFN",
    (_input: {
      num: number;
      obj: {
        value: string;
      };
    }) => {
      return "done";
    }
  );

  const method = new AwsMethod(
    {
      httpMethod: "GET",
      resource: api.root,
    },
    (
      $input: ApiGatewayInput<{
        query: {
          num: string;
          str: string;
        };
        body: {
          value: string;
        };
      }>
    ) =>
      sfn({
        input: {
          num: Number($input.params("num")),
          obj: $input.data,
        },
      }),
    ($input) => {
      return $input.data.executionArn;
    }
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

test("AWS integration with Event Bus", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const bus = new EventBus(stack, "bus");

  const method = new AwsMethod(
    {
      httpMethod: "GET",
      resource: api.root,
    },
    (
      $input: ApiGatewayInput<{
        body: {
          value: string;
        };
      }>
    ) =>
      bus.putEvents({
        source: "source",
        detail: $input.data,
        "detail-type": "data",
        resources: ["a", $input.data.value],
      }),
    () => {
      return "success";
    }
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

test("AWS integration with Event Bus fails when given a reference", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const bus = new EventBus(stack, "bus");

  expect(
    () =>
      new AwsMethod(
        {
          httpMethod: "GET",
          resource: api.root,
        },
        (
          $input: ApiGatewayInput<{
            body: {
              event: { source: string; "detail-type": string; detail: any };
            };
          }>
        ) => bus.putEvents($input.data.event),
        () => {
          return "success";
        }
      )
  ).toThrow(
    "API Gateway Integration with EventBus.putEvents expects object literals with no computed properties"
  );
});

test("AWS integration with DynamoDB Table", () => {
  const api = new aws_apigateway.RestApi(stack, "API");
  const table = Table.fromTable(
    new aws_dynamodb.Table(stack, "Table", {
      partitionKey: {
        name: "pk",
        type: aws_dynamodb.AttributeType.STRING,
      },
    })
  );

  const method = new AwsMethod(
    {
      httpMethod: "POST",
      resource: api.root,
    },
    (
      $input: ApiGatewayInput<{
        body: {
          id: string;
        };
      }>
    ) =>
      table.attributes.get({
        Key: {
          pk: {
            S: $input.data.id,
          },
        },
      }),
    ($input, $context) => {
      if ($input.data.Item !== undefined) {
        return {
          data: $input.data.Item,
        };
      } else {
        $context.responseOverride.status = 404;
        return {
          requestId: $context.requestId,
          missing: true,
        };
      }
    }
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

function getTemplates(integration: { method: aws_apigateway.Method }) {
  const m = integration.method.node.findChild(
    "Resource"
  ) as aws_apigateway.CfnMethod & {
    integration: aws_apigateway.CfnMethod.IntegrationProperty;
  };
  return normalizeCDKJson({
    requestTemplates: m.integration.requestTemplates,
    integrationResponses: m.integration.integrationResponses,
  });
}

test("return $input.data", () => {
  const api = new aws_apigateway.RestApi(stack, "API");
  const table = Table.fromTable(
    new aws_dynamodb.Table(stack, "Table", {
      partitionKey: {
        name: "pk",
        type: aws_dynamodb.AttributeType.STRING,
      },
    })
  );

  const method = new AwsMethod(
    {
      httpMethod: "POST",
      resource: api.root,
    },
    (
      $input: ApiGatewayInput<{
        body: {
          id: string;
        };
      }>
    ) =>
      table.attributes.get({
        Key: {
          pk: {
            S: $input.data.id,
          },
        },
      }),
    ($input) => $input.data
  );

  expect(getTemplates(method)).toMatchSnapshot();
});

test("return $input.data.list[0]", () => {
  const api = new aws_apigateway.RestApi(stack, "API");
  const table = Table.fromTable(
    new aws_dynamodb.Table(stack, "Table", {
      partitionKey: {
        name: "pk",
        type: aws_dynamodb.AttributeType.STRING,
      },
    })
  );

  const method = new AwsMethod(
    {
      httpMethod: "POST",
      resource: api.root,
    },
    (
      $input: ApiGatewayInput<{
        body: {
          list: string;
        };
      }>
    ) =>
      table.attributes.get({
        Key: {
          pk: {
            S: $input.data.list[0],
          },
        },
      }),
    ($input) => $input.data
  );

  expect(getTemplates(method)).toMatchSnapshot();
});
