import type { aws_apigateway, aws_iam } from "aws-cdk-lib";
import { CallExpr } from "@functionless/ast";
import { VTLContext } from "./vtl-context";

/**
 * Hooks used to create API Gateway integrations.
 */
export interface ApiGatewayVtlIntegration {
  /**
   * Render the Request Payload as a VTL string.
   */
  renderRequest: (call: CallExpr, context: VTLContext) => string;

  /**
   * Construct an API GW integration.
   */
  createIntegration: (
    options: aws_apigateway.IntegrationOptions & {
      credentialsRole: aws_iam.IRole;
    }
  ) => aws_apigateway.Integration;
}
