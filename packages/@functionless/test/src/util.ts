import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { AnyFunction, isErr, reflect } from "@functionless/ast";
import {
  AmplifyAppSyncSimulator,
  AmplifyAppSyncSimulatorAuthenticationType,
  AppSyncGraphQLExecutionContext,
} from "amplify-appsync-simulator";
import * as amplify from "amplify-appsync-simulator/lib/velocity";
import { App, aws_dynamodb, aws_lambda, Stack } from "aws-cdk-lib";

import { Function } from "@functionless/aws-lambda-constructs";
import {
  AppsyncResolver,
  ResolverArguments,
  ResolverFunction,
} from "@functionless/aws-appsync-constructs";
import { Table } from "@functionless/aws-dynamodb-constructs";

// generates boilerplate for the circuit-breaker logic for implementing early return
export function returnExpr(varName: string) {
  return `#set($context.stash.return__val = ${varName})
#set($context.stash.return__flag = true)
#return($context.stash.return__val)`;
}

export function getAppSyncTemplates(decl: AnyFunction): string[] {
  const app = new App({ autoSynth: false });
  const stack = new Stack(app, "stack");

  if (isErr(decl)) {
    throw decl.error;
  }

  const schema = new appsync.Schema({
    filePath: path.join(__dirname, "..", "schema.gql"),
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

  const appsyncFunction = new AppsyncResolver(
    stack,
    "Resolver",
    {
      api,
      typeName: "Query",
      fieldName: "getPerson",
    },
    decl as any
  );
  return appsyncFunction.resolvers().templates;
}

export type DeepPartial<T extends object> = {
  [k in keyof T]: T[k] extends object ? DeepPartial<T[k]> : T[k];
};

export interface AppSyncVTLRenderContext<
  Arguments extends object = object,
  Source extends object | undefined = undefined
> extends Omit<amplify.AppSyncVTLRenderContext, "arguments" | "source"> {
  arguments: Arguments;
  source?: Source;
}

export function appsyncTestCase<
  Arguments extends ResolverArguments,
  Result,
  Source extends object | undefined = undefined
>(
  decl: ResolverFunction<Arguments, Result, Source>,
  config?: {
    /**
     * Template count is generally [total integrations] * 2 + 2
     */
    expectedTemplateCount?: number;
  }
) {
  const actual = getAppSyncTemplates(reflect(decl) as any);

  config?.expectedTemplateCount &&
    expect(actual).toHaveLength(config.expectedTemplateCount);

  expect(normalizeCDKJson(actual)).toMatchSnapshot();

  return actual;
}

const simulator = new AmplifyAppSyncSimulator();
export function testAppsyncVelocity<
  Arguments extends ResolverArguments,
  Source extends object | undefined = undefined
>(
  vtl: string,
  props?: Omit<AppSyncVTLRenderContext<Arguments, Source>, "arguments"> & {
    /**
     * Input and context data for VTL execution
     *
     * @default {}
     */
    arguments?: AppSyncVTLRenderContext<Arguments, Source>["arguments"];
    /**
     * Partial object to match against the output using `expect().matchObject`
     */
    resultMatch?: string | Record<string, any>;
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
  }
) {
  const template = new amplify.VelocityTemplate(
    { content: vtl.replace(/\$null/g, "$___nil"), path: "test.json" },
    simulator
  );

  const {
    arguments: args = {},
    source = {},
    resultMatch,
    requestContext,
    returned,
  } = props ?? {};

  const result = template.render(
    { arguments: args, source },
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
  if (typeof resultMatch === "string") {
    expect(json).toEqual(resultMatch);
  } else if (typeof resultMatch === "object") {
    expect(json).toMatchObject(resultMatch);
  }
  returned !== undefined && expect(result.isReturn).toEqual(returned);
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

  const personTable = Table.fromTable<Person, "id">(
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

export const normalizeCDKJson = (json: object) => {
  return JSON.parse(
    JSON.stringify(json)
      .replace(/\$\{Token\[[a-zA-Z0-9.-_]*\]\}/g, "__REPLACED_TOKEN")
      // do not replace arns that are for aws sdk service integrations
      .replace(/\"arn:(?!aws:states:::)[^\"]*\"/g, `"__REPLACED_ARN"`)
  );
};
