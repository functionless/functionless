import { aws_apigateway } from "aws-cdk-lib";
import axios from "axios";
import { MockApiIntegration } from "../src";
import { localstackTestSuite } from "./localstack";

localstackTestSuite("apiGatewayStack", (test, stack) => {
  test(
    "mock integration",
    () => {
      const api = new aws_apigateway.RestApi(stack, "MockAPI");
      const code = api.root.addResource("{code}");
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
      }).addMethod("GET", code);

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
});
