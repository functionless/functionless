import { App, aws_events, Stack } from "aws-cdk-lib";
import { AppsyncResolver, EventBusRuleInput, FunctionDecl } from "../src";

import * as appsync from "@aws-cdk/aws-appsync-alpha";
import path from "path";
import { synthesizeEventPattern } from "../src/event-bridge/event-pattern";
import { FunctionlessEventPattern } from "../src/event-bridge/event-pattern/types";
import { Rule } from "aws-cdk-lib/aws-events";
import { Err, isErr } from "../src/error";
import { EventTransformFunction } from "../src/event-bridge/transform";
import { synthesizeEventBridgeTargets } from "../src/event-bridge/target-input";

// generates boilerplate for the circuit-breaker logic for implementing early return
export function returnExpr(varName: string) {
  return `#set($context.stash.return__val = ${varName})
#set($context.stash.return__flag = true)
#return($context.stash.return__val)`;
}

export function appsyncTestCase(
  decl: FunctionDecl | Err,
  ...expected: string[]
) {
  const app = new App({ autoSynth: false });
  const stack = new Stack(app, "stack");

  if (isErr(decl)) {
    throw decl.error;
  }

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
  decl: FunctionDecl | Err,
  expected: FunctionlessEventPattern
) {
  const result = synthesizeEventPattern(decl);

  expect(result).toEqual(expected);
}

export function ebEventPatternTestCaseError(
  decl: FunctionDecl | Err,
  message?: string
) {
  expect(() => synthesizeEventPattern(decl)).toThrow(message);
}

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

export function ebEventTargetTestCase<T extends EventBusRuleInput>(
  decl: FunctionDecl<EventTransformFunction<T>> | Err,
  targetInput: aws_events.RuleTargetInput
) {
  const result = synthesizeEventBridgeTargets(decl);

  const rule = new Rule(stack, "testrule");

  // input template can contain tokens, lets fix that.

  const {
    inputTemplate: recievedTemplate,
    input: recievedInput,
    ...recieved
  } = result.bind(rule);
  const {
    inputTemplate: expectedTemplate,
    input: expectedInput,
    ...expected
  } = targetInput.bind(rule);

  expect({
    ...recieved,
    inputTemplate: stack.resolve(recievedTemplate),
    input: stack.resolve(recievedInput),
  }).toEqual({
    ...expected,
    inputTemplate: stack.resolve(expectedTemplate),
    input: stack.resolve(expectedInput),
  });
}

export function ebEventTargetTestCaseError<T extends EventBusRuleInput>(
  decl: FunctionDecl<EventTransformFunction<T>> | Err,
  message?: string
) {
  expect(() => synthesizeEventBridgeTargets(decl)).toThrow(message);
}
