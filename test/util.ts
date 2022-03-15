import { App, Stack } from "aws-cdk-lib";
import { AppsyncResolver, FunctionDecl, reflect } from "../src";

import * as appsync from "@aws-cdk/aws-appsync-alpha";
import path from "path";
import { EventBusEvent, EventPredicateFunction } from "../src/eventbridge";
import { FnLsEventPattern, synthesizeEventPattern } from "../src/eventpattern";

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

export function ebEventPatternTestCase<
  E extends EventBusEvent = EventBusEvent<any>
>(predicate: EventPredicateFunction<E>, expected: FnLsEventPattern) {
  const result = synthesizeEventPattern(reflect(predicate));

  expect(result).toEqual(expected);
}

export function ebEventPatternTestCaseError<
  E extends EventBusEvent = EventBusEvent<any>
>(predicate: EventPredicateFunction<E>, message?: string) {
  expect(() => synthesizeEventPattern(reflect(predicate))).toThrow(message);
}
