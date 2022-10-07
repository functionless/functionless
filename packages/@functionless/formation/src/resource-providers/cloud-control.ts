import {
  CreateRequest,
  DeleteRequest,
  ResourceProvider as ResourceProvider,
  ResourceProviderProps as ResourceProviderProps,
  ResourceProviderRetryConfig,
  UpdateRequest,
} from "../resource-provider";
import * as control from "@aws-sdk/client-cloudcontrol";
import {
  PhysicalProperties,
  PhysicalResource,
  ResourceType,
} from "../resource";
import { awsSDKRetry } from "../util";
import { compare } from "fast-json-patch";

/**
 * Cloud control supports many, but not a complete set of all AWS resource.
 *
 * CC is also slower.
 *
 * https://docs.aws.amazon.com/cloudcontrolapi/latest/userguide/supported-resources.html
 */
export class CloudControlProvider
  implements ResourceProvider<PhysicalProperties>
{
  readonly Type = "AWS::SQS::QueuePolicy";
  private controlClient: control.CloudControlClient;

  constructor(props: ResourceProviderProps) {
    this.controlClient = new control.CloudControlClient(props.sdkConfig);
  }
  retry: ResourceProviderRetryConfig = { canRetry: true };
  async create(
    request: CreateRequest<PhysicalProperties>
  ): Promise<
    PhysicalResource | { paddingMillis: number; resource: PhysicalResource }
  > {
    // TODO create logger
    const properties = request.definition;
    console.log(`Creating ${request.logicalId} (${request.resourceType})`);
    const props = (() => {
      if (request.resourceType === "AWS::DynamoDB::Table") {
        // dynamo table pay_per_request fails when ProvisionedThroughput is present.
        if (properties.BillingMode === "PAY_PER_REQUEST ") {
          const { ProvisionedThroughput, ...props } = properties;
          return props;
        }
      }
      return properties;
    })();
    try {
      console.log(
        `Starting Create for ${request.resourceType}: ${request.logicalId}`
      );
      const controlApiResult = await awsSDKRetry(() =>
        this.controlClient.send(
          new control.CreateResourceCommand({
            TypeName: request.resourceType,
            DesiredState: JSON.stringify(props),
          })
        )
      );

      return this.waitForProgress(
        request.logicalId,
        request.resourceType,
        request.definition,
        controlApiResult.ProgressEvent!
      );
    } catch (err) {
      console.error(
        `error while deploying (${(<any>err).message}) ${request.logicalId} (${
          request.resourceType
        }) with props ${JSON.stringify(props, null, 2)}`
      );
      throw err;
    }
  }
  async update(request: UpdateRequest<PhysicalProperties>) {
    const patch = compare(request.previous, request.definition);
    if (patch.length === 0) {
      console.log(
        `Skipping Update of ${request.logicalId} (${request.resourceType})`
      );
      return request.previous;
    }
    console.log(`Updating ${request.logicalId} (${request.resourceType})`);
    const controlApiResult = await awsSDKRetry(() =>
      this.controlClient.send(
        new control.UpdateResourceCommand({
          TypeName: request.resourceType,
          PatchDocument: JSON.stringify(patch),
          Identifier: request.previous.PhysicalId,
        })
      )
    );

    return await this.waitForProgress(
      request.logicalId,
      request.resourceType,
      request.definition,
      controlApiResult.ProgressEvent!
    );
  }
  async delete(request: DeleteRequest<PhysicalProperties>) {
    // RDS defaults to Snapshot in certain conditions, so we detect them and error here
    // since we don't yet support DeletionPolicy.Snapshot
    if (
      request.resourceType === "AWS::RDS::DBCluster" ||
      (request.resourceType === "AWS::RDS::DBInstance" &&
        request.previous.InputProperties.DBClusterIdentifier === undefined)
    ) {
      throw new Error(`Implicit Snapshot is not supported for RDS`);
    }

    const progress = (
      await awsSDKRetry(() =>
        this.controlClient.send(
          new control.DeleteResourceCommand({
            TypeName: request.resourceType,
            Identifier: request.physicalId,
          })
        )
      )
    ).ProgressEvent;

    await this.waitForProgress(
      request.logicalId,
      request.resourceType,
      request.previous.InputProperties,
      progress!
    );
  }

  private async waitForProgress(
    logicalId: string,
    type: ResourceType,
    properties: PhysicalProperties,
    progress: control.ProgressEvent
  ): Promise<PhysicalResource> {
    do {
      const opStatus = progress.OperationStatus;
      if (opStatus === "SUCCESS") {
        console.log(`${progress.Operation} Success: ${logicalId} (${type})`);
        try {
          const attributes =
            progress.Operation === "DELETE"
              ? undefined
              : (
                  await awsSDKRetry(() =>
                    this.controlClient.send(
                      new control.GetResourceCommand({
                        TypeName: progress.TypeName,
                        Identifier: progress.Identifier!,
                      })
                    )
                  )
                ).ResourceDescription?.Properties;

          return {
            Type: type,
            PhysicalId: progress?.Identifier!,
            InputProperties: properties,
            Attributes: attributes ? JSON.parse(attributes) : {},
          };
        } catch (err) {
          // some resources fail when calling GET even after succeeding
          return {
            Type: type,
            PhysicalId: progress?.Identifier!,
            InputProperties: properties,
            Attributes: {},
          };
        }
      } else if (opStatus === "FAILED") {
        const errorMessage = `Failed to ${
          progress.Operation ?? "Update"
        } ${logicalId} (${type})${
          progress.StatusMessage ? ` ${progress.StatusMessage}` : ""
        }`;
        console.log(errorMessage);
        throw new Error(errorMessage);
      }

      const retryAfter = progress?.RetryAfter?.getTime();
      const waitTime = Math.max(retryAfter ? retryAfter - Date.now() : 50, 50);
      console.log(`Waiting for (${waitTime}): ${logicalId}`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));

      try {
        progress = (
          await awsSDKRetry(() =>
            this.controlClient.send(
              new control.GetResourceRequestStatusCommand({
                RequestToken: progress?.RequestToken,
              })
            )
          )
        ).ProgressEvent!;
      } catch (err) {
        console.error("error waiting for ", logicalId, err);
        throw err;
      }
    } while (true);
  }
}
