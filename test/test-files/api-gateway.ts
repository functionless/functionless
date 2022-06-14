import { App, aws_apigateway, Stack } from "aws-cdk-lib";
import { AwsMethod, Function } from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

const func = new Function(stack, "func", async () => {
  return "hello";
});

const api = new aws_apigateway.RestApi(stack, "API");

// VALID
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) => {
    return func($input.data);
  },
  ($input) => $input.data
);

// INVALID - missing integration call in request
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) => {
    return $input.data;
  },
  ($input) => $input.data
);
