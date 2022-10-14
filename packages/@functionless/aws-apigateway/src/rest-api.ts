import type { aws_apigateway } from "aws-cdk-lib";

export const RestApiKind = "fl.RestApi";

export interface RestApi extends aws_apigateway.RestApi {
  kind: typeof RestApiKind;
  props?: aws_apigateway.RestApiProps;
}

export function isRestApi(a: any): a is RestApi {
  return a?.kind === RestApiKind;
}

export function RestApi(props?: aws_apigateway.RestApiProps): RestApi {
  return <RestApi>{
    kind: RestApiKind,
    props,
  };
}
