import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { App, Stack } from "aws-cdk-lib";
import { AppsyncResolver } from "../../src";

const app = new App({
  autoSynth: false,
});
const stack = new Stack(app, "stack");

const api = new appsync.GraphqlApi(stack, "API", {
  name: "api",
});

new AppsyncResolver(
  stack,
  "getPost",
  {
    api,
    typeName: "Query",
    fieldName: "getPost",
  },
  // valid - inline arrow function
  () => null
);

new AppsyncResolver(
  stack,
  "getPost",
  {
    api,
    typeName: "Query",
    fieldName: "getPost",
  },
  // valid - inline function expression
  function () {
    return null;
  }
);

const f = () => null;
new AppsyncResolver(
  stack,
  "getPost",
  {
    api,
    typeName: "Query",
    fieldName: "getPost",
  },
  // invalid - must be an inline function
  f
);

new AppsyncResolver(
  stack,
  "getPost",
  {
    api,
    typeName: "Query",
    fieldName: "getPost",
  },
  // invalid - must be an inline function
  (
    () => () =>
      null
  )()
);
