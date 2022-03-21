import { App, aws_events, Stack } from "aws-cdk-lib";
import {
  AppsyncResolver,
  EventBusRuleInput,
  EventTransformFunction,
  FunctionDecl,
} from "../src";

import * as appsync from "@aws-cdk/aws-appsync-alpha";
import path from "path";
import { synthesizeEventPattern } from "../src/eventbridge/eventpattern";
import { FnLsEventPattern } from "../src/eventbridge/eventpattern/types";
import { synthesizeEventBridgeTargets } from "../src/eventbridge/targets";
import { Rule } from "aws-cdk-lib/aws-events";

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

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

export function ebEventTargetTestCase<T extends EventBusRuleInput>(
  decl: FunctionDecl<EventTransformFunction<T>>,
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

  expect(stack.resolve(recievedInput)).toEqual(stack.resolve(expectedInput));

  expect(stack.resolve(recievedTemplate)).toEqual(
    stack.resolve(expectedTemplate)
  );

  expect(recieved).toEqual(expected);
}

export function ebEventTargetTestCaseError<T extends EventBusRuleInput>(
  decl: FunctionDecl<EventTransformFunction<T>>,
  message?: string
) {
  expect(() => synthesizeEventBridgeTargets(decl)).toThrow(message);
}
