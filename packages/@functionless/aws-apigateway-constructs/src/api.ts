import { FunctionDecl, validateFunctionLike } from "@functionless/ast";
import { aws_apigateway, aws_iam } from "aws-cdk-lib";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  APIGatewayEventRequestContext,
} from "aws-lambda";
import type { Function } from "@functionless/aws-lambda-constructs";
import { APIGatewayVTL } from "./api-vtl";
import { Construct } from "constructs";

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

/**
 * Properties for configuring an API Gateway Method Integration.
 *
 * Both the Method's properties and the underlying Integration are configured with these properties.
 */
export interface MethodProps
  extends Omit<
      aws_apigateway.IntegrationOptions,
      "requestTemplates" | "integrationResponses" | "requestParameters"
    >,
    Omit<
      aws_apigateway.MethodOptions,
      "requestParameters" | "operationName" | "methodResponses"
    > {
  /**
   * The HTTP Method of this API Method Integration.
   */
  httpMethod: HttpMethod;
  /**
   * The API Gateway Resource this Method implements.
   */
  resource: aws_apigateway.IResource;
  /**
   * The IAM Role to use for authorizing this Method's integration requests.
   *
   * If you choose to pass an IAM Role, make sure it can be assumed by API
   * Gateway's service principal - `"apigateway.amazonaws.com"`.
   *
   * ```ts
   * new aws_iam.Role(scope, id, {
   *   assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
   * })
   * ```
   *
   * @default - one is created for you.
   */
  credentialsRole?: aws_iam.IRole;
}

/**
 * Data types allowed for an API path, query or header parameter.
 */
export type ApiParameter = undefined | null | boolean | number | string;

/**
 * A collection of {@link ApiParameter}s.
 */
export type ApiParameters = Record<string, string>;

/**
 * Type of data allowed as the body in an API.
 */
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

export type ApiMethodKind = "AwsMethod" | "MockMethod";

export function isApiMethodKind(a: any): a is ApiMethodKind {
  return a === "AwsMethod" || a === "MockMethod";
}

/**
 * Base class of an AWS API Gateway Method.
 *
 * @see {@link MockMethod}
 * @see {@link AwsMethod}
 */
export abstract class ApiMethod<Kind extends ApiMethodKind> {
  /**
   * Identify subclasses as API integrations to the Functionless plugin
   */
  public static readonly FunctionlessType = "ApiIntegration";

  constructor(
    /**
     *
     */
    readonly kind: Kind,
    /**
     * The underlying Method Construct.
     */
    readonly method: aws_apigateway.Method
  ) {}
}

/**
 * Constructs the IAM Role to be used by an API Integration.
 *
 * You can pass in their own IAM Role if they choose. If they do, it is their responsibility to
 * ensure that Role can be assumed by the `apigateway.amazonaws.com` service principal.
 *
 * By default, a new Role is created for you.
 *
 * @param props the {@link MethodProps} for this Method Integration.
 * @returns the IAM Role used for authorizing the API Method Integration requests.
 */
function getRole(props: MethodProps) {
  if (props.credentialsRole) {
    // use the IAM Role passed in by the user.
    // TODO: should we try our best to ensure that the passed in Role has the correct assumedBy policy or leave it up to the user?
    //       -> if this is an IRole, we can't do anything
    //       -> if this is a Role, we can check the underlying CfnResource's policy and update it
    return props.credentialsRole;
  }
  // by default, create a Role for each Resource's HTTP Method

  // the Method's Role is stored as a singleton on the HTTP Resource using the naming convention, `Role_<method>`, e.g. `Role_GET`.
  const roleResourceName = `Role_${props.httpMethod}`;
  return singletonConstruct(
    props.resource,
    roleResourceName,
    (scope, id) =>
      new aws_iam.Role(scope, id, {
        assumedBy: new aws_iam.ServicePrincipal("apigateway.amazonaws.com"),
      })
  );
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
 * ```ts
 * new MockApiIntegration(
 *  {
 *    httpMethod: "GET",
 *    resource: api.root,
 *  },
 *  ($input) => ({
 *    statusCode: $input.params("code") as number,
 *  }),
 *  {
 *    200: () => ({
 *      response: "OK",
 *    }),
 *    500: () => ({
 *      response: "BAD",
 *    }),
 *  }
 * );
 * ```
 *
 * Only `application/json` is supported. To workaround this limitation, use the [API Gateway Construct Library](https://docs.aws.amazon.com/cdk/api/v1/docs/aws-apigateway-readme.html)
 *
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html
 */
export class MockMethod<
  Request extends ApiRequest,
  StatusCode extends number
> extends ApiMethod<"MockMethod"> {
  constructor(
    props: MethodProps,
    /**
     * Map API request to a status code. This code will be used by API Gateway
     * to select the response to return.
     *
     * Functionless's API Gateway only supports JSON data at this time.
     */
    request: (
      $input: ApiGatewayInput<Request>,
      $context: ApiGatewayContext
    ) => Promise<{ statusCode: StatusCode }> | { statusCode: StatusCode },
    /**
     * Map of status codes to response to return.
     *
     * Functionless's API Gateway only supports JSON data at this time.
     */
    responses: {
      [C: number]: (
        $input: ApiGatewayInput<Request>,
        $context: ApiGatewayContext
      ) => Promise<any> | any;
    }
  ) {
    const requestDecl = validateFunctionLike(request, "MockMethod Request");
    const responseDecls = Object.fromEntries(
      Object.entries(responses).map(([k, v]) => [
        k,
        validateFunctionLike(v, `MockMethod Response ${k}`),
      ])
    ) as { [K in 200]: FunctionDecl };

    const role = getRole(props);
    const requestTemplate = new APIGatewayVTL(role, "request");
    requestTemplate.eval(requestDecl.body);

    const integrationResponses: aws_apigateway.IntegrationResponse[] =
      Object.entries(responseDecls).map(([statusCode, fn]) => {
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
      ...props,
      requestTemplates: {
        "application/json": requestTemplate.toVTL(),
      },
      integrationResponses,
    });

    const methodResponses = Object.keys(responseDecls).map((statusCode) => ({
      statusCode,
    }));

    super(
      "MockMethod",
      props.resource.addMethod(props.httpMethod, integration, {
        methodResponses,
      })
    );
  }
}

/**
 * An AWS API Gateway Method that fulfils requests by invoking APIs on other AWS Resources.
 *
 * Integration logic is written in pure TypeScript and transformed into Apache Velocity Templates
 * that is then applied by the AWS API Gateway service to to transform requests and responses.
 *
 * ```ts
 * new AwsApiIntegration(
 *  {
 *    httpMethod: "GET",
 *    resource: api.root,
 *  },
 *  (
 *    $input: ApiGatewayInput<{
 *      query: Request;
 *    }>
 *  ) =>
 *    sfn({
 *      input: {
 *        num: $input.params("num"),
 *        str: $input.params("str"),
 *      },
 *    }),
 *  ($input, $context) => {
 *    if ($input.data.status === "SUCCEEDED") {
 *      return $input.data.output;
 *    } else {
 *      $context.responseOverride.status = 500;
 *      return $input.data.error;
 *    }
 *  },
 *  {
 *    404: () => ({
 *      message: "Item not Found"
 *    })
 *  }
 * );
 * ```
 *
 * The second argument is a function that transforms the incoming request into a call to an integration.
 * It must always end with a call to an Integration and no code can execute after the call.
 *
 * ```ts
 *  (
 *    $input: ApiGatewayInput<{
 *      query: Request;
 *    }>
 *  ) =>
 *    sfn({
 *      input: {
 *        num: $input.params("num"),
 *        str: $input.params("str"),
 *      },
 *    }),
 * ```
 *
 * The third argument is a function that transforms the response data from the downstream Integration
 * into the final data sent to the API caller. This code runs when the integration responds with
 * a 200 status code.
 *
 * ```ts
 *  ($input, $context) => {
 *    if ($input.data.status === "SUCCEEDED") {
 *      return $input.data.output;
 *    } else {
 *      $context.responseOverride.status = 500;
 *      return $input.data.error;
 *    }
 *  }
 * ```
 *
 * The fourth argument is an optional object with mapping functions for error status codes. The corresponding
 * callback will be executed when the downstream integration responds with that status code.
 *
 * ```ts
 *  {
 *    404: () => ({
 *      message: "Item not Found"
 *    })
 *  }
 * ```
 *
 * Only `application/json` is supported. To workaround this limitation, use the [API Gateway Construct Library](https://docs.aws.amazon.com/cdk/api/v1/docs/aws-apigateway-readme.html)
 *
 * @see https://docs.aws.amazon.com/apigateway/latest/developerguide/api-gateway-api-integration-types.html
 * @tparam Request - an {@link ApiRequest} type that specifies the allowed path, query, header and body parameters and their types.
 * @tparam MethodResponse - the type of data returned by the Integration. This is the type of data that will be processed by the response template.
 * @tparam IntegrationResponse - the type of data returned by this API
 */
export class AwsMethod<
  Request extends ApiRequest,
  MethodResponse,
  IntegrationResponse
> extends ApiMethod<"AwsMethod"> {
  constructor(
    /**
     * The {@link MethodProps} for configuring how this method behaves at runtime.
     */
    readonly props: MethodProps,
    /**
     * Function that maps an API request to an integration request and calls an
     * integration. This will be compiled to a VTL request mapping template and
     * an API GW integration.
     *
     * There are limitations on what is allowed within this Function:
     * 1. the integration call must be returned
     *
     * ```ts
     * () => {
     *   // VALID
     *   return lambda();
     * }
     *
     * // VALID
     * () => lambda();
     *
     * // INVALID - API Gateway always returns the integration response
     * lambda();
     *
     * // INVALID
     * const result = lambda()
     * result... // the request mapping template terminates when the call is made
     * ```
     * 2. an integration must be at the top-level
     *
     * ```ts
     * () => {
     *   // valid
     *   lambda();
     *   return lambda();
     *
     *   if (condition) {
     *     // INVALID - conditional integrations are not supported by AWS
     *     lambda();
     *   }
     *
     *   while (condition) {
     *     // INVALID - API Gateway only supports one call per integration
     *     lambda();
     *   }
     * }}
     * ```
     */
    request: (
      $input: ApiGatewayInput<Request>,
      $context: ApiGatewayContext
    ) => Promise<IntegrationResponse> | IntegrationResponse,
    /**
     * Function that maps an integration response to a 200 method response.
     *
     * Example 1 - return the exact payload received from the integration
     * ```ts
     * ($input) => {
     *   return $input.data;
     * }
     * ```
     *
     * Example 2 - modify the data returned
     * ```ts
     * ($input) => {
     *   return {
     *     status: "success"
     *     name: $input.data.name
     *   };
     * }
     * ```
     *
     * Example 3 - return a different payload based on a condition
     *
     * ```ts
     * ($input) => {
     *   if ($input.data.status === "SUCCESS") {
     *     return $input.data;
     *   } else {
     *     return null;
     *   }
     * }
     * ```
     */
    response: (
      $input: ApiGatewayInput<
        { body: IntegrationResponse } & Omit<Request, "body">
      >,
      $context: ApiGatewayContext
    ) => Promise<MethodResponse> | MethodResponse,
    /**
     * Map of status codes to a function defining the  response to return. This is used
     * to configure the failure path method responses, for e.g. when an integration fails.
     *
     * Example 1 - return the exact payload received from the integration
     * ```ts
     * ($input) => {
     *   return $input.data;
     * }
     * ```
     *
     * Example 2 - modify the data returned
     * ```ts
     * ($input) => {
     *   return {
     *     status: "success"
     *     name: $input.data.name
     *   };
     * }
     * ```
     *
     * Example 3 - return a different payload based on a condition
     *
     * ```ts
     * ($input) => {
     *   if ($input.data.status === "SUCCESS") {
     *     return $input.data;
     *   } else {
     *     return null;
     *   }
     * }
     * ```
     */
    errors?: {
      [statusCode: number]: (
        $input: ApiGatewayInput<Request>,
        $context: ApiGatewayContext
      ) => any;
    }
  ) {
    const requestDecl = validateFunctionLike(request, "AwsMethod Request");
    const responseDecl = validateFunctionLike(response, "AwsMethod Response");
    const errorDecls = Object.fromEntries(
      Object.entries(errors ?? {}).map(([k, v]) => [
        k,
        validateFunctionLike(v, `AwsMethod ${k}`),
      ])
    );
    const role = getRole(props);
    const responseTemplate = new APIGatewayVTL(role, "response");
    responseTemplate.eval(responseDecl.body);
    const requestTemplate = new APIGatewayVTL(role, "request");
    requestTemplate.eval(requestDecl.body);

    const integration = requestTemplate.integration;

    const errorResponses: aws_apigateway.IntegrationResponse[] = Object.entries(
      errorDecls
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
      ...Object.keys(errorDecls).map((statusCode) => ({
        statusCode,
      })),
    ];

    super(
      "AwsMethod",
      props.resource.addMethod(props.httpMethod, apiGwIntegration, {
        methodResponses,
      })
    );
  }
}

/**
 * Configuration properties for a {@link LambdaMethod}.
 */
export interface LambdaMethodProps
  extends Omit<
    aws_apigateway.LambdaIntegrationOptions,
    | "requestParameters"
    | "requestTemplates"
    | "integrationResponses"
    | "passthroughBehavior"
    | "proxy"
  > {
  /**
   * The {@link HttpMethod} this integration is for.
   */
  readonly httpMethod: HttpMethod;
  /**
   * The REST Resource ({@link aws_apigateway.IResource}) to implement the Method for.
   */
  readonly resource: aws_apigateway.IResource;
  /**
   * The {@link Function} to proxy the HTTP request to.
   *
   * This Function must accept a {@link APIGatewayProxyEvent} request payload and
   * return a {@link APIGatewayProxyResult} response payload.
   */
  readonly function: Function<APIGatewayProxyEvent, APIGatewayProxyResult>;
}

/**
 * Creates a {@link api_gateway.Method} implemented by a {@link Function}.
 *
 * HTTP requests are proxied directly to a {@link Function}.
 *
 * @see {@link APIGatewayProxyEvent}
 * @see {@link APIGatewayProxyResult}
 */
export class LambdaMethod {
  /**
   * The {@link Function} that will process the HTTP request.
   */
  readonly function;

  /**
   * The underlying {@link aws_apigateway.Method} configuration.
   */
  readonly method;

  constructor(private readonly props: LambdaMethodProps) {
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

type ExcludeNullOrUndefined<T> = T extends undefined | null | infer X ? X : T;

type IfNever<T, Default> = T extends never ? Default : T;

type Params<Request extends ApiRequest> = Exclude<
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
   *
   * Overrides are final. An override may only be applied to each parameter once. Trying to override the same parameter multiple times will result in 5XX responses from Amazon API Gateway. If you must override the same parameter multiple times throughout the template, we recommend creating a variable and applying the override at the end of the template. Note that the template is applied only after the entire template is parsed.
   */
  readonly requestOverride: APIGatewayRequestOverride;
  /**
   * Response properties that can be overridden.
   *
   * Overrides are final. An override may only be applied to each parameter once. Trying to override the same parameter multiple times will result in 5XX responses from Amazon API Gateway. If you must override the same parameter multiple times throughout the template, we recommend creating a variable and applying the override at the end of the template. Note that the template is applied only after the entire template is parsed.
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

const singletonConstruct = <T extends Construct, S extends Construct>(
  scope: S,
  id: string,
  create: (scope: S, id: string) => T
): T => {
  const child = scope.node.tryFindChild(id);
  return child ? (child as T) : create(scope, id);
};

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
