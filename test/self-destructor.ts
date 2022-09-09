import { Stack } from "aws-cdk-lib";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";
import { $AWS, $SFN, Function, StepFunction, StepFunctionError } from "../src";

export interface SelfDestructorProps {
  /**
   * Default: 3600. (1 hour)
   */
  pollIntervalSeconds?: number;
  /**
   * Default: 43200 (12 hours)
   */
  selfDestructAfterSeconds?: number;
}

export class SelfDestructor extends Construct {
  constructor(scope: Construct, id: string, props?: SelfDestructorProps) {
    super(scope, id);

    const stack = Stack.of(this);
    // arn:aws:cloudformation:us-east-1:123456789012:stack/MyProductionStack/*
    const stackArn = stack.formatArn({
      resource: "stack",
      service: "cloudformation",
      resourceName: stack.stackName,
    });

    const timestampOffsetAfterCurrent = new Function(
      this,
      "timestampOffsetAfterCurrent",
      async (input: {
        timestamp: string;
        offset: number;
      }): Promise<boolean> => {
        const date = new Date(input.timestamp);
        date.setSeconds(date.getSeconds() + input.offset);
        return Date.now() < date.getMilliseconds();
      }
    );

    // TODO: add option to turn on and off
    // TODO: add option to change the default destroy time
    const selfDestructMachine = new StepFunction(
      this,
      "selfDestruct",
      async () => {
        do {
          const stackResult = await $AWS.SDK.CloudFormation.describeStacks(
            {
              StackName: stack.stackName,
            },
            {
              iam: {
                resources: [`${stackArn}/*`],
              },
            }
          );

          const currentStack = stackResult.Stacks
            ? stackResult.Stacks[0] ?? null
            : null;
          if (!currentStack) {
            throw new StepFunctionError("StackNotFound", "Stack was not found");
          }

          const updateTime =
            currentStack.LastUpdatedTime ?? currentStack.CreationTime;

          if (
            await timestampOffsetAfterCurrent({
              // https://github.com/functionless/functionless/issues/489
              timestamp: updateTime as unknown as string,
              offset: props?.selfDestructAfterSeconds ?? 43200,
            })
          ) {
            await $AWS.SDK.CloudFormation.deleteStack(
              {
                StackName: stack.stackName,
              },
              {
                iam: { resources: [`${stackArn}/*`] },
              }
            );
            return null;
          }

          $SFN.waitFor(props?.pollIntervalSeconds ?? 3600);
        } while (true);
      }
    );

    new AwsCustomResource(this, "starter", {
      onCreate: {
        action: "startExecution",
        service: "StepFunctions",
        physicalResourceId: PhysicalResourceId.fromResponse("executionArn"),
        parameters: {
          stateMachineArn: selfDestructMachine.resource.stateMachineArn,
        },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [selfDestructMachine.resource.stateMachineArn],
      }),
    }).node.addDependency(selfDestructMachine.resource);
  }
}
