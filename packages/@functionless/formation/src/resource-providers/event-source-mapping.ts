import {
  CreateRequest,
  DeleteRequest,
  ResourceOperationResult,
  ResourceProvider,
  ResourceProviderProps,
  ResourceProviderRetryConfig,
  UpdateRequest,
} from "../resource-provider";
import * as lambda from "@aws-sdk/client-lambda";

export interface EventSourceMappingResource {
  AmazonManagedKafkaEventSourceConfig?: {
    ConsumerGroupId?: string;
  };
  BatchSize?: number;
  BisectBatchOnFunctionError?: boolean;
  DestinationConfig?: {
    OnFailure?: {
      Destination?: string;
    };
  };
  Enabled?: boolean;
  EventSourceArn?: string;
  FilterCriteria?: {
    Filters?: {
      Pattern?: string;
    }[];
  };
  FunctionName: string;
  FunctionResponseTypes?: string[];
  MaximumBatchingWindowInSeconds?: number;
  MaximumRecordAgeInSeconds?: number;
  MaximumRetryAttempts?: number;
  ParallelizationFactor?: number;
  Queues?: string[];
  SelfManagedEventSource?: {
    Endpoints?: {
      KafkaBootstrapServers?: string[];
    };
  };
  SelfManagedKafkaEventSourceConfig?: {
    ConsumerGroupId?: string;
  };
  SourceAccessConfigurations?: {
    Type?: string;
    URI?: string;
  }[];
  StartingPosition?: string;
  StartingPositionTimestamp?: number;
  Topics?: string[];
  TumblingWindowInSeconds?: number;
}

export class EventSourceMappingProvider
  implements ResourceProvider<EventSourceMappingResource>
{
  readonly Type = "AWS::Lambda::EventSourceMapping";
  private lambdaClient: lambda.LambdaClient;

  constructor(props: ResourceProviderProps) {
    this.lambdaClient = new lambda.LambdaClient(props.sdkConfig);
  }

  retry?: ResourceProviderRetryConfig | undefined = {
    canRetry: true,
  };

  async create(
    request: CreateRequest<EventSourceMappingResource>
  ): ResourceOperationResult<EventSourceMappingResource> {
    const { StartingPositionTimestamp, ...definition } = request.definition;
    const result = await this.lambdaClient.send(
      new lambda.CreateEventSourceMappingCommand({
        ...definition,
        StartingPositionTimestamp: StartingPositionTimestamp
          ? new Date(StartingPositionTimestamp)
          : undefined,
      })
    );

    return {
      resource: {
        Attributes: {
          Id: result.UUID,
        },
        PhysicalId: result.UUID,
        InputProperties: request.definition,
        Type: request.resourceType,
      },
    };
  }
  update(
    _request: UpdateRequest<EventSourceMappingResource>
  ): ResourceOperationResult<EventSourceMappingResource> {
    throw new Error("Method not implemented.");
  }
  delete(_request: DeleteRequest<EventSourceMappingResource>): Promise<void> {
    throw new Error("Method not implemented.");
  }
}
