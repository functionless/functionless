import { App, aws_apigateway, aws_dynamodb, Stack } from "aws-cdk-lib";
import { $AWS, AwsMethod, Function, Table } from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

const func = new Function(stack, "func", async () => {
  return "hello";
});

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

// VALID
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) =>
    $AWS.DynamoDB.GetItem({
      TableName: table,
      Key: {
        id: {
          S: $input.params("id") as string,
        },
      },
    }),
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

// INVALID - uses a spread and computed property name
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) => {
    return $AWS.DynamoDB.GetItem({
      TableName: table,
      ...$input.data,
      [$input.params("param")]: null,
    });
  },
  ($input) => $input.data
);

// INVALID - calls an integration from within a response
new AwsMethod(
  {
    httpMethod: "GET",
    resource: api.root,
  },
  ($input) =>
    $AWS.DynamoDB.GetItem({
      TableName: table,
      Key: {
        id: {
          S: $input.params("id") as string,
        },
      },
    }),
  ($input) => {
    // this is not allowed
    return $AWS.DynamoDB.GetItem({
      TableName: table,
      Key: {
        id: {
          S: $input.params("id") as string,
        },
      },
    });
  }
);
