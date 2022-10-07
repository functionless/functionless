import {
  CreateRequest,
  DeleteRequest,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import { SQSQueuePolicyResource } from "../resource-types";
import * as sqs from "@aws-sdk/client-sqs";

export class QueuePolicyProvider
  implements ResourceProvider<SQSQueuePolicyResource>
{
  readonly Type = "AWS::SQS::QueuePolicy";
  private sqsClient: sqs.SQSClient;

  constructor(props: ResourceProviderProps) {
    this.sqsClient = new sqs.SQSClient(props.sdkConfig);
  }

  async create(request: CreateRequest<SQSQueuePolicyResource>) {
    return this.createUpdate(request.logicalId, request.definition);
  }
  async update(request: UpdateRequest<SQSQueuePolicyResource>) {
    return this.createUpdate(request.logicalId, request.definition);
  }
  delete(_request: DeleteRequest<SQSQueuePolicyResource>): Promise<void> {
    throw new Error("Method not implemented.");
  }

  async createUpdate(logicalId: string, definition: SQSQueuePolicyResource) {
    const result = await Promise.allSettled(
      definition.Queues.map((q) =>
        this.sqsClient.send(
          new sqs.SetQueueAttributesCommand({
            Attributes: {
              Policy: JSON.stringify(definition.PolicyDocument),
            },
            QueueUrl: q,
          })
        )
      )
    );
    const failures = result.filter(
      (x): x is PromiseRejectedResult => x.status === "rejected"
    );
    if (failures.length > 0) {
      throw new Error(
        `Queue Policy failed to update (${logicalId}): ${failures
          .map((f) => f.reason)
          .join("\n")}`
      );
    }
    return {
      PhysicalId: undefined,
      Attributes: {},
      Type: this.Type,
      InputProperties: definition,
    };
  }
}
