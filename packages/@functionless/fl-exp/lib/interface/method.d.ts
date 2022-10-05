import type { aws_apigateway } from "aws-cdk-lib";
import { ExpressStepFunction } from "./express-step-function";
import { LambdaFunction } from "./lambda-function";
import { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
declare type TaggedParam<Tag extends string, Value> = {
    tag: Tag;
    value: Value;
};
export declare type PathParam<T> = TaggedParam<"path", T>;
declare type TaggedKeys<Tag extends string, T extends object> = {
    [K in keyof T]: T[K] extends TaggedParam<Tag, any> ? K : never;
}[keyof T];
declare type TaggedParams<Tag extends string, T extends object> = {
    [K in TaggedKeys<Tag, T>]: T[K] extends TaggedKeys<Tag, infer Inner> ? Inner : never;
};
declare type RemoveTags<T extends object> = {
    [K in keyof T]: T[K] extends TaggedParam<any, infer Inner> ? Inner : T[K];
};
export declare type ApiRequestEvent<Request extends object> = {
    _request?: APIGatewayProxyEvent & {
        pathParams: TaggedParams<"path", Request>;
    };
} & RemoveTags<Request>;
export declare type MethodHandlerFunction<in In = any, Out = any> = (input: In) => Promise<Out>;
export declare const MethodKind = "fl.Method";
export interface MethodProps extends Pick<aws_apigateway.MethodProps, "httpMethod"> {
}
export declare type MethodHandler<RequestEvent extends object, Result extends APIGatewayProxyResult = APIGatewayProxyResult> = (request: ApiRequestEvent<RequestEvent>) => Promise<Result>;
export declare type MethodIntegration<RequestEvent extends object, Result extends APIGatewayProxyResult = APIGatewayProxyResult> = LambdaFunction<MethodHandler<RequestEvent, Result>> | ExpressStepFunction<MethodHandler<RequestEvent, Result>>;
export interface Method<RequestEvent extends object = object, Result extends APIGatewayProxyResult = APIGatewayProxyResult> {
    kind: typeof MethodKind;
    handler: MethodIntegration<RequestEvent, Result>;
    props: MethodProps;
}
export declare function isMethod(a: any): a is Method;
export declare function Method<RequestEvent extends object, Result extends APIGatewayProxyResult = APIGatewayProxyResult>(handler: MethodIntegration<RequestEvent, Result>): Method<RequestEvent, Result>;
export declare function Method<RequestEvent extends object, Result extends APIGatewayProxyResult = APIGatewayProxyResult>(props: MethodProps, handler: MethodIntegration<RequestEvent, Result>): Method<RequestEvent, Result>;
export {};
//# sourceMappingURL=method.d.ts.map