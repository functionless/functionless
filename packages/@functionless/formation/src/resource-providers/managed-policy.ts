import * as iam from "@aws-sdk/client-iam";
import {
  CreateRequest,
  DeleteRequest,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import { ManagedPolicyResource } from "../resource-types";
import { awsSDKRetry } from "../util";

export class ManagedPolicyProvider
  implements ResourceProvider<ManagedPolicyResource>
{
  readonly Type = "AWS::IAM::Policy";
  private iamClient: iam.IAMClient;

  constructor(private definition: ResourceProviderProps) {
    this.iamClient = new iam.IAMClient(definition.sdkConfig);
  }

  async create(request: CreateRequest<ManagedPolicyResource>) {
    return this.createUpdate(request.logicalId, request.definition);
  }
  async update(request: UpdateRequest<ManagedPolicyResource>) {
    return this.createUpdate(request.logicalId, request.definition);
  }
  delete(_request: DeleteRequest<ManagedPolicyResource>): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async createUpdate(logicalId: string, definition: ManagedPolicyResource) {
    // create the role
    let result: {
      arn: string;
      groups: string[];
      roles: string[];
      users: string[];
    };
    try {
      const r = await awsSDKRetry(() =>
        this.iamClient.send(
          new iam.CreatePolicyCommand({
            PolicyDocument: JSON.stringify(definition.PolicyDocument),
            // fix name
            PolicyName: definition.ManagedPolicyName ?? logicalId,
            Description: definition.Description,
            Path: definition.Path,
          })
        )
      );
      if (!r.Policy || !r.Policy.Arn) {
        throw new Error("Expected policy");
      }
      iam.waitUntilPolicyExists(
        { client: this.iamClient, maxWaitTime: 10 },
        { PolicyArn: r.Policy.Arn }
      );
      result = {
        arn: r.Policy.Arn,
        groups: [],
        roles: [],
        users: [],
      };
    } catch (err) {
      let _err = err as { name: string };
      // if the entity exists, just provide the arn and move on.
      // TODO: check if the role attachments need to change.
      if (_err.name === "EntityAlreadyExists") {
        // todoL managed policy name must be more unique
        const name = definition.ManagedPolicyName ?? logicalId;

        const arn = `arn:aws:iam::${this.definition.account}:policy/${name}`;
        let entities: Pick<
          iam.ListEntitiesForPolicyCommandOutput,
          "PolicyGroups" | "PolicyRoles" | "PolicyUsers"
        > = {};
        let response: iam.ListEntitiesForPolicyCommandOutput = {
          IsTruncated: true,
          $metadata: {},
        };
        const versions = await awsSDKRetry(() =>
          this.iamClient.send(
            new iam.ListPolicyVersionsCommand({ PolicyArn: arn })
          )
        );
        // prune
        if (versions.Versions && versions.Versions.length >= 5) {
          const nonDefaultVersions = versions.Versions.filter(
            (v) => !v.IsDefaultVersion
          );
          const oldestDate = Math.min(
            ...nonDefaultVersions.map(
              (v) => v.CreateDate?.getTime() ?? Number.MAX_SAFE_INTEGER
            )
          );
          const oldest = nonDefaultVersions.find(
            (v) => v.CreateDate?.getTime() === oldestDate
          )!;
          await awsSDKRetry(() =>
            this.iamClient.send(
              new iam.DeletePolicyVersionCommand({
                PolicyArn: arn,
                VersionId: oldest.VersionId,
              })
            )
          );
        }
        await awsSDKRetry(() =>
          this.iamClient.send(
            new iam.CreatePolicyVersionCommand({
              PolicyArn: arn,
              PolicyDocument: JSON.stringify(definition.PolicyDocument),
              SetAsDefault: true,
            })
          )
        );
        while (response.IsTruncated) {
          response = await awsSDKRetry(() =>
            this.iamClient.send(
              new iam.ListEntitiesForPolicyCommand({ PolicyArn: arn })
            )
          );
          entities = {
            PolicyGroups: [
              ...(entities.PolicyGroups ?? []),
              ...(response.PolicyGroups ?? []),
            ],
            PolicyRoles: [
              ...(entities.PolicyRoles ?? []),
              ...(response.PolicyRoles ?? []),
            ],
            PolicyUsers: [
              ...(entities.PolicyUsers ?? []),
              ...(response.PolicyUsers ?? []),
            ],
          };
        }

        result = {
          arn,
          groups: (entities.PolicyGroups ?? [])
            .map((g) => g.GroupName)
            .filter((g): g is string => !!g),
          roles: (entities.PolicyRoles ?? [])
            .map((r) => r.RoleName)
            .filter((r): r is string => !!r),
          users: (entities.PolicyUsers ?? [])
            .map((u) => u.UserName)
            .filter((u): u is string => !!u),
        };
      } else {
        throw err;
      }
    }
    const addGroups = (definition.Groups ?? []).filter(
      (g) => !result.groups.includes(g)
    );
    // then attach the groups and roles and users
    const attachGroups = addGroups.map((group) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new iam.AttachGroupPolicyCommand({
            GroupName: group,
            PolicyArn: result.arn,
          })
        )
      )
    );
    const removeGroups = definition.Groups
      ? result.groups.filter((g) => !definition.Groups!.includes(g))
      : [];
    const detachGroups = removeGroups.map((g) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new iam.DetachGroupPolicyCommand({
            GroupName: g,
            PolicyArn: result.arn,
          })
        )
      )
    );
    const addRoles = (definition.Roles ?? []).filter(
      (r) => !result.roles.includes(r)
    );
    const attachRoles = addRoles.map((role) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new iam.AttachRolePolicyCommand({
            RoleName: role,
            PolicyArn: result.arn,
          })
        )
      )
    );
    const removeRoles = definition.Roles
      ? result.roles.filter((r) => !definition.Roles!.includes(r))
      : [];
    const detachRoles = removeRoles.map((r) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new iam.DetachRolePolicyCommand({
            RoleName: r,
            PolicyArn: result.arn,
          })
        )
      )
    );
    const addUsers = (definition.Users ?? []).filter(
      (r) => !result.users.includes(r)
    );
    const attachUser = addUsers.map((user) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new iam.AttachUserPolicyCommand({
            UserName: user,
            PolicyArn: result.arn,
          })
        )
      )
    );
    const removeUsers = definition.Users
      ? result.users.filter((u) => !definition.Users!.includes(u))
      : [];
    const detachUsers = removeUsers.map((u) =>
      awsSDKRetry(() =>
        this.iamClient.send(
          new iam.DetachUserPolicyCommand({
            UserName: u,
            PolicyArn: result.arn,
          })
        )
      )
    );

    const attachResults = await Promise.allSettled([
      ...attachGroups,
      ...detachGroups,
      ...attachRoles,
      ...detachRoles,
      ...attachUser,
      ...detachUsers,
    ]);

    const failedAttaches = attachResults.filter(
      (a): a is PromiseRejectedResult => a.status === "rejected"
    );
    if (failedAttaches.length > 1) {
      throw new Error(
        `Attaching or detaching roles, groups, or users of a Policy failed: ${failedAttaches
          .map((a) => a.reason)
          .join("\n")}`
      );
    }

    return {
      resource: {
        PhysicalId: result.arn,
        Type: this.Type,
        InputProperties: definition,
        Attributes: {
          Arn: result.arn,
        },
      },
      // add a max of 10 second padding after adding any managed policy
      paddingMillis: 10000,
    };
  }
}
