import { aws_apigateway } from "aws-cdk-lib";
import { isPropAccessExpr } from ".";
import { FunctionDecl, isFunctionDecl } from "./declaration";
import { isErr } from "./error";
import { isIdentifier, PropAccessExpr } from "./expression";
import { Function } from "./function";
import { FunctionlessNode } from "./node";
import { ExpressStepFunction } from "./step-function";

/**
 * HTTP Methods that API Gateway supports.
 */
export type HttpMethod =
  | "HEAD"
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
export interface ApiRequestProps<
  PathParams extends ParameterMap | undefined,
  Body extends object,
  QueryParams extends ParameterMap | undefined,
  HeaderParams extends ParameterMap | undefined
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
  Request extends ApiRequestProps<any, any, any, any>,
  IntegrationRequest
> = (req: Request) => IntegrationRequest;

type ResponseTransformerFunction<IntegrationResponse, MethodResponse> = (
  resp: IntegrationResponse
) => MethodResponse;

// TODO: support other types
type IntegrationTarget<IntegrationRequest, IntegrationResponse> =
  | Function<IntegrationRequest, IntegrationResponse>
  | ExpressStepFunction<IntegrationRequest, IntegrationResponse>;

interface BaseApiIntegration {
  /**
   * Add this integration as a Method to an API Gateway resource.
   *
   * TODO: this mirrors the AppsyncResolver.addResolver method, but it
   * is on the chopping block: https://github.com/functionless/functionless/issues/137
   * The 2 classes are conceptually similar so we should keep the DX in sync.
   */
  addMethod(httpMethod: HttpMethod, resource: aws_apigateway.Resource): void;
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
    Request extends ApiRequestProps<any, any, any, any>,
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

export interface MockApiIntegrationProps<
  Request extends ApiRequestProps<any, any, any, any>,
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
> implements BaseApiIntegration
{
  /**
   * This static property identifies this class as a MockApiIntegration to the Functionless plugin.
   */
  public static readonly FunctionlessType = "MockApiIntegration";

  private readonly request: FunctionDecl;
  private readonly responses: { [K in keyof Props["responses"]]: FunctionDecl };

  public constructor(props: Props) {
    this.request = validateFunctionDecl(props.request);
    this.responses = Object.fromEntries(
      Object.entries(props.responses).map(([k, v]) => [
        k,
        validateFunctionDecl(v),
      ])
    ) as { [K in keyof Props["responses"]]: FunctionDecl };
  }

  addMethod(httpMethod: HttpMethod, resource: aws_apigateway.Resource): void {
    const requestTemplate = toVTL(this.request, "request");

    const responseEntries: [string, FunctionDecl][] = Object.entries(
      this.responses
    );
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
  Request extends ApiRequestProps<any, any, any, any>,
  IntegrationRequest,
  IntegrationResponse,
  MethodResponse
> {
  /**
   * Map API request to an integration request.
   */
  request: RequestTransformerFunction<Request, IntegrationRequest>;
  /**
   * Integration target backing this API. The result of `request` will be sent.
   */
  integration: IntegrationTarget<IntegrationRequest, IntegrationResponse>;
  /**
   * Map integration response to a method response.
   * TODO: we need to handle multiple responses
   */
  response: ResponseTransformerFunction<IntegrationResponse, MethodResponse>;
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
  Props extends AwsApiIntegrationProps<any, any, any, any>
> implements BaseApiIntegration
{
  /**
   * This static property identifies this class as an AwsApiIntegration to the Functionless plugin.
   */
  public static readonly FunctionlessType = "AwsApiIntegration";

  private readonly request: FunctionDecl;
  private readonly response: FunctionDecl;
  private readonly integration: Props["integration"];

  constructor(props: Props) {
    this.request = validateFunctionDecl(props.request);
    this.response = validateFunctionDecl(props.response);
    this.integration = props.integration;
  }

  addMethod(httpMethod: HttpMethod, resource: aws_apigateway.Resource): void {
    const requestTemplate = toVTL(this.request, "request");
    const responseTemplate = toVTL(this.response, "response");

    const apiGWIntegration = this.integration.apiGWVtl.integration(
      requestTemplate,
      responseTemplate
    );

    // TODO: support requestParameters, authorizers, models and validators
    resource.addMethod(httpMethod, apiGWIntegration, {
      methodResponses: [
        {
          statusCode: "200",
        },
      ],
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
function toVTL(node: FunctionDecl, template: "request" | "response") {
  const statements = node.body.statements.map((stmt) => inner(stmt)).join("\n");

  if (template === "request") {
    return `#set($inputRoot = $input.path('$'))${statements}`;
  } else {
    return statements;
  }

  function inner(node: FunctionlessNode): string {
    switch (node.kind) {
      case "ArrayLiteralExpr":
        return `[${node.children.map(inner).join(",")}]`;

      case "BooleanLiteralExpr":
        return node.value.toString();

      case "NumberLiteralExpr":
        return node.value.toString();

      case "ObjectLiteralExpr":
        return `{${node.properties.map(inner).join(",")}}`;

      case "PropAccessExpr":
        if (descendedFromFunctionParameter(node)) {
          let param;
          if (template === "request") {
            switch (node.expr.name) {
              case "body":
                param = `$inputRoot.${node.name}`;
                break;
              case "pathParameters":
                param = `$input.params().path.${node.name}`;
                break;
              case "queryStringParameters":
                param = `$input.params().querystring.${node.name}`;
                break;
              case "headers":
                param = `$input.params().header.${node.name}`;
                break;
              default:
                throw new Error("Unknown parameter type.");
            }
            if (node.type === "string") {
              param = `"${param}"`;
            }
          } else {
            param = `$inputRoot.${node.name}`;
            if (node.type === "string") {
              return `"${param}"`;
            }
          }
          return param;
        }
        return `${inner(node.expr)}.${node.name};`;

      case "PropAssignExpr":
        return `${inner(node.name)}: ${inner(node.expr)}`;

      case "ReturnStmt":
        return inner(node.expr);

      case "StringLiteralExpr":
        return `"${node.value}"`;
    }
    throw new Error(`Unsupported node type: ${node.kind}`);
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

const isFunctionParameter = (node: FunctionlessNode) => {
  if (!isIdentifier(node)) return false;
  const ref = node.lookup();
  return ref?.kind === "ParameterDecl" && ref.parent?.kind === "FunctionDecl";
};

const descendedFromFunctionParameter = (
  node: PropAccessExpr
): node is PropAccessExpr & { expr: PropAccessExpr } => {
  if (isFunctionParameter(node.expr)) return true;
  return (
    isPropAccessExpr(node.expr) && descendedFromFunctionParameter(node.expr)
  );
};

/**
 * Hooks used to create API Gateway integrations.
 */
export interface ApiGatewayVtlIntegration {
  integration: (
    requestTemplate: string,
    responseTemplate: string
  ) => aws_apigateway.Integration;
}
