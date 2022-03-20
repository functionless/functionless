import { App, aws_events, Stack } from "aws-cdk-lib";
import { AppsyncResolver, FunctionDecl } from "../src";

import * as appsync from "@aws-cdk/aws-appsync-alpha";
import path from "path";
import { synthesizeEventPattern } from "../src/eventbridge/eventpattern";
import { FnLsEventPattern } from "../src/eventbridge/eventpattern/types";
import { synthesizeEventBridgeTargets } from "../src/eventbridge/targets";

// generates boilerplate for the circuit-breaker logic for implementing early return
export function returnExpr(varName: string) {
  return `#set($context.stash.return__val = ${varName})
#set($context.stash.return__flag = true)
#return($context.stash.return__val)`;
}

export function appsyncTestCase(decl: FunctionDecl, ...expected: string[]) {
  const app = new App({ autoSynth: false });
  const stack = new Stack(app, "stack");

  const schema = new appsync.Schema({
    filePath: path.join(__dirname, "..", "test-app", "schema.gql"),
  });

  const api = new appsync.GraphqlApi(stack, "Api", {
    name: "demo",
    schema,
    authorizationConfig: {
      defaultAuthorization: {
        authorizationType: appsync.AuthorizationType.IAM,
      },
    },
    xrayEnabled: true,
  });

  const appsyncFunction = new AppsyncResolver(decl as any);
  const actual = appsyncFunction.addResolver(api, {
    typeName: "Query",
    fieldName: "getPerson",
  }).templates;

  expect(actual).toEqual(expected);
}

export function ebEventPatternTestCase(
  decl: FunctionDecl,
  expected: FnLsEventPattern
) {
  const result = synthesizeEventPattern(decl);

  expect(result).toEqual(expected);
}

export function ebEventPatternTestCaseError(
  decl: FunctionDecl,
  message?: string
) {
  expect(() => synthesizeEventPattern(decl)).toThrow(message);
}

export function ebEventTargetTestCase(
  decl: FunctionDecl,
  ...targets: aws_events.IRuleTarget[]
) {
  const result = synthesizeEventBridgeTargets(decl);

  expect(result).toEqual(targets);
}

export function ebEventTargetTestCaseError(
  decl: FunctionDecl,
  message?: string
) {
  expect(() => synthesizeEventBridgeTargets(decl)).toThrow(message);
}
