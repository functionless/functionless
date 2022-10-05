import type * as cdk from "aws-cdk-lib";
export declare const RestApiKind = "fl.RestApi";
export interface RestApi extends cdk.aws_apigateway.RestApi {
    kind: typeof RestApiKind;
    props?: cdk.aws_apigateway.RestApiProps;
}
export declare function isRestApi(a: any): a is RestApi;
export declare function RestApi(props?: cdk.aws_apigateway.RestApiProps): RestApi;
//# sourceMappingURL=rest-api.d.ts.map