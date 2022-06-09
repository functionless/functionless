import "jest";
import { aws_apigateway, aws_dynamodb, IResolvable, Stack } from "aws-cdk-lib";
import {
  AwsApiIntegration,
  MockApiIntegration,
  Function,
  BaseApiIntegration,
  ExpressStepFunction,
  Table,
  $AWS,
  ApiGatewayInput,
} from "../src";

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

  const method = getCfnMethod(
    new MockApiIntegration(
      {
        httpMethod: "GET",
        resource: api.root,
      },
      ($input) => ({
        statusCode: $input.params("code") as number,
      }),
      {
        200: () => ({
          response: "OK",
        }),
        500: () => ({
          response: "BAD",
        }),
      }
    )
  );

  expect(method.httpMethod).toEqual("GET");
  expect(method.integration.requestTemplates).toEqual({
    "application/json": `{
  "statusCode":#if($input.params('params').class.name === 'java.lang.String') 
\"$input.params('params')\" 
#elseif($input.params('params').class.name === 'java.lang.Integer' || $input.params('params').class.name === 'java.lang.Double' || $input.params('params').class.name === 'java.lang.Boolean') 
$input.params('params') 
#else
$context.responseOverride.status = 500
#stop
#end
}`,
  });
  expect(method.integration.integrationResponses).toEqual([
    <IntegrationResponseProperty>{
      statusCode: "200",
      selectionPattern: "^200$",
      responseTemplates: {
        "application/json": `{
  "response":"OK"
}`,
      },
    },
    <IntegrationResponseProperty>{
      statusCode: "500",
      selectionPattern: "^500$",
      responseTemplates: {
        "application/json": `{
  "response":"BAD"
}`,
      },
    },
  ]);
});

test("mock integration with object literal and literal type in pathParameters", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const method = getCfnMethod(
    new MockApiIntegration(
      {
        httpMethod: "GET",
        resource: api.root,
      },
      ($input) => ({
        statusCode: $input.params("code") as number,
      }),
      {
        200: () => ({
          response: "OK",
        }),
        500: () => ({
          response: "BAD",
        }),
      }
    )
  );

  expect(method.httpMethod).toEqual("GET");
  expect(method.integration.requestTemplates).toEqual({
    "application/json": `{
  \"statusCode\":#if($input.params('params').class.name === 'java.lang.String') 
\"$input.params('params')\" 
#elseif($input.params('params').class.name === 'java.lang.Integer' || $input.params('params').class.name === 'java.lang.Double' || $input.params('params').class.name === 'java.lang.Boolean') 
$input.params('params') 
#else
$context.responseOverride.status = 500
#stop
#end
}`,
  });
  expect(method.integration.integrationResponses).toEqual([
    <IntegrationResponseProperty>{
      statusCode: "200",
      selectionPattern: "^200$",
      responseTemplates: {
        "application/json": `{
  "response":"OK"
}`,
      },
    },
    <IntegrationResponseProperty>{
      statusCode: "500",
      selectionPattern: "^500$",
      responseTemplates: {
        "application/json": `{
  "response":"BAD"
}`,
      },
    },
  ]);
});

test("AWS integration with Function", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  const method = getCfnMethod(
    new AwsApiIntegration(
      {
        httpMethod: "GET",
        resource: api.root,
      },
      ($input) => func($input.data.prop),
      (result) => ({
        result,
      })
    )
  );

  expect(method.httpMethod).toEqual("GET");
  expect(method.integration.requestTemplates).toEqual({
    "application/json": `$input.json('$.prop')`,
  });
  expect(method.integration.integrationResponses).toEqual([
    <IntegrationResponseProperty>{
      statusCode: "200",
      responseTemplates: {
        "application/json": `{
  "result":$input.json('$')
}`,
      },
    },
  ]);
});

test("AWS integration with Express Step Function", () => {
  const api = new aws_apigateway.RestApi(stack, "API");

  type Request = {
    num: number;
    str: string;
  };
  const sfn = new ExpressStepFunction(stack, "SFN", (_input: Request) => {
    return "done";
  });

  const method = getCfnMethod(
    new AwsApiIntegration(
      {
        httpMethod: "GET",
        resource: api.root,
      },
      (
        $input: ApiGatewayInput<{
          query: Request;
        }>
      ) =>
        sfn({
          input: {
            num: $input.params("num"),
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
    )
  );

  expect(method.httpMethod).toEqual("GET");
  expect(method.integration.requestTemplates).toEqual({
    "application/json": `{
\"input\":{
  \"num\":#if($input.params('params').class.name === 'java.lang.String') 
\"$input.params('params')\" 
#elseif($input.params('params').class.name === 'java.lang.Integer' || $input.params('params').class.name === 'java.lang.Double' || $input.params('params').class.name === 'java.lang.Boolean') 
$input.params('params') 
#else
$context.responseOverride.status = 500
#stop
#end,
  \"str\":#if($input.params('params').class.name === 'java.lang.String') 
\"$input.params('params')\" 
#elseif($input.params('params').class.name === 'java.lang.Integer' || $input.params('params').class.name === 'java.lang.Double' || $input.params('params').class.name === 'java.lang.Boolean') 
$input.params('params') 
#else
$context.responseOverride.status = 500
#stop
#end
}
}`,
  });
  expect(method.integration.integrationResponses).toEqual([
    <IntegrationResponseProperty>{
      statusCode: "200",
      responseTemplates: {
        "application/json": `#set($v1 = $inputRoot.data.status == 'SUCCEEDED')
#if($v1)
$input.json('$.output')
#else
#set($v2 = $context.responseOverride.status = 500)
$util.qr($v2)
$input.json('$.error')
#end`,
      },
    },
  ]);
});

test("AWS integration with DynamoDB Table", () => {
  const api = new aws_apigateway.RestApi(stack, "API");
  const table = new Table(
    new aws_dynamodb.Table(stack, "Table", {
      partitionKey: {
        name: "pk",
        type: aws_dynamodb.AttributeType.STRING,
      },
    })
  );

  const method = getCfnMethod(
    new AwsApiIntegration(
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
        $AWS.DynamoDB.GetItem({
          TableName: table,
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
    )
  );

  expect(method.httpMethod).toEqual("POST");
  expect(method.integration.requestTemplates).toEqual({
    "application/json": `#set($inputRoot = $input.path('$'))
{"input":{"num":"$input.pathParameters}}`,
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

function getCfnMethod(method: BaseApiIntegration): aws_apigateway.CfnMethod & {
  integration: CfnIntegration;
} {
  return method.method.node.findChild("Resource") as any;
}
