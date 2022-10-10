import {
  IAMClient,
  PutGroupPolicyCommand,
  PutRolePolicyCommand,
  PutUserPolicyCommand,
} from "@aws-sdk/client-iam";
import {
  CreateRequest,
  DeleteRequest,
  ResourceOperationResult,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import { PolicyResource } from "../resource-types";
import { awsSDKRetry } from "../util";

/**
 * TODO: Support update?
 */
export class InlinePolicyProvider implements ResourceProvider<PolicyResource> {
  readonly Type = "AWS::IAM::Policy";
  private iamClient: IAMClient;

  constructor(props: ResourceProviderProps) {
    this.iamClient = new IAMClient(props.sdkConfig);
  }

  async create(
    request: CreateRequest<PolicyResource>
  ): ResourceOperationResult<PolicyResource> {
    const definition = request.definition;
    const policyDocument = JSON.stringify(definition.PolicyDocument);
    const roles = definition.Roles?.map((r) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new PutRolePolicyCommand({
            PolicyDocument: policyDocument,
            PolicyName: definition.PolicyName,
            RoleName: r,
          })
        )
      )
    );
    const groups = definition.Groups?.map((g) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new PutGroupPolicyCommand({
            PolicyDocument: policyDocument,
            PolicyName: definition.PolicyName,
            GroupName: g,
          })
        )
      )
    );
    const users = definition.Users?.map((u) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new PutUserPolicyCommand({
            PolicyDocument: policyDocument,
            PolicyName: definition.PolicyName,
            UserName: u,
          })
        )
      )
    );

    await Promise.all([...(groups ?? []), ...(users ?? []), ...(roles ?? [])]);

    return {
      resource: {
        PhysicalId: undefined,
        Attributes: {},
        InputProperties: definition,
        Type: this.Type,
      },
      // add a max of 10 second padding after adding any policy
      paddingMillis: 10000,
    };
  }
  async update(
    _request: UpdateRequest<PolicyResource>
  ): ResourceOperationResult<PolicyResource> {
    throw new Error("Method not implemented.");
  }
  async delete(_request: DeleteRequest<PolicyResource>): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
