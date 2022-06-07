import { aws_apigateway } from "aws-cdk-lib";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import axios from "axios";
import {
  AwsApiIntegration,
  Function,
  LambdaProxyApiMethod,
  MockApiIntegration,
} from "../src";
import { localstackTestSuite } from "./localstack";

localstackTestSuite("apiGatewayStack", (test, stack) => {
  test.skip(
    "mock integration",
    () => {
      const api = new aws_apigateway.RestApi(stack, "MockAPI");
      const code = api.root.addResource("{code}");
      new MockApiIntegration({
        httpMethod: "GET",
        resource: code,
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
      });

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

  test.skip(
    "lambda function integration",
    () => {
      const api = new aws_apigateway.RestApi(stack, "LambdaAPI");
      const func = new Function(stack, "Func", async (_input: any) => {
        return { key: "hello" };
      });

      new AwsApiIntegration({
        httpMethod: "GET",
        resource: api.root,
        request: (req: {
          pathParameters: {
            code: number;
          };
        }) =>
          func({
            input: req.pathParameters.code,
          }),
        response: (result) => ({
          result: result.key,
        }),
      });

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

      new LambdaProxyApiMethod({
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
