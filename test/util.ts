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
  Event,
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

/**
 *
 * @param decl
 * @param executeTemplates an array of templates to execute using the {@link AmplifyAppSyncSimulator}
 *                         `context` can be used to pass inputs
 *                         a snapshot will be taken of the results
 *                         to test specific contents like CDK Tokens (arns, attr, etc) use
 *                         `expected.match` with a partial output.
 *                         To assert that the template returns, pass `expected.returned: true`.
 */
export function appsyncTestCase(
  decl: FunctionDecl | Err,
  config?: {
    /**
     * Template count is generally [total integrations] * 2 + 2
     */
    expectedTemplateCount?: number;
    executeTemplates?: {
      /**
       * Index of the template to execute.
       */
      index: number;
      /**
       * Input and context data for VTL execution
       *
       * @default { arguments: {}, source: {} }
       */
      context?: AppSyncVTLRenderContext;
      /**
       * Partial object to match against the output using `expect().matchObject`
       */
      match?: Record<string, any>;
      /**
       * Assert true if the function returns, false if it shouldn't
       *
       * @default nothing
       */
      returned?: boolean;
      /**
       * Additional context data for VTL
       */
      requestContext?: AppSyncGraphQLExecutionContext;
    }[];
  }
) {
  const actual = getAppSyncTemplates(decl);

  config?.expectedTemplateCount &&
    expect(actual).toHaveLength(config.expectedTemplateCount);

  expect(normalizeCDKJson(actual)).toMatchSnapshot();

  config?.executeTemplates?.forEach((testCase) => {
    const vtl = actual[testCase.index];
    appsyncVelocityJsonTestCase(
      vtl,
      testCase.context,
      { match: testCase.match, returned: testCase.returned },
      testCase.requestContext
    );
  });
}

const simulator = new AmplifyAppSyncSimulator();
function appsyncVelocityJsonTestCase(
  vtl: string,
  context?: AppSyncVTLRenderContext,
  expected?: { match?: Record<string, any>; returned?: boolean },
  requestContext?: AppSyncGraphQLExecutionContext
) {
  const template = new VelocityTemplate(
    { content: vtl, path: "test.json" },
    simulator
  );

  const result = template.render(
    context ?? { arguments: {}, source: {} },
    requestContext ?? {
      headers: {},
      requestAuthorizationMode:
        AmplifyAppSyncSimulatorAuthenticationType.OPENID_CONNECT,
    },
    // various errors when the simulator is missing these
    { fieldNodes: [], path: "test.json" } as any
  );

  expect(result.errors).toHaveLength(0);

  const json = JSON.parse(JSON.stringify(result.result));

  expect(normalizeCDKJson(json)).toMatchSnapshot();
  expected?.match !== undefined && expect(json).toMatchObject(expected.match);
  expected?.returned !== undefined &&
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

  const lambda = new aws_lambda.Function(stack, "F", {
    code: aws_lambda.Code.fromInline(
      "exports.handler = function() { return null; }"
    ),
    handler: "index.handler",
    runtime: aws_lambda.Runtime.NODEJS_14_X,
    functionName: "testFunction",
  });

  // These functions do not actually execute.
  const getPerson = Function.fromFunction<{ id: string }, Person | undefined>(
    lambda
  );

  const task = Function.fromFunction<any, number | null>(lambda);

  const computeScore = Function.fromFunction<Person, number>(lambda);

  const personTable = new Table<Person, "id">(
    new aws_dynamodb.Table(stack, "Table", {
      partitionKey: {
        name: "id",
        type: aws_dynamodb.AttributeType.STRING,
      },
      tableName: "testTable",
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

export function ebEventTargetTestCase<T extends Event>(
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

export function ebEventTargetTestCaseError<T extends Event>(
  decl: FunctionDecl<EventTransformFunction<T>> | Err,
  message?: string
) {
  expect(() => synthesizeEventBridgeTargets(decl)).toThrow(message);
}

export const normalizeCDKJson = (json: object) => {
  return JSON.parse(
    JSON.stringify(json).replace(
      /\$\{Token\[[a-zA-Z0-9.]*\]\}/g,
      "__REPLACED_TOKEN"
    )
  );
};
