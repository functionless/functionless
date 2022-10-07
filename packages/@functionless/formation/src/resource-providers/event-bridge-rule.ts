import {
  CreateRequest,
  DeleteRequest,
  ResourceOperationResult,
  ResourceProvider,
  ResourceProviderProps,
  UpdateRequest,
} from "../resource-provider";
import * as events from "@aws-sdk/client-eventbridge";

export interface EventBusRuleResource {
  Description?: string;
  EventBusName?: string;
  EventPattern: object;
  Name?: string;
  RoleArn: string;
  ScheduleExpression?: string;
  State?: string;
  Targets?: EventBusRuleTarget[];
}

export interface EventBusRuleTarget {
  Arn: string;
  BatchParameters?: EventBusRuleBatchParameters;
  DeadLetterConfig?: {
    Arn: string;
  };
  EcsParameters?: EventBusRuleEcsParameters;
  HttpParameters?: {
    HeaderParameters?: Record<string, string>;
    PathParameterValues?: string[];
    QueryStringParameters?: Record<string, string>;
  };
  Id: string;
  Input?: string;
  InputPath?: string;
  InputTransformer?: {
    InputPathsMap?: Record<string, string>;
    InputTemplate: string;
  };
  KinesisParameters?: {
    PartitionKeyPath: string;
  };
  RedshiftDataParameters?: {
    Database: string;
    DbUser?: string;
    SecretManagerArn?: string;
    Sql: string;
    StatementName?: string;
    WithEvent?: boolean;
  };
  RetryPolicy?: {
    MaximumEventAgeInSeconds?: number;
    MaximumRetryAttempts?: number;
  };
  RoleArn?: string;
  RunCommandParameters?: {
    RunCommandTargets: {
      Key: string;
      Values: string[];
    }[];
  };
  SageMakerPipelineParameters?: {
    PipelineParameterList: {
      Name: string;
      Value: string;
    }[];
  };
  SqsParameters?: {
    MessageGroupId: string;
  };
}

export interface EventBusRuleBatchParameters {
  ArrayProperties: {
    Size: number;
  };
  JobDefinition: string;
  JobName: string;
  RetryStrategy: {
    Attempts: number;
  };
}

export interface EventBusRuleEcsParameters {
  CapacityProviderStrategy?: {
    Base: number;
    CapacityProvider: string;
    Weight: number;
  }[];
  EnableECSManagedTags?: boolean;
  EnableExecuteCommand?: boolean;
  Group?: string;
  LaunchType?: string;
  NetworkConfiguration?: {
    AwsVpcConfiguration?: {
      AssignPublicIp?: events.AssignPublicIp;
      SecurityGroups?: string[];
      Subnets: string[];
    };
  };
  PlacementConstraints?: {
    Expression: string;
    Type: string;
  }[];
  PlacementStrategies?: {
    Field?: string;
    Type?: string;
  }[];
  PlatformVersion?: string;
  PropagateTags?: string;
  ReferenceId?: string;
  TagList?: {
    Key?: string;
    Value?: string;
  }[];
  TaskCount?: number;
  TaskDefinitionArn: string;
}

export class EventBusRuleProvider
  implements ResourceProvider<EventBusRuleResource>
{
  private eventBridgeClient: events.EventBridgeClient;
  readonly Type = "AWS::Events::Rule";

  constructor(props: ResourceProviderProps) {
    this.eventBridgeClient = new events.EventBridgeClient(props.sdkConfig);
  }

  async create(
    request: CreateRequest<EventBusRuleResource>
  ): ResourceOperationResult<EventBusRuleResource> {
    return this.createUpdate(request.logicalId, request.definition);
  }
  update(
    request: UpdateRequest<EventBusRuleResource>
  ): ResourceOperationResult<EventBusRuleResource> {
    return this.createUpdate(request.logicalId, request.definition);
  }
  delete(_request: DeleteRequest<EventBusRuleResource>): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async createUpdate(
    logicalId: string,
    definition: EventBusRuleResource
  ): ResourceOperationResult<EventBusRuleResource> {
    const { Targets, ..._definition } = definition;

    const input: events.PutRuleCommandInput = {
      Name: definition.Name ?? logicalId,
      ..._definition,
      EventPattern: JSON.stringify(definition.EventPattern),
    };

    const r = await this.eventBridgeClient.send(
      new events.PutRuleCommand(input)
    );

    if (!r.RuleArn) {
      throw new Error("Expected rule arn");
    }

    // TODO: support removing targets on update or remove the old rule and recreate (destroying metrics?)
    await this.eventBridgeClient.send(
      new events.PutTargetsCommand({
        Rule: input.Name,
        Targets: definition.Targets?.map(transformTarget),
        EventBusName: definition.EventBusName,
      })
    );

    return {
      resource: {
        PhysicalId: r.RuleArn!,
        InputProperties: definition,
        Type: this.Type,
        Attributes: { Arn: r.RuleArn!, Id: input.Name },
      },
      // // https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-troubleshooting.html#eb-rule-does-not-match
      // // allow a "short period"
      // paddingMillis: 10000,
    };
  }
}

function transformTarget(target: EventBusRuleTarget): events.Target {
  return {
    ...target,
    // ESC configuration has a mix of casing that doesn't match the CFN schema.
    // https://docs.aws.amazon.com/eventbridge/latest/APIReference/API_EcsParameters.html
    EcsParameters: target.EcsParameters
      ? {
          ...target.EcsParameters,
          NetworkConfiguration: {
            ...target.EcsParameters?.NetworkConfiguration,
            awsvpcConfiguration: {
              ...target.EcsParameters?.NetworkConfiguration
                ?.AwsVpcConfiguration,
              Subnets:
                target.EcsParameters?.NetworkConfiguration?.AwsVpcConfiguration
                  ?.Subnets,
            },
          },
          TaskDefinitionArn: target.EcsParameters?.TaskDefinitionArn,
          CapacityProviderStrategy:
            target.EcsParameters?.CapacityProviderStrategy?.map((c) => ({
              capacityProvider: c.CapacityProvider,
              base: c.Base,
              Weight: c.Weight,
            })),
          PlacementConstraints: target.EcsParameters?.PlacementConstraints?.map(
            (p) => ({
              expression: p.Expression,
              type: p.Type,
            })
          ),
          PlacementStrategy: target.EcsParameters?.PlacementStrategies?.map(
            (s) => ({ field: s.Field, type: s.Type })
          ),
        }
      : undefined,
  };
}
