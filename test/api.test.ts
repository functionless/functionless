import "jest";
import { aws_apigateway, IResolvable, Stack } from "aws-cdk-lib";
import { AwsApiIntegration, MockApiIntegration, Function } from "../src";

let stack: Stack;
let func: Function<any, any>;
beforeEach(() => {
  stack = new Stack();
  func = new Function(stack, "F", (p) => p);
});

test("mock integration with object literal", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const method = getMethodTemplates(
    new MockApiIntegration({
      request: (req: {
        pathParameters: {
          code: number;
        };
      }) => ({
        statusCode: req.pathParameters.code,
      }),
      responses: {
        200: () => ({
          response: "OK",
        }),
        500: () => ({
          response: "BAD",
        }),
      },
    }).addMethod("GET", api.root)
  );

  expect(method.httpMethod).toEqual("GET");
  expect(method.integration.requestTemplates).toEqual({
    "application/json": `#set($inputRoot = $input.path('$'))
{"statusCode":$input.params().path.code}`,
  });
  expect(method.integration.integrationResponses).toEqual([
    <IntegrationResponseProperty>{
      statusCode: "200",
      selectionPattern: "^200$",
      responseTemplates: {
        "application/json": `#set($inputRoot = $input.path('$'))
{"response":"OK"}`,
      },
    },
    <IntegrationResponseProperty>{
      statusCode: "500",
      selectionPattern: "^500$",
      responseTemplates: {
        "application/json": `#set($inputRoot = $input.path('$'))
{"response":"BAD"}`,
      },
    },
  ]);
});

test("AWS integration with Function", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const method = getMethodTemplates(
    new AwsApiIntegration({
      request: (req: {
        pathParameters: {
          code: number;
        };
      }) => func(req),
      response: (result) => ({
        result,
      }),
    }).addMethod("GET", api.root)
  );

  expect(method.httpMethod).toEqual("GET");
  expect(method.integration.requestTemplates).toEqual({
    "application/json": `#set($inputRoot = $input.path('$'))
"$inputRoot"`,
  });
  expect(method.integration.integrationResponses).toEqual([
    <IntegrationResponseProperty>{
      statusCode: "200",
      responseTemplates: {
        "application/json": `#set($inputRoot = $input.path('$'))
{"result":"$inputRoot"}`,
      },
    },
  ]);
});

type CfnIntegration = Exclude<
  aws_apigateway.CfnMethod["integration"],
  IResolvable | undefined
> & {
  integrationResponses: IntegrationResponseProperty[];
};

interface IntegrationResponseProperty {
  readonly contentHandling?: string;
  readonly responseParameters?: {
    [key: string]: string;
  };
  readonly responseTemplates?: {
    [key: string]: string;
  };
  readonly selectionPattern?: string;
  readonly statusCode: string;
}

function getMethodTemplates(
  method: aws_apigateway.Method
): aws_apigateway.CfnMethod & {
  integration: CfnIntegration;
} {
  return method.node.findChild("Resource") as any;
}
