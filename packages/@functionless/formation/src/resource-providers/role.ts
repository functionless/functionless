import { CreateRoleCommand, Tag } from "@aws-sdk/client-iam";
import * as iam from "@aws-sdk/client-iam";
import {
  CreateRequest,
  DeleteRequest,
  ResourceOperationResult,
  ResourceOperationResultMetadata,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import short_uuid from "short-uuid";

export interface RoleResource {
  AssumeRolePolicyDocument: any;
  Description?: string;
  ManagedPolicyArns?: string[];
  MaxSessionDuration?: number;
  Path?: string;
  PermissionsBoundary?: string;
  Policies?: any[];
  RoleName?: string;
  Tags?: Tag[];
}

export class RoleProvider implements ResourceProvider<RoleResource> {
  readonly Type = "AWS::IAM::Role";
  private iamClient: iam.IAMClient;

  constructor(props: ResourceProviderProps) {
    this.iamClient = new iam.IAMClient(props.sdkConfig);
  }
  async create(
    request: CreateRequest<RoleResource>
  ): ResourceOperationResult<RoleResource> {
    const { AssumeRolePolicyDocument, Policies, ...def } = request.definition;
    const result = await this.iamClient.send(
      new CreateRoleCommand({
        // TODO: make this relative to the stack?
        RoleName: request.definition.RoleName
          ? request.definition.RoleName
          : `${request.logicalId}-${short_uuid.generate()}`,
        ...def,
        AssumeRolePolicyDocument: JSON.stringify(AssumeRolePolicyDocument),
      })
    );

    const policyAdds = await Promise.allSettled(
      Policies?.map((p) =>
        this.iamClient.send(
          new iam.PutRolePolicyCommand({
            RoleName: result.Role?.RoleName,
            PolicyDocument: JSON.stringify(p),
            PolicyName: undefined,
          })
        )
      ) ?? []
    );
    const policyFailures = policyAdds.filter(
      (x): x is PromiseRejectedResult => x.status === "rejected"
    );
    if (policyFailures.length > 0) {
      throw new Error(
        policyFailures
          .map((p) => `Role failed to add policy: ${p.reason}`)
          .join("\n")
      );
    }

    await iam.waitUntilRoleExists(
      { client: this.iamClient, maxWaitTime: 40 },
      { RoleName: result.Role?.RoleName }
    );

    return {
      resource: {
        Attributes: {
          Arn: result.Role?.Arn,
          RoleId: result.Role?.RoleId,
        },
        InputProperties: request.definition,
        Type: this.Type,
        PhysicalId: result.Role?.RoleName,
      },
      paddingMillis: 10000,
    };
  }
  update(
    _request: UpdateRequest<RoleResource>
  ): ResourceOperationResult<RoleResource> {
    throw new Error("Method not implemented.");
  }
  delete(
    _request: DeleteRequest<RoleResource>
  ): Promise<void | ResourceOperationResultMetadata> {
    throw new Error("Method not implemented.");
  }
}
