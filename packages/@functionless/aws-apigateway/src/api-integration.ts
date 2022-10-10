import type { aws_apigateway, aws_iam } from "aws-cdk-lib";
import type { CallExpr } from "@functionless/ast";
import { APIGatewayVTL } from "./api-vtl";

export interface ApiGatewayIntegration {
  apiGWVtl: ApiGatewayVtlIntegration;
}

export function isApiGatewayIntegration(a: any): a is ApiGatewayIntegration {
  return typeof a?.apiGWVtl?.createIntegration === "function";
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
