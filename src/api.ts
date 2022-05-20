// TODO:
//   grab input to integration, add to requestTemplate
//   only need to stash variables in request template
//   handle special case: no templates?
//   handle DDB
//   merge, handle StepFunctions
//   merge, handle EB
//   should it be API Method? how to add type safety
//   investigate map/pipe/map approach
//   handle cannot return before calling integration

import { aws_apigateway as apigw } from "aws-cdk-lib";
import { FunctionDecl, isFunctionDecl } from "./declaration";
import { isErr } from "./error";
import { findDeepIntegration } from "./integration";
import { ApiGWVTL } from "./vtl";

type ParameterMap = Record<string, string | number | boolean>;

export interface ApiRequestProps<
  PathParams extends ParameterMap | undefined,
  Body extends any,
  QueryParams extends ParameterMap | undefined,
  HeaderParams extends ParameterMap | undefined
> {
  pathParameters?: PathParams;
  body?: Body;
  queryStringParameters?: QueryParams;
  headers?: HeaderParams;
}

export abstract class ApiRequest<
  Props extends ApiRequestProps<any, any, any, any>
> {
  readonly pathParameters: Props["pathParameters"];
  readonly body: Props["body"];
  readonly queryStringParameters: Props["queryStringParameters"];
  readonly headers: Props["headers"];

  constructor(props: Props) {
    this.pathParameters = props.pathParameters;
    this.body = props.body;
    this.queryStringParameters = props.queryStringParameters;
    this.headers = props.headers;
  }
}

export type IntegrationFunction<Request extends ApiRequest<any>, Result> = (
  $input: Request
) => Result;

export class ApiIntegration<Input extends ApiRequest<any>, Result> {
  /**
   * This static property identifies this class as an ApiIntegration to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "ApiIntegration";

  readonly decl: FunctionDecl<IntegrationFunction<Input, Result>>;

  constructor(fn: IntegrationFunction<Input, Result>) {
    if (isFunctionDecl(fn)) {
      this.decl = fn;
    } else if (isErr(fn)) {
      throw fn.error;
    } else {
      throw Error("Unknown compiler error.");
    }
  }

  addIntegration(resource: apigw.IResource) {
    const { requestTemplate, responseTemplate } = synthesizeTemplates(
      this.decl
    );

    console.log(requestTemplate);
    console.log(responseTemplate);

    const integration = new apigw.MockIntegration({
      ...(requestTemplate && {
        requestTemplates: { "application/json": requestTemplate },
      }),
      ...(responseTemplate && {
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: { "application/json": responseTemplate },
          },
        ],
      }),
    });

    const method = resource.addMethod("GET", integration, {
      methodResponses: [
        {
          statusCode: "200",
          responseParameters: {},
        },
      ],
    });
    return method;
  }
}

export function synthesizeTemplates(fn: FunctionDecl): {
  requestTemplate?: string;
  responseTemplate?: string;
} {
  const integrationCount = countIntegrations(fn);

  // TODO: move this to constructor?
  if (integrationCount > 1) {
    throw Error(
      // TODO: improve
      `Expected function to have at most one integration, but found ${integrationCount}`
    );
  }

  const requestTemplate = new ApiGWVTL();
  requestTemplate.add("#set($Integer = 0)");
  requestTemplate.add("#set($context.requestOverride.path.stash = {})");
  const responseTemplate = new ApiGWVTL();
  responseTemplate.add("#set($Integer = 0)");

  if (integrationCount === 0) {
    requestTemplate.add(`{ "statusCode": 200 }`);

    for (const stmt of fn.body.statements) {
      responseTemplate.eval(stmt);
    }
  } else {
    throw "TODO";
  }

  return {
    requestTemplate: requestTemplate.toVTL(),
    responseTemplate: responseTemplate.toVTL(),
  };
}

function countIntegrations(decl: FunctionDecl): number {
  return decl.body.statements.filter(
    (expr) => findDeepIntegration(expr) !== undefined
  ).length;
}
