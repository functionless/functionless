import { aws_apigateway } from "aws-cdk-lib";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import {
  ApiGatewayInput,
  AwsMethod,
  Function,
  LambdaMethod,
  MockMethod,
} from "../src";
import { runtimeTestSuite } from "./runtime";

runtimeTestSuite("apiGatewayStack", (test, stack) => {
  // skipped because local stack does not support mapping templates https://github.com/localstack/localstack/issues/5850
  test.skip(
    "mock integration",
    () => {
      const api = new aws_apigateway.RestApi(stack, "MockAPI");
      const code = api.root.addResource("{code}");
      new MockMethod(
        {
          httpMethod: "GET",
          resource: code,
        },
        (
          req: ApiGatewayInput<{
            path: {
              code: string;
            };
          }>
        ) => ({
          statusCode: Number(req.params("code")),
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

      return {
        outputs: {
          endpoint: api.url,
        },
      };
    },
    async (context) => {
      const response = await axios.get(`${context.endpoint}200`);
      expect(response.data).toEqual({
        response: "OK",
      });
    }
  );

  // skipped because local stack does not support mapping templates https://github.com/localstack/localstack/issues/5850
  test.skip(
    "lambda function integration",
    () => {
      const api = new aws_apigateway.RestApi(stack, "LambdaAPI");
      const func = new Function(stack, "Func", async (_input: any) => {
        return { key: "hello" };
      });

      new AwsMethod(
        {
          httpMethod: "GET",
          resource: api.root,
        },
        (
          req: ApiGatewayInput<{
            path: {
              code: string;
            };
          }>
        ) =>
          func({
            input: Number(req.params("code")),
          }),
        (result) => ({
          result: result.data.key,
        })
      );

      return {
        outputs: {
          endpoint: api.url,
        },
      };
    },
    async (context) => {
      const response = await axios.get(context.endpoint);
      expect(response.data).toEqual({ result: "hello" });
    }
  );

  test(
    "lambda proxy method",
    () => {
      const api = new aws_apigateway.RestApi(stack, "LambdaAPI");
      const func = new Function<APIGatewayProxyEvent, APIGatewayProxyResult>(
        stack,
        "Func",
        async (request) => {
          return {
            statusCode: 200,
            body: JSON.stringify({
              hello: "world",
              path: request.path,
            }),
          };
        }
      );

      new LambdaMethod({
        httpMethod: "GET",
        resource: api.root,
        function: func,
      });

      return {
        outputs: {
          endpoint: api.url,
        },
      };
    },
    async (context) => {
      const response = await axios.get(context.endpoint);
      expect(response.status).toEqual(200);
      expect(response.data).toMatchObject({
        hello: "world",
        path: "/",
      });
    }
  );
});
