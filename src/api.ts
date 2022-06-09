import { aws_apigateway, aws_iam } from "aws-cdk-lib";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayEventRequestContext,
} from "aws-lambda";
import { FunctionDecl, isFunctionDecl, isParameterDecl } from "./declaration";
import { isErr } from "./error";
import {
  CallExpr,
  Expr,
  Identifier,
  isArgument,
  isCallExpr,
  isIdentifier,
  isNullLiteralExpr,
  isUndefinedLiteralExpr,
  isNumberLiteralExpr,
  isBooleanLiteralExpr,
  isArrayLiteralExpr,
  isObjectLiteralExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isStringLiteralExpr,
} from "./expression";
import { Function } from "./function";
import { findIntegration, IntegrationImpl } from "./integration";
import { isReturnStmt, Stmt } from "./statement";
import { AnyFunction } from "./util";
import { VTL } from "./vtl";

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

export interface MethodProps {
  httpMethod: HttpMethod;
  resource: aws_apigateway.IResource;
}

export type ApiParameter = undefined | null | boolean | number | string;
export type ApiParameters = Record<string, ApiParameter>;

export type ApiBody =
  | ApiParameter
  | ApiBody[]
  | {
      [propertyName in string]: ApiBody;
    };

/**
 * Request to an API Gateway method. Parameters can be passed in via
 * the path, query string or headers, and the body is a JSON object.
 * None of these are required.
 */
export interface ApiRequest<
  Path extends ApiParameters = ApiParameters,
  Body extends ApiBody = any,
  Query extends ApiParameters = ApiParameters,
  Header extends ApiParameters = ApiParameters
> {
  /**
   * Parameters in the path.
   */
  path?: Path;
  /**
   * Body of the request.
   */
  body?: Body;
  /**
   * Parameters in the query string.
   */
  query?: Query;
  /**
   * Parameters in the headers.
   */
  headers?: Header;
}

export abstract class BaseApiIntegration {
  /**
   * Identify subclasses as API integrations to the Functionless plugin
   */
  public static readonly FunctionlessType = "ApiIntegration";
  protected readonly functionlessKind = BaseApiIntegration.FunctionlessType;

  abstract readonly method: aws_apigateway.Method;
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
  Request extends ApiRequest,
  StatusCode extends number,
  MethodResponses extends { [C in StatusCode]: any }
> extends BaseApiIntegration {
  private readonly request: FunctionDecl;
  private readonly responses: { [K in keyof MethodResponses]: FunctionDecl };
  readonly method;

  public constructor(
    props: MethodProps,
    /**
     * Map API request to a status code. This code will be used by API Gateway
     * to select the response to return.
     */
    request: (
      $input: ApiGatewayInput<Request>,
      $context: ApiGatewayContext
    ) => { statusCode: StatusCode },
    /**
     * Map of status codes to response to return.
     */
    responses: {
      [C in StatusCode]: ($context: ApiGatewayContext) => MethodResponses[C];
    }
  ) {
    super();
    this.request = validateFunctionDecl(request);
    this.responses = Object.fromEntries(
      Object.entries(responses).map(([k, v]) => [k, validateFunctionDecl(v)])
    ) as { [K in keyof MethodResponses]: FunctionDecl };

    const role = new aws_iam.Role(props.resource, `Role_${props.httpMethod}`, {
      assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });
    const requestTemplate = new APIGatewayVTL(role, "request");
    requestTemplate.eval(this.request.body);

    const integrationResponses: aws_apigateway.IntegrationResponse[] =
      Object.entries(this.responses).map(([statusCode, fn]) => {
        const responseTemplate = new APIGatewayVTL(role, "response");
        responseTemplate.eval((fn as FunctionDecl).body);
        return {
          statusCode,
          responseTemplates: {
            "application/json": responseTemplate.toVTL(),
          },
          selectionPattern: `^${statusCode}$`,
        };
      });

    const integration = new aws_apigateway.MockIntegration({
      requestTemplates: {
        "application/json": requestTemplate.toVTL(),
      },
      integrationResponses,
    });

    const methodResponses = Object.keys(this.responses).map((statusCode) => ({
      statusCode,
    }));

    // TODO: support requestParameters, authorizers, models and validators
    this.method = props.resource.addMethod(props.httpMethod, integration, {
      methodResponses,
    });
  }
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
  Request extends ApiRequest,
  MethodResponse,
  IntegrationResponse
> extends BaseApiIntegration {
  private readonly request: FunctionDecl;
  private readonly response: FunctionDecl;
  private readonly errors: { [statusCode: number]: FunctionDecl };
  readonly method;
  public constructor(
    readonly props: MethodProps,
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
    request: (
      $input: ApiGatewayInput<Request>,
      $context: ApiGatewayContext
    ) => IntegrationResponse,
    /**
     * Function that maps an integration response to a 200 method response. This
     * is the happy path and is modeled explicitly so that the return type of the
     * integration can be inferred. This will be compiled to a VTL template.
     *
     * At present the function body must be a single statement returning an object
     * literal. The supported syntax will be expanded in the future.
     */
    response: (
      $input: ApiGatewayInput<
        { body: IntegrationResponse } & Omit<Request, "body">
      >,
      $context: ApiGatewayContext
    ) => MethodResponse,
    /**
     * Map of status codes to a function defining the  response to return. This is used
     * to configure the failure path method responses, for e.g. when an integration fails.
     */
    errors?: { [statusCode: number]: ($context: ApiGatewayContext) => any }
  ) {
    super();
    this.request = validateFunctionDecl(request);
    this.response = validateFunctionDecl(response);
    this.errors = Object.fromEntries(
      Object.entries(errors ?? {}).map(([k, v]) => [k, validateFunctionDecl(v)])
    );

    const role = new aws_iam.Role(props.resource, `Role_${props.httpMethod}`, {
      assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
    });

    const responseTemplate = new APIGatewayVTL(role, "response");
    responseTemplate.eval(this.response.body);
    const requestTemplate = new APIGatewayVTL(role, "request");
    requestTemplate.eval(this.request.body);

    const integration = requestTemplate.integration;

    const errorResponses: aws_apigateway.IntegrationResponse[] = Object.entries(
      this.errors
    ).map(([statusCode, fn]) => {
      const errorTemplate = new APIGatewayVTL(role, "response");
      errorTemplate.eval(fn.body, "response");
      return {
        statusCode: statusCode,
        selectionPattern: `^${statusCode}$`,
        responseTemplates: {
          "application/json": errorTemplate.toVTL(),
        },
      };
    });

    const integrationResponses: aws_apigateway.IntegrationResponse[] = [
      {
        statusCode: "200",
        responseTemplates: {
          "application/json": responseTemplate.toVTL(),
        },
      },
      ...errorResponses,
    ];

    // TODO: resource is not the right scope, prevents adding 2 methods to the resource
    // because of the IAM roles created
    // should `this` be a Method?
    const apiGwIntegration = integration!.apiGWVtl.createIntegration({
      credentialsRole: role,
      requestTemplates: {
        "application/json": requestTemplate.toVTL(),
      },
      integrationResponses,
    });

    const methodResponses = [
      { statusCode: "200" },
      ...Object.keys(this.errors).map((statusCode) => ({
        statusCode,
      })),
    ];

    this.method = props.resource.addMethod(props.httpMethod, apiGwIntegration, {
      methodResponses,
    });
  }
}

export class APIGatewayVTL extends VTL {
  public integration: IntegrationImpl<AnyFunction> | undefined;
  constructor(
    readonly role: aws_iam.IRole,
    readonly location: "request" | "response",
    ...statements: string[]
  ) {
    super(...statements);
  }

  protected integrate(
    target: IntegrationImpl<AnyFunction>,
    call: CallExpr
  ): string {
    if (this.location === "response") {
      throw new Error(
        `Cannot call an integration from within a API Gateway Response Template`
      );
    }
    if (target.apiGWVtl) {
      // ew, mutation
      // TODO: refactor to pure functions
      this.integration = target;
      return target.apiGWVtl.renderRequest(call, this);
    } else {
      throw new Error(
        `Resource type ${target.kind} does not support API Gateway Integrations`
      );
    }
  }

  public eval(node?: Expr, returnVar?: string): string;
  public eval(node: Stmt, returnVar?: string): void;
  public eval(node?: Expr | Stmt, returnVar?: string): string | void {
    if (isReturnStmt(node)) {
      return this.add(this.exprToJson(node.expr));
    }
    return super.eval(node as any, returnVar);
  }

  /**
   * Renders a VTL string that will emit a JSON String representation of the {@link expr} to the VTL output.
   *
   * @param expr the {@link Expr} to convert to JSON
   * @param depth indentation depth of object
   * @returns a VTL string that emits the {@link expr} as JSON
   */
  public exprToJson(expr: Expr, depth = 0): string {
    const context = this;
    const jsonPath = toJsonPath(expr);
    const oneIndent = " ".repeat(depth * 2);
    const twoIndent = " ".repeat((depth + 1) * 2);
    if (jsonPath) {
      return `$input.json('${jsonPath}')`;
    } else if (isNullLiteralExpr(expr) || isUndefinedLiteralExpr(expr)) {
      // Undefined is not the same as null. In JSON terms, `undefined` is the absence of a value where-as `null` is a present null value.
      return "null";
    } else if (isBooleanLiteralExpr(expr)) {
      return expr.value ? "true" : "false";
    } else if (isNumberLiteralExpr(expr)) {
      return expr.value.toString(10);
    } else if (isStringLiteralExpr(expr)) {
      return `"${expr.value}"`;
    } else if (isArrayLiteralExpr(expr)) {
      if (expr.items.length === 0) {
        return "[]";
      } else {
        return `[
${twoIndent}${expr.items
          .map((item) => this.exprToJson(item, depth + 1))
          .join(`,\n${twoIndent}`)}
${oneIndent}]`;
      }
    } else if (isArgument(expr)) {
      if (expr.expr) {
        return this.exprToJson(expr.expr);
      }
    } else if (isCallExpr(expr)) {
      const integration = findIntegration(expr);
      if (integration !== undefined) {
        return this.integrate(integration, expr);
      } else if (isPropAccessExpr(expr.expr) && expr.expr.name === "params") {
        return this.json(`$input.params('${expr.expr.name}')`);
      }
    } else if (isObjectLiteralExpr(expr)) {
      if (expr.properties.length === 0) {
        return "{}";
      }
      return `{\n${twoIndent}${expr.properties
        .map((prop) => {
          if (isPropAssignExpr(prop)) {
            if (isIdentifier(prop.name) || isStringLiteralExpr(prop.name)) {
              return `"${
                isIdentifier(prop.name) ? prop.name.name : prop.name.value
              }":${this.exprToJson(prop.expr, depth + 1)}`;
            }
          } else {
            const key = context.newLocalVarName();
            const map = this.eval(prop.expr);
            return `#foreach(${key} in ${map}.keySet())
"${key}":${this.json(`${map}.get(${key})`)}#if($foreach.hasNext),#end
#end`;
          }
          return "#stop";
        })
        .join(`,\n${twoIndent}`)}
${oneIndent}}`;
    } else {
      // this Expr is a computation that cannot be expressed as JSON Path
      // we must therefore evaluate it and use a brute force approach to convert it into JSON
      // TODO: this will always throw an error because API Gateway does not have $util.toJson
      return this.json(this.eval(expr));
    }
    throw new Error(`unsupported expression ${expr.kind}`);

    /**
     * Translates an {@link Expr} into JSON Path if this expression references values
     * on the root `$input.body` object.
     *
     * @param expr the {@link Expr} to convert to JSON.
     * @returns a JSON Path `string` if this {@link Expr} can be evaluated as a JSON Path from the `$input`, otherwise `undefined`.
     */
    function toJsonPath(expr: Expr): string | undefined {
      if (isIdentifier(expr)) {
        const ref = expr.lookup();
        if (
          isParameterDecl(ref) &&
          isFunctionDecl(ref.parent) &&
          ref.parent.parent === undefined
        ) {
          // is the input parameter, return root
          return `$`;
        } else {
          // this is a reference to an intermediate value, cannot be expressed as JSON Path
          return undefined;
        }
      } else if (isPropAccessExpr(expr)) {
        const exprJsonPath = toJsonPath(expr.expr);
        if (exprJsonPath !== undefined) {
          if (exprJsonPath === "$" && expr.name === "data") {
            return exprJsonPath;
          }

          return `${exprJsonPath}.${expr.name}`;
        }
      }
      return undefined;
    }
  }

  public json(reference: string): string {
    return `#if(${reference}.class.name === 'java.lang.String') 
\"${reference}\" 
#elseif(${reference}.class.name === 'java.lang.Integer' || ${reference}.class.name === 'java.lang.Double' || ${reference}.class.name === 'java.lang.Boolean') 
${reference} 
#else
#set($context.responseOverride.status = 500)
#stop
#end`;
  }

  protected dereference(id: Identifier): string {
    const ref = id.lookup();
    if (ref?.kind === "VariableStmt") {
      return `$${id.name}`;
    } else if (
      ref?.kind === "ParameterDecl" &&
      ref.parent?.kind === "FunctionDecl"
    ) {
      const paramIndex = ref.parent.parameters.indexOf(ref);
      if (paramIndex === 0) {
        return `$inputRoot`;
      } else if (paramIndex === 1) {
        return "$context";
      } else {
        throw new Error(`unknown argument`);
      }
    }
    if (id.name.startsWith("$")) {
      return id.name;
    } else {
      return `$${id.name}`;
    }
  }
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

/**
 * Hooks used to create API Gateway integrations.
 */
export interface ApiGatewayVtlIntegration {
  /**
   * Render the Request Payload as a VTL string.
   */
  renderRequest: (call: CallExpr, context: APIGatewayVTL) => string;

  /**
   * Construct an API GW integration.
   */
  createIntegration: (
    options: aws_apigateway.IntegrationOptions & {
      credentialsRole: aws_iam.IRole;
    }
  ) => aws_apigateway.Integration;
}

export interface LambdaProxyApiIntegrationProps
  extends Omit<
    aws_apigateway.LambdaIntegrationOptions,
    | "requestParameters"
    | "requestTemplates"
    | "integrationResponses"
    | "passthroughBehavior"
    | "proxy"
  > {
  function: Function<APIGatewayProxyEvent, APIGatewayProxyResult>;
  httpMethod: HttpMethod;
  resource: aws_apigateway.IResource;
}

export class LambdaProxyApiMethod extends BaseApiIntegration {
  readonly function;
  readonly method;

  constructor(private readonly props: LambdaProxyApiIntegrationProps) {
    super();
    this.function = props.function;

    this.method = props.resource.addMethod(
      props.httpMethod,
      new aws_apigateway.LambdaIntegration(this.function.resource, {
        ...this.props,
        proxy: true,
      })
    );
  }
}

export type ExcludeNullOrUndefined<T> = T extends undefined | null | infer X
  ? X
  : T;

type IfNever<T, Default> = T extends never ? Default : T;

export type Params<Request extends ApiRequest> = Exclude<
  IfNever<
    ExcludeNullOrUndefined<Request["path"]> &
      ExcludeNullOrUndefined<Request["query"]>,
    ApiParameters
  >,
  undefined
>;

/**
 * The `$input` VTL variable containing all of the request data available in API Gateway's VTL engine.
 *
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html#input-variable-reference
 */
export interface ApiGatewayInput<Request extends ApiRequest> {
  /**
   * Parsed form of the {@link body}
   */
  readonly data: Request["body"];
  /**
   * The raw request payload as a string.
   */
  readonly body: string;
  /**
   * This function evaluates a JSONPath expression and returns the results as a JSON.
   *
   * For example, `$input.json('$.pets')` returns a JSON string representing the pets structure.
   *
   * @param jsonPath JSONPath expression to select data from the body.
   * @see http://goessner.net/articles/JsonPath/
   * @see https://github.com/jayway/JsonPath
   */
  json(jsonPath: string): any;
  /**
   * Returns a map of all the request parameters. We recommend that you use
   * `$util.escapeJavaScript` to sanitize the result to avoid a potential
   * injection attack. For full control of request sanitization, use a proxy
   * integration without a template and handle request sanitization in your
   * integration.
   */
  params(): Params<Request>;
  /**
   * Returns the value of a method request parameter from the path, query string,
   * or header value (searched in that order), given a parameter name string x.
   * We recommend that you use $util.escapeJavaScript to sanitize the parameter
   * to avoid a potential injection attack. For full control of parameter
   * sanitization, use a proxy integration without a template and handle request
   * sanitization in your integration.
   *
   * @param name name of the path.
   */
  params<ParamName extends keyof Params<Request>>(
    name: ParamName
  ): Params<Request>[ParamName];
  /**
   * Takes a JSONPath expression string (x) and returns a JSON object representation
   * of the result. This allows you to access and manipulate elements of the payload
   * natively in Apache Velocity Template Language (VTL).
   *
   * @param jsonPath
   */
  path(jsonPath: string): any;
}

/**
 * Type of the `$context` variable available within Velocity Templates in API Gateway.
 *
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-mapping-template-reference.html#context-variable-reference
 */
export interface ApiGatewayContext extends APIGatewayEventRequestContext {
  /**
   * The AWS endpoint's request ID.
   */
  readonly awsEndpointRequestId: string;
  /**
   * API Gateway error information.
   */
  readonly error: APIGatewayError;
  /**
   * The HTTP method used.
   */
  readonly httpMethod: HttpMethod;
  /**
   * The response received from AWS WAF: WAF_ALLOW or WAF_BLOCK. Will not be set if the
   * stage is not associated with a web ACL. For more information, see Using AWS WAF to
   * protect your APIs.
   */
  readonly wafResponseCode?: "WAF_ALLOW" | "WAF_BLOCK";
  /**
   * The complete ARN of the web ACL that is used to decide whether to allow or block
   * the request. Will not be set if the stage is not associated with a web ACL. For
   * more information, see Using AWS WAF to protect your APIs.
   */
  readonly webaclArn?: string;
  /**
   * Request properties that can be overridden.
   */
  readonly requestOverride: APIGatewayRequestOverride;
  /**
   * Response properties that can be overridden.
   */
  readonly responseOverride: ApiGatewayResponseOverride;
}

export interface APIGatewayError {
  /**
   * A string containing an API Gateway error message. This variable can only be used
   * for simple variable substitution in a GatewayResponse body-mapping template, which
   * is not processed by the Velocity Template Language engine, and in access logging.
   * For more information, see Monitoring WebSocket API execution with CloudWatch
   * metrics and Setting up gateway responses to customize error responses.
   */
  readonly message: string;
  /**
   * The quoted value of $context.error.message, namely "$context.error.message".
   */
  readonly messageString: string;
  /**
   * A type of GatewayResponse. This variable can only be used for simple variable
   * substitution in a GatewayResponse body-mapping template, which is not processed
   * by the Velocity Template Language engine, and in access logging. For more
   * information, see Monitoring WebSocket API execution with CloudWatch metrics and
   * Setting up gateway responses to customize error responses.
   */
  readonly responseType: string;
  /**
   * A string containing a detailed validation error message.
   */
  readonly validationErrorString: string;
}

export interface APIGatewayRequestOverride {
  /**
   * The request header override. If this parameter is defined, it contains the headers
   * to be used instead of the HTTP Headers that are defined in the Integration Request
   * pane.
   */
  readonly header: Record<string, string>;
  /**
   * The request path override. If this parameter is defined, it contains the request
   * path to be used instead of the URL Path Parameters that are defined in the
   * Integration Request pane.
   */
  readonly path: Record<string, string>;
  /**
   * The request query string override. If this parameter is defined, it contains the
   * request query strings to be used instead of the URL Query String Parameters that
   * are defined in the Integration Request pane.
   */
  readonly querystring: Record<string, string>;
}

export interface ApiGatewayResponseOverride {
  /**
   * The response header override. If this parameter is defined, it contains the header
   * to be returned instead of the Response header that is defined as the Default mapping
   * in the Integration Response pane.
   */
  readonly header: Record<string, string>;

  /**
   * The response status code override. If this parameter is defined, it contains the
   * status code to be returned instead of the Method response status that is defined
   * as the Default mapping in the Integration Response pane.
   *
   * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/apigateway-override-request-response-parameters.html
   */
  status: number;
}
