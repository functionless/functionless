import { aws_apigateway } from "aws-cdk-lib";
import { FunctionDecl, isFunctionDecl } from "./declaration";
import { isErr } from "./error";
import { isIdentifier, PropAccessExpr } from "./expression";
import { Function } from "./function";
import { FunctionlessNode } from "./node";
import { ExpressStepFunction } from "./step-function";

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

type RequestTransformerFunction<
  Request extends ApiRequestProps<any, any, any, any>,
  IntegrationRequest
> = (req: Request) => IntegrationRequest;

type ResponseTransformerFunction<IntegrationResponse, MethodResponse> = (
  resp: IntegrationResponse
) => MethodResponse;

// @ts-ignore
type IntegrationTarget<IntegrationRequest, IntegrationResponse> =
  | Function<IntegrationRequest, IntegrationResponse>
  | ExpressStepFunction<IntegrationRequest, IntegrationResponse>;
// | Table<any, any>["getItem"];

//#region

export class ApiIntegration<
  Request extends ApiRequestProps<any, any, any, any>,
  IntegrationRequest = Request,
  IntegrationResponse = any,
  MethodResponse = any
> {
  /**
   * This static property identifies this class as an ApiIntegration to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "ApiIntegration";
  readonly functionlessKind = "ApiIntegration";

  private readonly requestTransformer: FunctionDecl | undefined;
  private readonly integration:
    | IntegrationTarget<IntegrationRequest, IntegrationResponse>
    | undefined;
  // @ts-ignore
  private readonly responseTransformer: FunctionDecl | undefined;

  public constructor();
  public constructor(
    requestTransformer?: RequestTransformerFunction<Request, IntegrationRequest>
  );
  public constructor(
    requestTransformer?: FunctionDecl,
    integration?: IntegrationTarget<IntegrationRequest, IntegrationResponse>
  );
  public constructor(
    requestTransformer?: FunctionDecl,
    integration?: IntegrationTarget<IntegrationRequest, IntegrationResponse>,
    responseTransformer?: ResponseTransformerFunction<
      IntegrationResponse,
      MethodResponse
    >
  );
  public constructor(
    requestTransformer?:
      | RequestTransformerFunction<Request, IntegrationRequest>
      | FunctionDecl,
    integration?: IntegrationTarget<IntegrationRequest, IntegrationResponse>,
    responseTransformer?:
      | ResponseTransformerFunction<IntegrationResponse, MethodResponse>
      | FunctionDecl
  ) {
    if (requestTransformer) {
      if (isFunctionDecl(requestTransformer)) {
        this.requestTransformer = requestTransformer;
      } else if (isErr(requestTransformer)) {
        throw requestTransformer.error;
      } else {
        throw Error("Unknown compiler error.");
      }
    }
    if (responseTransformer) {
      if (isFunctionDecl(responseTransformer)) {
        this.responseTransformer = responseTransformer;
      } else if (isErr(responseTransformer)) {
        throw responseTransformer.error;
      } else {
        throw Error("Unknown compiler error.");
      }
    }
    this.integration = integration;
  }

  transformRequest<I>(
    requestTransformer: RequestTransformerFunction<Request, I>
  ): ApiIntegration<Request, I, IntegrationResponse> {
    return new ApiIntegration<Request, I, IntegrationResponse>(
      requestTransformer
    );
  }

  call<I>(
    integration: IntegrationTarget<IntegrationRequest, I>
  ): ApiIntegration<Request, IntegrationRequest, I> {
    return new ApiIntegration<Request, IntegrationRequest, I>(
      this.requestTransformer,
      integration
    );
  }

  handleResponse<T>(
    responseTransformer: ResponseTransformerFunction<IntegrationResponse, T>
  ): ApiIntegration<Request, IntegrationRequest, IntegrationResponse, T> {
    return new ApiIntegration<
      Request,
      IntegrationRequest,
      IntegrationResponse,
      T
    >(this.requestTransformer, this.integration, responseTransformer);
  }

  addMethod(resource: aws_apigateway.Resource): void {
    // const resource = api.root.addResource(path);

    let apigwIntegration: aws_apigateway.Integration;

    let requestTemplate: string | undefined;
    if (this.requestTransformer) {
      requestTemplate = toVTL(this.requestTransformer, "request");
    }

    let responseTemplate: string | undefined;
    if (this.responseTransformer) {
      responseTemplate = toVTL(this.responseTransformer, "response");
    }

    if (!this.integration) {
      apigwIntegration = new aws_apigateway.MockIntegration({
        requestTemplates: {
          "application/json": '{ "statusCode": 200 }',
        },
      });
    } else {
      // TODO: PASSTHROUGH BEHAVIOR
      // const integrationProps: aws_apigateway.LambdaIntegrationOptions = {
      //   integrationResponses: [
      //     {
      //       statusCode: "200",
      //       responseTemplates: {
      //         // TODO: what if there is no response template?
      //         "application/json": responseTemplate!,
      //       },
      //     },
      //   ],
      //   ...(requestTemplate
      //     ? {
      //         requestTemplates: { "application/json": requestTemplate },
      //         proxy: false,
      //       }
      //     : { proxy: true }),
      // };
      apigwIntegration = this.integration.apiGWVtl.integration(
        requestTemplate!,
        responseTemplate!
      );
    }

    resource.addMethod("GET", apigwIntegration, {
      requestParameters: {
        "method.request.path.num": true,
      },
      methodResponses: [
        {
          statusCode: "200",
        },
      ],
    });
  }
}

//#endregion

export class ApiIntegrations {
  public static mock<
    Request extends ApiRequestProps<any, any, any, any>,
    StatusCode extends number,
    MethodResponses extends { [C in StatusCode]: any }
  >(
    props: MockIntegrationProps<Request, StatusCode, MethodResponses>
  ): MockApiIntegration<typeof props> {
    return new MockApiIntegration(props);
  }

  public static aws<
    Request extends ApiRequestProps<any, any, any, any>,
    IntegrationRequest,
    IntegrationResponse,
    MethodResponse
  >(
    props: AwsApiIntegrationProps<
      Request,
      IntegrationRequest,
      IntegrationResponse,
      MethodResponse
    >
  ): AwsApiIntegration<typeof props> {
    return new AwsApiIntegration(props);
  }
}

export interface MockIntegrationProps<
  Request extends ApiRequestProps<any, any, any, any>,
  StatusCode extends number,
  MethodResponses extends { [C in StatusCode]: any }
> {
  request: (req: Request) => { statusCode: StatusCode };
  responses: { [C in StatusCode]: (code: C) => MethodResponses[C] };
}

// https://devblogs.microsoft.com/typescript/announcing-typescript-4-7/#improved-function-inference-in-objects-and-methods
// https://github.com/microsoft/TypeScript/pull/41712

export class MockApiIntegration<
  Props extends MockIntegrationProps<any, any, any>
> {
  /**
   * This static property identifies this class as an AwsApiIntegration to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "MockApiIntegration";

  private readonly request: FunctionDecl;
  private readonly responses: { [K in keyof Props["responses"]]: FunctionDecl };

  public constructor(props: Props) {
    this.request = this.validateTemplateFunc(props.request);
    // @ts-ignore
    this.responses = Object.fromEntries(
      Object.entries(props.responses).map(([k, v]) => [
        k,
        this.validateTemplateFunc(v),
      ])
    );
  }

  private validateTemplateFunc(a: any): FunctionDecl {
    if (isFunctionDecl(a)) {
      return a;
    } else if (isErr(a)) {
      throw a.error;
    } else {
      // TODO: better error
      throw Error("Unknown compiler error.");
    }
  }

  addMethod(resource: aws_apigateway.Resource): void {
    const requestTemplate = `#set($Integer = 0)\n${toVTL(
      this.request,
      "request"
    )}`;

    const x: [string, FunctionDecl][] = Object.entries(this.responses);

    const integrationResponses: aws_apigateway.IntegrationResponse[] = x.map(
      ([statusCode, fn]) => ({
        statusCode,
        responseTemplates: {
          "application/json": `#set($Integer = 0)\n${toVTL(fn, "response")}`,
        },
        selectionPattern: `^${statusCode}$`,
      })
    );

    const integration = new aws_apigateway.MockIntegration({
      requestTemplates: {
        "application/json": requestTemplate,
      },
      integrationResponses,
    });

    const methodResponses = Object.keys(this.responses).map((statusCode) => ({
      statusCode,
    }));

    resource.addMethod("GET", integration, {
      requestParameters: {
        "method.request.path.num": true,
      },
      methodResponses,
    });
  }
}

export interface AwsApiIntegrationProps<
  Request extends ApiRequestProps<any, any, any, any>,
  IntegrationRequest,
  IntegrationResponse,
  MethodResponse
> {
  request: RequestTransformerFunction<Request, IntegrationRequest>;
  integration: ExpressStepFunction<IntegrationRequest, IntegrationResponse>;
  response: ResponseTransformerFunction<IntegrationResponse, MethodResponse>;

  readonly __requestBrand?: Request;
  readonly __integrationRequestBrand?: IntegrationRequest;
  readonly __integrationResponseBrand?: IntegrationResponse;
  readonly __methodResponseBrand?: MethodResponse;
}

// export class AwsApiIntegration<
//   Request extends ApiRequestProps<any, any, any, any>,
//   IntegrationRequest = any,
//   IntegrationResponse = any,
//   MethodResponse = any
// > {
export class AwsApiIntegration<
  Props extends AwsApiIntegrationProps<any, any, any, any>
> {
  /**
   * This static property identifies this class as an AwsApiIntegration to the TypeScript plugin.
   */
  public static readonly FunctionlessType = "AwsApiIntegration";

  private readonly request: FunctionDecl;
  private readonly response: FunctionDecl;
  private readonly integration: ExpressStepFunction<
    Props["__requestBrand"],
    Props["__integrationResponseBrand"]
  >;

  constructor(props: Props) {
    this.request = this.validateTemplateFunc(props.request);
    this.response = this.validateTemplateFunc(props.response);
    this.integration = props.integration;
  }

  private validateTemplateFunc(a: any): FunctionDecl {
    if (isFunctionDecl(a)) {
      return a;
    } else if (isErr(a)) {
      throw a.error;
    } else {
      // TODO: better error
      throw Error("Unknown compiler error.");
    }
  }

  addMethod(resource: aws_apigateway.Resource): void {
    const requestTemplate = toVTL(this.request, "request");
    const responseTemplate = toVTL(this.response, "response");

    const apiGWIntegration = this.integration.apiGWVtl.integration(
      requestTemplate,
      responseTemplate
    );

    // TODO: pass in method
    // TODO: pass in responses
    resource.addMethod("GET", apiGWIntegration, {
      requestParameters: {
        "method.request.path.num": true,
      },
      methodResponses: [
        {
          statusCode: "200",
        },
      ],
    });
  }
}

function toVTL(node: FunctionDecl, template: "request" | "response") {
  console.log(template);

  //   const base = `#set($Integer = 0)
  // #set($inputRoot = $input.path('$'))`;

  const statements = node.body.statements.map((stmt) => inner(stmt)).join("\n");

  return statements;

  // return `${base}\n${statements}`;

  function inner(node: FunctionlessNode): string {
    switch (node.kind) {
      // case "Identifier":
      //   return node.name;

      case "ArrayLiteralExpr":
        return `[${node.children.map(inner).join(",")}]`;

      case "BinaryExpr":
        throw "TODO";
      // return `${inner(node.left)} ${node.op} ${inner(node.right)}`;

      case "BooleanLiteralExpr":
        return node.value.toString();

      case "NumberLiteralExpr":
        return node.value.toString();

      case "ObjectLiteralExpr":
        return `{${node.properties.map(inner).join(",")}}`;

      case "PropAccessExpr":
        if (descendedFromFunctionParameter(node)) {
          if (template === "request") {
            // guaranteed that node.expr is a PropAccessExpr by descentFromFunctionParameter
            const location = (node.expr as PropAccessExpr).name;
            // TODO: should we just rename these?
            const location2 =
              location === "pathParameters"
                ? "path"
                : location === "queryStringParameters"
                ? "querystring"
                : "header";

            // TODO: can't refer to $input.pathParameters directly, need casting
            const param = `$input.params().${location2}.${node.name}`;

            // TODO: what about others?
            if (node.type === "string") {
              return `"${param}"`;
            }

            return param;
          } else {
            const param = `$inputRoot.${node.name}`;
            if (node.type === "string") {
              return `"${param}"`;
            }
            return param;
          }
        }
        return `${inner(node.expr)}.${node.name};`;

      case "PropAssignExpr":
        // if (node.name.kind === "StringLiteralExpr") {
        //   return `${node.name.value}: ${inner(node.expr)}`;
        // } else if (node.name.kind === "Identifier") {
        //   return `${node.name.name}: ${inner(node.expr)}`;
        // } else {
        //   throw "TODO";
        // }
        return `${inner(node.name)}: ${inner(node.expr)}`;

      case "ReturnStmt":
        return inner(node.expr);

      case "StringLiteralExpr":
        return `"${node.value}"`;
    }
    throw node.kind;
  }
}

const isFunctionParameter = (node: FunctionlessNode) => {
  if (!isIdentifier(node)) return false;
  const ref = node.lookup();
  return ref?.kind === "ParameterDecl" && ref.parent?.kind === "FunctionDecl";
};

const descendedFromFunctionParameter = (node: PropAccessExpr): boolean => {
  if (isFunctionParameter(node.expr)) return true;
  if (node.expr.kind === "PropAccessExpr")
    return descendedFromFunctionParameter(node.expr);
  return false;
};

// declare const fn: Function<{ num: number }, { foo: number }>;

// const restApi = new aws_apigateway.RestApi("api");

// // TODO: prevent calling transformRequest after call
// const api = new ApiIntegration<{ pathParameters: { num: number } }>()
//   .transformRequest((n) => ({
//     num: n.pathParameters.num,
//     x: 123,
//     y: { z: true, w: [1] },
//   }))
//   .call(fn)
//   .handleResponse((n) => ({ bar: n.foo }));

export interface ApiGatewayVtlIntegration {
  integration: (
    requestTemplate: string,
    responseTemplate: string
  ) => aws_apigateway.Integration;
}
