import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import {
  AmplifyAppSyncSimulator,
  AmplifyAppSyncSimulatorAuthenticationType,
  AppSyncGraphQLExecutionContext,
} from "amplify-appsync-simulator";
import {
  AppSyncVTLRenderContext,
  VelocityTemplate,
} from "amplify-appsync-simulator/lib/velocity";
import { App, aws_dynamodb, aws_events, aws_lambda, Stack } from "aws-cdk-lib";
import { Rule } from "aws-cdk-lib/aws-events";
import {
  AppsyncResolver,
  FunctionDecl,
  Table,
  Function,
  EventBusEvent,
  FunctionlessEventPattern,
} from "../src";

import { Err, isErr } from "../src/error";
import {
  synthesizeEventPattern,
  synthesizePatternDocument,
} from "../src/event-bridge/event-pattern/synth";
import { synthesizeEventBridgeTargets } from "../src/event-bridge/target-input";
import { EventTransformFunction } from "../src/event-bridge/transform";

// generates boilerplate for the circuit-breaker logic for implementing early return
export function returnExpr(varName: string) {
  return `#set($context.stash.return__val = ${varName})
#set($context.stash.return__flag = true)
#return($context.stash.return__val)`;
}

export function getAppSyncTemplates(decl: FunctionDecl | Err): string[] {
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
  return appsyncFunction.addResolver(api, {
    typeName: "Query",
    fieldName: "getPerson",
  }).templates;
}

export function appsyncTestCase(
  decl: FunctionDecl | Err,
  ...expected: string[]
) {
  const actual = getAppSyncTemplates(decl);

  expect(actual).toEqual(expected);
}

const simulator = new AmplifyAppSyncSimulator();
export function appsyncVelocityJsonTestCase(
  vtl: string,
  context: AppSyncVTLRenderContext,
  expected: { result: Record<string, any>; returned?: boolean },
  requestContext?: AppSyncGraphQLExecutionContext
) {
  const template = new VelocityTemplate(
    { content: vtl, path: "test.json" },
    simulator
  );

  const result = template.render(
    context,
    requestContext ?? {
      headers: {},
      requestAuthorizationMode:
        AmplifyAppSyncSimulatorAuthenticationType.OPENID_CONNECT,
    },
    // various errors when the simulator is missing these
    { fieldNodes: [], path: "test.json" } as any
  );

  expect(result.errors).toHaveLength(0);

  expect(JSON.parse(JSON.stringify(result.result))).toEqual(expected.result);
  expected.returned !== undefined &&
    expect(result.isReturn).toEqual(expected.returned);
}

export interface Person {
  id: string;
  name: string;
}

export function initStepFunctionApp() {
  const app = new App({
    autoSynth: false,
  });
  const stack = new Stack(app, "stack");

  const getPerson = new Function<{ id: string }, Person | undefined>(
    new aws_lambda.Function(stack, "Func", {
      code: aws_lambda.Code.fromInline(
        "exports.handle = function() { return {id: 'id', name: 'name' }; }"
      ),
      handler: "index.handle",
      runtime: aws_lambda.Runtime.NODEJS_14_X,
    })
  );

  const task = new Function<any, number | null>(
    new aws_lambda.Function(stack, "Task", {
      code: aws_lambda.Code.fromInline(
        "exports.handle = function() { return 1; }"
      ),
      handler: "index.handle",
      runtime: aws_lambda.Runtime.NODEJS_14_X,
    })
  );

  const computeScore = new Function<Person, number>(
    new aws_lambda.Function(stack, "ComputeScore", {
      code: aws_lambda.Code.fromInline(
        "exports.handle = function() { return 1; }"
      ),
      handler: "index.handle",
      runtime: aws_lambda.Runtime.NODEJS_14_X,
    })
  );

  const personTable = new Table<Person, "id">(
    new aws_dynamodb.Table(stack, "Table", {
      partitionKey: {
        name: "id",
        type: aws_dynamodb.AttributeType.STRING,
      },
    })
  );

  return { stack, task, computeScore, getPerson, personTable };
}

export function ebEventPatternTestCase(
  decl: FunctionDecl | Err,
  expected: FunctionlessEventPattern
) {
  const document = synthesizePatternDocument(decl);
  const result = synthesizeEventPattern(document);

  expect(result).toEqual(expected);
}

export function ebEventPatternTestCaseError(
  decl: FunctionDecl | Err,
  message?: string
) {
  expect(() => {
    const document = synthesizePatternDocument(decl);
    synthesizeEventPattern(document);
  }).toThrow(message);
}

let stack: Stack;

beforeEach(() => {
  stack = new Stack();
});

export function ebEventTargetTestCase<T extends EventBusEvent>(
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

export function ebEventTargetTestCaseError<T extends EventBusEvent>(
  decl: FunctionDecl<EventTransformFunction<T>> | Err,
  message?: string
) {
  expect(() => synthesizeEventBridgeTargets(decl)).toThrow(message);
}
