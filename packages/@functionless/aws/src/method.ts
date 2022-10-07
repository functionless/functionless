import type { aws_apigateway } from "aws-cdk-lib";
import { ExpressStepFunction } from "./express-step-function";
import { LambdaFunction } from "./lambda-function";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

type TaggedParam<Tag extends string, Value> = {
  tag: Tag;
  value: Value;
};

export type PathParam<T> = TaggedParam<"path", T>;

type TaggedKeys<Tag extends string, T extends object> = {
  [K in keyof T]: T[K] extends TaggedParam<Tag, any> ? K : never;
}[keyof T];

type TaggedParams<Tag extends string, T extends object> = {
  [K in TaggedKeys<Tag, T>]: T[K] extends TaggedKeys<Tag, infer Inner>
    ? Inner
    : never;
};

type RemoveTags<T extends object> = {
  [K in keyof T]: T[K] extends TaggedParam<any, infer Inner> ? Inner : T[K];
};

export type ApiRequestEvent<Request extends object> = {
  _request?: APIGatewayProxyEvent & {
    pathParams: TaggedParams<"path", Request>;
  };
} & RemoveTags<Request>;

export type MethodHandlerFunction<in In = any, Out = any> = (
  input: In
) => Promise<Out>;

export const MethodKind = "fl.Method";

export interface MethodProps
  extends Pick<aws_apigateway.MethodProps, "httpMethod"> {}

export type MethodHandler<
  RequestEvent extends object,
  Result extends APIGatewayProxyResult = APIGatewayProxyResult
> = (request: ApiRequestEvent<RequestEvent>) => Promise<Result>;

export type MethodIntegration<
  RequestEvent extends object,
  Result extends APIGatewayProxyResult = APIGatewayProxyResult
> =
  | LambdaFunction<MethodHandler<RequestEvent, Result>>
  | ExpressStepFunction<MethodHandler<RequestEvent, Result>>;

export interface Method<
  RequestEvent extends object = object,
  Result extends APIGatewayProxyResult = APIGatewayProxyResult
> {
  kind: typeof MethodKind;
  handler: MethodIntegration<RequestEvent, Result>;
  props: MethodProps;
}

export function isMethod(a: any): a is Method {
  return a?.kind === MethodKind;
}

export function Method<
  RequestEvent extends object,
  Result extends APIGatewayProxyResult = APIGatewayProxyResult
>(
  handler: MethodIntegration<RequestEvent, Result>
): Method<RequestEvent, Result>;

export function Method<
  RequestEvent extends object,
  Result extends APIGatewayProxyResult = APIGatewayProxyResult
>(
  props: MethodProps,
  handler: MethodIntegration<RequestEvent, Result>
): Method<RequestEvent, Result>;

export function Method<
  RequestEvent extends object,
  Result extends APIGatewayProxyResult = APIGatewayProxyResult
>(
  handlerOrProps: MethodIntegration<RequestEvent, Result> | MethodProps,
  handlerOrUndefined?: MethodIntegration<RequestEvent, Result>
): Method<RequestEvent, Result> {
  const handler =
    typeof handlerOrProps === "function" ? handlerOrProps : handlerOrUndefined!;
  const props = typeof handlerOrProps === "object" ? handlerOrProps : undefined;

  function method(event: APIGatewayProxyEvent, ...args: any[]) {
    /* eslint-disable turbo/no-undeclared-env-vars */
    if (
      // @ts-ignore
      process.env.RESOURCE_ID === handler.resourceId ||
      process.env.FL_LOCAL === "true"
    ) {
      /* eslint-enable turbo/no-undeclared-env-vars */
      const merged: ApiRequestEvent<RequestEvent> = {
        ...(event.body ? JSON.parse(event.body) : {}),
        ...event.pathParameters,
        _request: event,
      };

      // this is the API being invoked
      // @ts-ignore
      return handler(merged, ...args);
    } else {
      // this is a Lambda Function directly invoking this API
      // axios
      throw new Error("Not Implemented");
    }
  }
  Object.assign(method, <Method<RequestEvent, Result>>{
    kind: MethodKind,
    handler,
    props,
  });
  Object.defineProperty(handler, "RESOURCE_ID", {
    // @ts-ignore
    get: () => method.RESOURCE_ID,
  });
  return method as any;
}
