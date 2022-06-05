import { aws_apigateway } from "aws-cdk-lib";
import { Construct } from "constructs";
import { isParameterDecl } from ".";
import { FunctionDecl, isFunctionDecl } from "./declaration";
import { isErr } from "./error";
import {
  Identifier,
  isArgument,
  isArrayLiteralExpr,
  isBooleanLiteralExpr,
  isCallExpr,
  isIdentifier,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isStringLiteralExpr,
  isTemplateExpr,
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

export interface MockApiIntegrationProps<
  Request extends ApiRequest<any, any, any, any>,
  StatusCode extends number,
  MethodResponses extends { [C in StatusCode]: any }
> {
  /**
   * Map API request to a status code. This code will be used by API Gateway
   * to select the response to return.
   */
  request: (request: Request) => { statusCode: StatusCode };
  /**
   * Map of status codes to response to return.
   */
  responses: { [C in StatusCode]: (code: C) => MethodResponses[C] };
}

/**
 * A Mock integration lets you return pre-configured responses by status code.
 * No backend service is invoked.
 *
 * To use you provide a `request` function that returns a status code from the
 * request and a `responses` object that maps a status code to a function
 * returning the pre-configured response for that status code. Functionless will
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
  Request extends ApiRequest<any, any, any, any>,
  StatusCode extends number,
  MethodResponses extends { [C in StatusCode]: any }
> extends BaseApiIntegration {
  private readonly request: FunctionDecl;
  private readonly responses: { [K in keyof MethodResponses]: FunctionDecl };

  public constructor(
    props: MockApiIntegrationProps<Request, StatusCode, MethodResponses>
  ) {
    super();
    this.request = validateFunctionDecl(props.request);
    this.responses = Object.fromEntries(
      Object.entries(props.responses).map(([k, v]) => [
        k,
        validateFunctionDecl(v),
      ])
    ) as { [K in keyof MethodResponses]: FunctionDecl };
  }

  public addMethod(
    httpMethod: HttpMethod,
    resource: aws_apigateway.Resource
  ): void {
    const [requestTemplate] = toVTL(this.request, "request");

    const integrationResponses: aws_apigateway.IntegrationResponse[] =
      Object.entries(this.responses).map(([statusCode, fn]) => {
        const [template] = toVTL(fn as FunctionDecl, "response");
        return {
          statusCode,
          responseTemplates: {
            "application/json": template,
          },
          selectionPattern: `^${statusCode}$`,
        };
      });

    const integration = new aws_apigateway.MockIntegration({
      requestTemplates: {
        "application/json": requestTemplate,
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

export interface AwsApiIntegrationProps<
  Request extends ApiRequest<any, any, any, any>,
  IntegrationResponse,
  MethodResponse
> {
  /**
   * Function that maps an API request to an integration request and calls an
   * integration. This will be compiled to a VTL request mapping template and
   * an API GW integration.
   *
   * At present the function body must be a single statement calling an integration
   * with an object literal argument. E.g
   *
   * ```ts
   *  (req) => fn({ id: req.body.id });
   * ```
   *
   * The supported syntax will be expanded in the future.
   */
  request: (req: Request) => IntegrationResponse;
  /**
   * Function that maps an integration response to a 200 method response. This
   * is the happy path and is modeled explicitly so that the return type of the
   * integration can be inferred. This will be compiled to a VTL template.
   *
   * At present the function body must be a single statement returning an object
   * literal. The supported syntax will be expanded in the future.
   */
  response: (response: IntegrationResponse) => MethodResponse;
  /**
   * Map of status codes to a function defining the  response to return. This is used
   * to configure the failure path method responses, for e.g. when an integration fails.
   */
  errors?: { [statusCode: number]: () => any };
}

/**
 * An AWS API Gateway integration lets you integrate an API with an AWS service
 * supported by Functionless. The request is transformed via VTL and sent to the
 * service via API call, and the response is transformed via VTL and returned in
 * the response.
 *
 * Only `application/json` is supported.
 *
 * TODO: provide example usage after api is stabilized
 *
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html
 */
export class AwsApiIntegration<
  Request,
  IntegrationResponse,
  MethodResponse
> extends BaseApiIntegration {
  private readonly request: FunctionDecl;
  private readonly response: FunctionDecl;
  private readonly errors: { [statusCode: number]: FunctionDecl };

  public constructor(
    props: AwsApiIntegrationProps<Request, IntegrationResponse, MethodResponse>
  ) {
    super();
    this.request = validateFunctionDecl(props.request);
    this.response = validateFunctionDecl(props.response);
    this.errors = Object.fromEntries(
      Object.entries(props.errors ?? {}).map(([k, v]) => [
        k,
        validateFunctionDecl(v),
      ])
    );
  }

  public addMethod(
    httpMethod: HttpMethod,
    resource: aws_apigateway.Resource
  ): void {
    const [requestTemplate, integration] = toVTL(this.request, "request");
    const [responseTemplate] = toVTL(this.response, "response");

    const errorResponses: aws_apigateway.IntegrationResponse[] = Object.entries(
      this.errors
    ).map(([statusCode, fn]) => {
      const [template] = toVTL(fn, "response");
      return {
        statusCode: statusCode,
        selectionPattern: `^${statusCode}$`,
        responseTemplates: {
          "application/json": template,
        },
      };
    });

    const integrationResponses: aws_apigateway.IntegrationResponse[] = [
      {
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
    const apiGwIntegration = integration!.apiGWVtl.createIntegration(
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
): [string, IntegrationImpl<any> | undefined] {
  // TODO: polish these error messages and put them into error-codes.ts
  if (node.body.statements.length !== 1) {
    throw new Error("Expected function body to be a single return statement");
  }

  const stmt = node.body.statements[0];

  if (!isReturnStmt(stmt)) {
    throw new Error("Expected function body to be a single return statement");
  }

  if (location === "request") {
    const call = stmt.expr;
    if (!isCallExpr(call)) {
      throw new Error(
        "Expected request function body to return an integration call"
      );
    }

    // TODO: validate args. also should it always be an object?
    const argObj = inner(call.args[0].expr! as ObjectLiteralExpr);
    const serviceCall = findIntegration(call);

    if (!serviceCall) {
      throw new Error(
        "Expected request function body to return an integration call"
      );
    }

    const prepared = serviceCall.apiGWVtl.prepareRequest(argObj);
    const template = `#set($inputRoot = $input.path('$'))\n${stringify(
      prepared
    )}`;
    return [template, serviceCall];
  } else {
    const obj = stmt.expr;
    if (!isObjectLiteralExpr(obj)) {
      throw new Error(
        "Expected response function body to return an object literal"
      );
    }
    const template = `#set($inputRoot = $input.path('$'))\n${stringify(
      inner(obj)
    )}`;
    return [template, undefined];
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
              throw new Error("TODO: support SpreadAssignExpr");
          }
        })
      );
    } else if (isArgument(node) && node.expr) {
      return inner(node.expr);
    } else if (isPropAccessExpr(node)) {
      // ignore the function param name, we'll replace it with the VTL
      // mapping template inputs
      const [_, ...path] = pathFromFunctionParameter(node) ?? [];

      if (path) {
        if (location === "response") {
          const ref: Ref = {
            __refType: node.type! as any,
            value: `$inputRoot.${path.join(".")}`,
          };
          return ref;
        } else {
          const [paramLocation, ...rest] = path;

          let prefix;
          switch (paramLocation) {
            case "body":
              prefix = "$inputRoot";
              break;
            case "pathParameters":
              prefix = "$input.params().path";
              break;
            case "queryStringParameters":
              prefix = "$input.params().querystring";
              break;
            case "headers":
              prefix = "$input.params().header";
              break;
            default:
              throw new Error("Unknown parameter type.");
          }

          const param = `${prefix}.${rest.join(".")}`;

          const ref: Ref = { __refType: node.type! as any, value: param };
          return ref;
        }
      }
      return `${inner(node.expr)}.${node.name};`;
    } else if (isTemplateExpr(node)) {
      // TODO: not right, compare to vtl.ts
      return inner(node.exprs[0]);
    }

    throw new Error(`Unsupported node type: ${node.kind}`);
  }
}

// These represent variable references and carry the type information.
// stringify will serialize them to the appropriate VTL
// e.g. if `request.pathParameters.id` is a number, we want to serialize
// it as `$input.params().path.id`, not `"$input.params().path.id"` which
// is what JSON.stringify would do
type Ref =
  | { __refType: "string"; value: string }
  | { __refType: "number"; value: string }
  | { __refType: "boolean"; value: string };

const isRef = (x: any): x is Ref => x.__refType !== undefined;

function stringify(obj: any): string {
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

  throw new Error(`Unsupported type: ${typeof obj}`);
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
  return isParameterDecl(ref) && isFunctionDecl(ref.parent);
}

/**
 * path from a function parameter to this node, if one exists.
 * e.g. `request.pathParameters.id` => ["request", "pathParameters", "id"]
 */
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
  /**
   * Prepare the request object for the integration. This can be used to inject
   * properties into the object before serializing to VTL.
   */
  prepareRequest: (obj: object) => object;

  /**
   * Construct an API GW integration.
   */
  createIntegration: (
    scope: Construct,
    requestTemplate: string,
    responses: aws_apigateway.IntegrationResponse[]
  ) => aws_apigateway.Integration;
}
