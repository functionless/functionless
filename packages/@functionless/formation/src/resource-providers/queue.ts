import {
  CreateRequest,
  DeleteRequest,
  ResourceOperationResult,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import * as sqs from "@aws-sdk/client-sqs";
import type { Tag } from "@aws-sdk/client-iam";
import short_uuid from "short-uuid";
import path from "path";

export interface QueueResource {
  ContentBasedDeduplication?: boolean;
  DeduplicationScope?: string;
  DelaySeconds?: number;
  FifoQueue?: boolean;
  FifoThroughputLimit?: string;
  KmsDataKeyReusePeriodSeconds?: number;
  KmsMasterKeyId?: string;
  MaximumMessageSize?: number;
  MessageRetentionPeriod?: number;
  QueueName?: string;
  ReceiveMessageWaitTimeSeconds?: number;
  RedriveAllowPolicy?: any;
  RedrivePolicy?: any;
  SqsManagedSseEnabled?: boolean;
  Tags?: Tag[];
  VisibilityTimeout?: number;
}

export class QueueProvider implements ResourceProvider<QueueResource> {
  readonly Type = "AWS::SQS::Queue";
  private sqsClient: sqs.SQSClient;

  constructor(private props: ResourceProviderProps) {
    this.sqsClient = new sqs.SQSClient(props.sdkConfig);
  }

  async create(request: CreateRequest<QueueResource>) {
    const { QueueName, Tags, ...attributes } = request.definition;
    const result = await this.sqsClient.send(
      new sqs.CreateQueueCommand({
        QueueName:
          QueueName ??
          // The name of a FIFO queue can only include alphanumeric characters, hyphens, or underscores, must end with .fifo suffix and be 1 to 80 in length.
          `${`${request.logicalId}-${short_uuid.generate()}`.substring(
            0,
            attributes.FifoQueue ? 75 : 80
          )}${attributes.FifoQueue ? ".fifo" : ""}`,
        Attributes: {
          ...Object.fromEntries(
            Object.entries(attributes).map(([key, value]) => [
              key,
              typeof value === "string" ? value : JSON.stringify(value),
            ])
          ),
        },
        tags: Object.fromEntries(Tags?.map((t) => [t.Key, t.Value]) ?? []),
      })
    );
    const queueUrl = result.QueueUrl;
    if (!queueUrl) {
      throw new Error("Something went wrong");
    }

    const name = path.basename(queueUrl);

    return {
      PhysicalId: name,
      Attributes: {
        Arn: `arn:aws:sqs:${this.props.region}:${this.props.account}:${name}`,
        QueueName: name,
        QueueUrl: queueUrl,
      },
      Type: this.Type,
      InputProperties: request.definition,
    };
  }
  update(
    _request: UpdateRequest<QueueResource>
  ): ResourceOperationResult<QueueResource> {
    throw new Error("Method not implemented.");
  }
  delete(_request: DeleteRequest<QueueResource>): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
