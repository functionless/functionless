import { aws_apigateway } from "aws-cdk-lib";
import { Construct } from "constructs";
import { isTemplateExpr } from ".";
import { FunctionDecl, isFunctionDecl } from "./declaration";
import { isErr } from "./error";
import {
  Identifier,
  isArrayLiteralExpr,
  isBooleanLiteralExpr,
  isCallExpr,
  isIdentifier,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isStringLiteralExpr,
  ObjectLiteralExpr,
  PropAccessExpr,
} from "./expression";
import { findIntegration, IntegrationImpl } from "./integration";
import { FunctionlessNode } from "./node";
import { isReturnStmt } from "./statement";

/**
 * HTTP Methods that API Gateway supports.
 */
export type HttpMethod =
  | "ANY"
  | "GET"
  | "POST"
  | "PUT"
  | "DELETE"
  | "HEAD"
  | "OPTIONS";

type ParameterMap = Record<string, string | number | boolean>;

/**
 * Request to an API Gateway method. Parameters can be passed in via
 * the path, query string or headers, and the body is a JSON object.
 * None of these are required.
 */
export interface ApiRequest<
  PathParams extends ParameterMap | undefined = undefined,
  Body extends object | undefined = undefined,
  QueryParams extends ParameterMap | undefined = undefined,
  HeaderParams extends ParameterMap | undefined = undefined
> {
  /**
   * Parameters in the path.
   */
  pathParameters?: PathParams;
  /**
   * Body of the request.
   */
  body?: Body;
  /**
   * Parameters in the query string.
   */
  queryStringParameters?: QueryParams;
  /**
   * Parameters in the headers.
   */
  headers?: HeaderParams;
}

type RequestTransformerFunction<
  Request extends ApiRequest<any, any, any, any>,
  IntegrationRequest
> = (req: Request) => IntegrationRequest;

type ResponseTransformerFunction<IntegrationResponse, MethodResponse> = (
  resp: IntegrationResponse
) => MethodResponse;

export abstract class BaseApiIntegration {
  /**
   * Identify subclasses as API integrations to the Functionless plugin
   */
  public static readonly FunctionlessType = "ApiIntegration";
  protected readonly functionlessKind = BaseApiIntegration.FunctionlessType;

  /**
   * Add this integration as a Method to an API Gateway resource.
   *
   * TODO: this mirrors the AppsyncResolver.addResolver method, but it
   * is on the chopping block: https://github.com/functionless/functionless/issues/137
   * The 2 classes are conceptually similar so we should keep the DX in sync.
   */
  public abstract addMethod(
    httpMethod: HttpMethod,
    resource: aws_apigateway.Resource
  ): void;
}

/**
 * Static constructors for the supported API Gateway integrations.
 * These are the preferred entrypoints as they offer superior type
 * inference.
 */
export class ApiIntegrations {
  /**
   * Create a {@link MockApiIntegration}.
   */
  public static mock<
    Request extends ApiRequest<any, any, any, any>,
    StatusCode extends number,
    MethodResponses extends { [C in StatusCode]: any }
  >(
    props: MockApiIntegrationProps<Request, StatusCode, MethodResponses>
  ): MockApiIntegration<typeof props> {
    return new MockApiIntegration(props);
  }

  /**
   * Create a {@link AwsApiIntegration}.
   */
  public static aws<
    Request extends ApiRequest<any, any, any, any>,
    IntegrationResponse,
    MethodResponse
  >(
    props: AwsApiIntegrationProps<Request, IntegrationResponse, MethodResponse>
  ) {
    return new AwsApiIntegration(props);
  }
}

export interface MockApiIntegrationProps<
  Request extends ApiRequest<any, any, any, any>,
  StatusCode extends number,
  MethodResponses extends { [C in StatusCode]: any }
> {
  /**
   * Map API request to a status code. This code will be used by API Gateway
   * to select the response to return.
   */
  request: RequestTransformerFunction<Request, { statusCode: StatusCode }>;
  /**
   * Map of status codes to response to return.
   */
  responses: { [C in StatusCode]: (code: C) => MethodResponses[C] };
}

/**
 * A Mock integration lets you return preconfigured responses by status code.
 * No backend service is invoked.
 *
 * To use you provide a `request` function that returns a status code from the
 * request and a `responses` object that maps a status code to a function
 * returning the preconfigured response for that status code. Functionless will
 * convert these functions to VTL mapping templates and configure the necessary
 * method responses.
 *
 * Only `application/json` is supported.
 *
 * TODO: provide example usage after api is stabilized
 *
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html
 */
export class MockApiIntegration<
  Props extends MockApiIntegrationProps<any, any, any>
> extends BaseApiIntegration {
  private readonly request: FunctionDecl;
  private readonly responses: { [K in keyof Props["responses"]]: FunctionDecl };

  public constructor(props: Props) {
    super();
    this.request = validateFunctionDecl(props.request);
    this.responses = Object.fromEntries(
      Object.entries(props.responses).map(([k, v]) => [
        k,
        validateFunctionDecl(v),
      ])
    ) as { [K in keyof Props["responses"]]: FunctionDecl };
  }

  public addMethod(
    httpMethod: HttpMethod,
    resource: aws_apigateway.Resource
  ): void {
    const requestTemplate = toVTL(this.request, "request");

    const responseEntries: [string, FunctionDecl][] = Object.entries(
      this.responses
    );
    // @ts-ignore WTF???
    const integrationResponses: aws_apigateway.IntegrationResponse[] =
      responseEntries.map(([statusCode, fn]) => ({
        statusCode,
        responseTemplates: {
          "application/json": toVTL(fn, "response"),
        },
        selectionPattern: `^${statusCode}$`,
      }));

    const integration = new aws_apigateway.MockIntegration({
      requestTemplates: {
        "application/json": requestTemplate[1],
      },
      integrationResponses,
    });

    const methodResponses = Object.keys(this.responses).map((statusCode) => ({
      statusCode,
    }));

    // TODO: support requestParameters, authorizers, models and validators
    resource.addMethod(httpMethod, integration, {
      methodResponses,
    });
  }
}

// TODO: comment
export interface AwsApiIntegrationProps<
  Request extends ApiRequest<any, any, any, any>,
  IntegrationResponse,
  MethodResponse
> {
  request: RequestTransformerFunction<Request, IntegrationResponse>;
  response: ResponseTransformerFunction<IntegrationResponse, MethodResponse>;
  errors: { [statusCode: number]: () => any };
}

/**
 * An AWS API Gateway integration lets you integrate an API with an AWS service
 * supported by Functionless. The request is transformed via VTL and sent to the
 * service via API call, and the response is transformed via VTL and returned in
 * the response.
 *
 * TODO: we need to support multiple responses
 *
 * Only `application/json` is supported.
 *
 * TODO: provide example usage after api is stabilized
 *
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html
 */
export class AwsApiIntegration<
  Props extends AwsApiIntegrationProps<any, any, any>
> extends BaseApiIntegration {
  private readonly request: FunctionDecl;
  private readonly response: FunctionDecl;
  private readonly errors: { [statusCode: number]: FunctionDecl };

  public constructor(props: Props) {
    super();
    this.request = validateFunctionDecl(props.request);
    this.response = validateFunctionDecl(props.response);
    this.errors = Object.fromEntries(
      Object.entries(props.errors).map(([k, v]) => [k, validateFunctionDecl(v)])
    );
  }

  public addMethod(
    httpMethod: HttpMethod,
    resource: aws_apigateway.Resource
  ): void {
    const [integration, requestTemplate] = toVTL(this.request, "request");
    const [, responseTemplate] = toVTL(this.response, "response");

    const errorResponses: aws_apigateway.IntegrationResponse[] = Object.entries(
      this.errors
    ).map(([statusCode, fn]) => ({
      // TODO
      statusCode: statusCode,
      selectionPattern: `^${statusCode}$`,
      responseTemplates: {
        "application/json": toVTL(fn, "response")[1],
      },
    }));

    const integrationResponses: aws_apigateway.IntegrationResponse[] = [
      {
        // TODO
        statusCode: "200",
        responseTemplates: {
          "application/json": responseTemplate,
        },
      },
      ...errorResponses,
    ];

    // TODO: resource is not the right scope, prevents adding 2 methods to the resource
    // because of the IAM roles created
    // should `this` be a Method?
    const apiGwIntegration = integration!.apiGWVtl.experimentMakeIntegration(
      resource,
      requestTemplate,
      integrationResponses
    );

    const methodResponses = [
      { statusCode: "200" },
      ...Object.keys(this.errors).map((statusCode) => ({
        statusCode,
      })),
    ];

    resource.addMethod(httpMethod, apiGwIntegration, {
      methodResponses,
    });
  }
}

/**
 * Simple VTL interpreter for a FunctionDecl. The interpreter in vtl.ts
 * is based on the AppSync VTL engine which has much more flexibility than
 * the API Gateway VTL engine. In particular it has a toJson utility function
 * which means the VTL can just create an object in memory and then toJson it
 * the end. Here we need to manually output the JSON which is how VTL is
 * typically meant to be used.
 *
 * For now, only Literals and references to the template input are supported.
 * It is definitely possible to support more, but we will start with just
 * small core and support more syntax carefully over time.
 *
 * @param node Function to interpret.
 * @param template Whether we are creating a request or response mapping template.
 */
export function toVTL(
  node: FunctionDecl,
  location: "request" | "response"
): [IntegrationImpl<any> | undefined, string] {
  if (node.body.statements.length !== 1) {
    throw new Error(`Expected 1 statement in `);
  }

  const stmt = node.body.statements[0];

  if (!isReturnStmt(stmt)) {
    throw new Error(`Expected return statement in `);
  }

  const call = stmt.expr;

  if (location === "request") {
    if (!isCallExpr(call)) {
      throw new Error(`Expected call expression in `);
    }

    // TODO: validate args
    const argObj = inner(call.args[0].expr! as ObjectLiteralExpr);
    const serviceCall = findIntegration(call);

    const prepared = serviceCall!.apiGWVtl.experimentPrepareRequest(argObj);

    console.log(prepared);

    const x = stringify(prepared);
    const template = `#set($inputRoot = $input.path('$'))\n${x}`;
    return [serviceCall, template];
  } else {
    if (!isObjectLiteralExpr(call)) {
      throw "TODO not an object";
    }
    const template = `#set($inputRoot = $input.path('$'))\n${stringify(
      inner(call)
    )}`;
    return [undefined, template];
  }

  function inner(node: FunctionlessNode): any {
    if (
      isBooleanLiteralExpr(node) ||
      isNumberLiteralExpr(node) ||
      isStringLiteralExpr(node) ||
      isNullLiteralExpr(node)
    ) {
      return node.value;
    } else if (isArrayLiteralExpr(node)) {
      return node.children.map(inner);
    } else if (isObjectLiteralExpr(node)) {
      return Object.fromEntries(
        node.properties.map((prop) => {
          switch (prop.kind) {
            case "PropAssignExpr":
              return [inner(prop.name), inner(prop.expr)];
            case "SpreadAssignExpr":
              throw "TODO SpreadAssignExpr";
          }
        })
      );
    } else if (isPropAccessExpr(node)) {
      const path = pathFromFunctionParameter(node);
      console.log(path);

      if (path) {
        if (location === "response") {
          const c: Ref = {
            __refType: node.type! as any,
            value: `$inputRoot.${path.slice(1).join(".")}`,
          };
          return c;
        }
        // we don't need the function param name
        const [paramLocation, ...rest] = path.slice(1);

        let param;
        switch (paramLocation) {
          case "body":
            param = `$inputRoot.${rest.join(".")}`;
            break;
          case "pathParameters":
            param = `$input.params().path.${rest.join(".")}`;
            break;
          case "queryStringParameters":
            param = `$input.params().querystring.${rest.join(".")}`;
            break;
          case "headers":
            param = `$input.params().headers.${rest.join(".")}`;
            break;
          default:
            throw new Error("Unknown parameter type.");
        }

        const c: Ref = { __refType: node.type! as any, value: param };
        return c;
      }
      return `${inner(node.expr)}.${node.name};`;
    } else if (isTemplateExpr(node)) {
      // TODO: not right, compare to vtl.ts
      return inner(node.exprs[0]);
    }

    throw new Error("Method not implemented.");
  }

  // const statements = node.body.statements.map((stmt) => inner(stmt)).join("\n");

  // if (template === "request") {
  //   return [integration, `#set($inputRoot = $input.path('$'))\n${statements}`];
  // } else {
  //   return [integration, statements];
  // }

  // function inner(node: FunctionlessNode): string {
  //   if (isBooleanLiteralExpr(node) || isNumberLiteralExpr(node)) {
  //     return node.value.toString();
  //   } else if (isStringLiteralExpr(node)) {
  //     return wrapStr(node.value);
  //   } else if (isArrayLiteralExpr(node)) {
  //     return `[${node.children.map(inner).join(",")}]`;
  //   } else if (isObjectLiteralExpr(node)) {
  //     return `{${node.properties.map(inner).join(",")}}`;
  //   } else if (isArgument(node)) {
  //     // TODO: handle undefined
  //     return inner(node.expr!);
  //   } else if (isCallExpr(node)) {
  //     const serviceCall = findIntegration(node);
  //     if (serviceCall) {
  //       const x = node.children[1];
  //       if (!isArgument(x)) {
  //         throw "Not an argument";
  //       }
  //       if (!isObjectLiteralExpr(x.expr!)) {
  //         throw "Not an object literal";
  //       }

  //       const y = serviceCall.apiGWVtl.experimentPrepareRequest(x.expr);

  //       integration = serviceCall;

  //       return inner(y as any);
  //     } else {
  //       throw "TODO";
  //     }
  //   } else if (isPropAccessExpr(node)) {
  //     const path = pathFromFunctionParameter(node);
  //     if (path) {
  //       // we don't need the function param name
  //       const [location, ...rest] = path.slice(1);

  //       let param;
  //       if (template === "request") {
  //         switch (location) {
  //           case "body":
  //             param = `$inputRoot.${rest.join(".")}`;
  //             break;
  //           case "pathParameters":
  //             param = `$inputRoot.${rest.join(".")}`;
  //             break;
  //           case "queryStringParameters":
  //             param = `$inputRoot.${rest.join(".")}`;
  //             break;
  //           case "headers":
  //             param = `$inputRoot.${rest.join(".")}`;
  //             break;
  //           default:
  //             throw new Error("Unknown parameter type.");
  //         }
  //         if (node.type === "string") {
  //           return wrapStr(param);
  //         }
  //       } else {
  //         param = `$inputRoot.${node.name}`;
  //         if (node.type === "string") {
  //           return wrapStr(param);
  //         }
  //       }
  //       return param;
  //     }
  //     return `${inner(node.expr)}.${node.name};`;
  //   } else if (isPropAssignExpr(node)) {
  //     return `${inner(node.name)}: ${inner(node.expr)}`;
  //   } else if (isReturnStmt(node)) {
  //     return inner(node.expr);
  //   } else if (isTemplateExpr(node)) {
  //     // TODO: not right, compare to vtl.ts
  //     return inner(node.exprs[0]);
  //   } else if (isIdentifier(node)) {
  //     return node.name;
  //   }

  //   throw new Error(`Unsupported node type: ${node.kind}`);
  // }
}

function validateFunctionDecl(a: any): FunctionDecl {
  if (isFunctionDecl(a)) {
    return a;
  } else if (isErr(a)) {
    throw a.error;
  } else {
    throw Error("Unknown compiler error.");
  }
}

function isFunctionParameter(node: FunctionlessNode): node is Identifier {
  if (!isIdentifier(node)) return false;
  const ref = node.lookup();
  return ref?.kind === "ParameterDecl" && ref.parent?.kind === "FunctionDecl";
}

function pathFromFunctionParameter(node: PropAccessExpr): string[] | undefined {
  if (isFunctionParameter(node.expr)) {
    return [node.expr.name, node.name];
  } else if (isPropAccessExpr(node.expr)) {
    const path = pathFromFunctionParameter(node.expr);
    if (path) {
      return [...path, node.name];
    } else {
      return undefined;
    }
  } else {
    return undefined;
  }
}

/**
 * Hooks used to create API Gateway integrations.
 */
export interface ApiGatewayVtlIntegration {
  integration: (
    requestTemplate: string,
    responseTemplate: string
  ) => aws_apigateway.Integration;

  experimentPrepareRequest: (obj: object) => object;

  experimentMakeIntegration: (
    scope: Construct,
    requestTemplate: string,
    responses: aws_apigateway.IntegrationResponse[]
  ) => aws_apigateway.Integration;
}

type Ref =
  | { __refType: "string"; value: string }
  | { __refType: "number"; value: string }
  | { __refType: "boolean"; value: string };

const isRef = (x: any): x is Ref => x.__refType !== undefined;

export function stringify(obj: any): string {
  if (isRef(obj)) {
    switch (obj.__refType) {
      case "string":
        return `"${obj.value}"`;
      case "number":
        return obj.value;
      case "boolean":
        return obj.value;
    }
  }
  if (typeof obj === "string") {
    return `"${obj}"`;
  } else if (typeof obj === "number" || typeof obj === "boolean") {
    return obj.toString();
  } else if (Array.isArray(obj)) {
    return `[${obj.map(stringify).join(",")}]`;
  } else if (typeof obj === "object") {
    const props = Object.entries(obj).map(([k, v]) => `"${k}":${stringify(v)}`);
    return `{${props.join(",")}}`;
  }

  throw "GOOFED";
}
