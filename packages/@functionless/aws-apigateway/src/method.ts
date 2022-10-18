import type { aws_apigateway } from "aws-cdk-lib";
import type { ExpressStepFunction } from "@functionless/aws-stepfunctions";
import type { LambdaFunction } from "@functionless/aws-lambda";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

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
    /* eslint-enable turbo/no-undeclared-env-vars */
    const merged: ApiRequestEvent<RequestEvent> = {
      ...(event.body ? JSON.parse(event.body) : {}),
      ...event.pathParameters,
      _request: event,
    };

    // this is the API being invoked
    // @ts-ignore
    return handler(merged, ...args);
  }
  Object.assign(method, <Method<RequestEvent, Result>>{
    kind: MethodKind,
    handler,
    props,
  });
  return method as any;
}
