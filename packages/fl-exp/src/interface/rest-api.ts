import type * as cdk from "aws-cdk-lib";

export const RestApiKind = "fl.RestApi";

export interface RestApi extends cdk.aws_apigateway.RestApi {
  kind: typeof RestApiKind;
  props?: cdk.aws_apigateway.RestApiProps;
}

export function isRestApi(a: any): a is RestApi {
  return a?.kind === RestApiKind;
}

export function RestApi(props?: cdk.aws_apigateway.RestApiProps): RestApi {
  return <RestApi>{
    kind: RestApiKind,
    props,
  };
}
