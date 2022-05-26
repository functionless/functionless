/*
new ApiIntegration<...>()
  .transformRequest(req => ...) // transform input
  .call(...) // call integration
  .handleSuccess(...) // 200 response mapping template
  .handleFailure("400", ...)  // 400 response mapping template
  .handleFailure("500", ...);  // 500 response mapping template
*/

import { aws_apigateway } from "aws-cdk-lib";
import { FunctionDecl, isFunctionDecl } from "./declaration";
import { isErr } from "./error";
import { isIdentifier, PropAccessExpr } from "./expression";
import { Function, isFunction } from "./function";
import { FunctionlessNode } from "./node";
import { isTable, Table } from "./table";

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
  IntegRes
> = (req: Request) => IntegRes;

type ResponseTransformerFunction<IntegrationResponse, MethodResponse> = (
  integRes: IntegrationResponse
) => MethodResponse;

type IntegrationTarget<IntegrationRequest, IntegrationResponse> =
  | Function<IntegrationRequest, IntegrationResponse>
  | Table<any, any>;

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

  addMethod(path: string, api: aws_apigateway.RestApi): void {
    const resource = api.root.addResource(path);

    let apigwIntegration: aws_apigateway.Integration;

    if (!this.integration) {
      apigwIntegration = new aws_apigateway.MockIntegration({
        requestTemplates: {
          "application/json": '{ "statusCode": 200 }',
        },
      });
    } else if (isFunction(this.integration)) {
      let requestTemplate: string | undefined;
      if (this.requestTransformer) {
        requestTemplate = toVTL(this.requestTransformer, "request");
      }

      let responseTemplate: string | undefined;
      if (this.responseTransformer) {
        responseTemplate = toVTL(this.responseTransformer, "response");
      }

      // TODO: PASSTHROUGH BEHAVIOR
      const integrationProps: aws_apigateway.LambdaIntegrationOptions = {
        integrationResponses: [
          {
            statusCode: "200",
            responseTemplates: {
              // TODO: what if there is no response template?
              "application/json": responseTemplate!,
            },
          },
        ],
        ...(requestTemplate
          ? {
              requestTemplates: { "application/json": requestTemplate },
              proxy: false,
            }
          : { proxy: true }),
      };
      apigwIntegration = new aws_apigateway.LambdaIntegration(
        this.integration.resource,
        integrationProps
      );
    } else if (isTable(this.integration)) {
      this.integration.getItem();
      apigwIntegration = new aws_apigateway.AwsIntegration({
        service: "dynamodb",
      });
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

function toVTL(node: FunctionDecl, template: "request" | "response") {
  console.log(template);

  const base = `#set($Integer = 0)
#set($inputRoot = $input.path('$'))`;

  const statements = node.body.statements.map((stmt) => inner(stmt)).join("\n");

  return `${base}\n${statements}`;

  function inner(node: FunctionlessNode): string {
    switch (node.kind) {
      // case "Identifier":
      //   return node.name;

      case "ArrayLiteralExpr":
        return `[${node.children.map(inner).join(",")}]`;

      case "BinaryExpr":
        return `${inner(node.left)} ${node.op} ${inner(node.right)}`;

      case "BooleanLiteralExpr":
        return node.value.toString();

      case "NumberLiteralExpr":
        return node.value.toString();

      case "ObjectLiteralExpr":
        return `{${node.properties.map(inner).join(",")}}`;

      case "PropAccessExpr":
        if (descendedFromFunctionParameter(node)) {
          if (template === "request") {
            // TODO: can't refer to $input.pathParameters directly, need casting
            const param = `$input.params('${node.name}')`;

            // TODO: boolean too?
            if (node.type === "number") {
              return `$Integer.parseInt(${param})`;
            }

            return param;
          } else {
            return `$inputRoot.${node.name}`;
          }
        }
        return `${inner(node.expr)}.${node.name};`;

      case "PropAssignExpr":
        const name = inner(node.name);
        const x = inner(node.expr);
        return `${name}: ${x}`;

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

// type SynthesizedMethodProps = aws_apigateway.MethodProps;

// export class SynthesizedMethod extends aws_apigateway.Method {
//   /**
//    * All of the Request and Response Mapping templates in the order they are executed by the AppSync service.
//    */
//   // readonly templates: string[];

//   constructor(
//     scope: Construct,
//     id: string,
//     props: SynthesizedMethodProps
//   ) {
//     super(scope, id, props);

//     this.httpMethod
//   }
// }
