import { aws_events, aws_events_targets } from "aws-cdk-lib";
import { IRuleTarget } from "aws-cdk-lib/aws-events";
import { FunctionDecl } from "../..";
import { findService } from "../../util";

export const synthesizeEventBridgeTargets = (
  _decl: FunctionDecl
): IRuleTarget[] => {
  _decl.body.statements.map(statement => {
    const service = findService(statement);
    if(service) {
      if(service.kind === "Function") {
        new aws_events_targets.LambdaFunction(service.resource, {
          event: aws_events.RuleTargetInput.fromObject({  }),          
        })
      }
    }    
  })
};
