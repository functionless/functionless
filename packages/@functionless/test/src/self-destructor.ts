import { ArnFormat, Stack } from "aws-cdk-lib";
import {
  AwsCustomResource,
  AwsCustomResourcePolicy,
  PhysicalResourceId,
  PhysicalResourceIdReference,
} from "aws-cdk-lib/custom-resources";
import { Construct } from "constructs";

import { $AWS } from "@functionless/aws-sdk";
import { StepFunctionError } from "@functionless/asl-graph";
import { Function } from "@functionless/aws-lambda-constructs";
import { $SFN, StepFunction } from "@functionless/aws-stepfunctions-constructs";

export interface SelfDestructorProps extends SelfDestructorMachineProps {}

export interface SelfDestructorMachineProps {
  /**
   * Default: 43200 (12 hours)
   */
  selfDestructAfterSeconds?: number;
}

/**
 * Construct which destroys the current stack after {@link SelfDestructorProps.selfDestructAfterSeconds}.
 *
 * Creates a custom resource which starts a state machine that waits for
 * stack last update time + {@link SelfDestructorProps.selfDestructAfterSeconds}.
 */
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

    /**
     * It is not possible to do timestamp math in StepFunctions unfortunately.
     *
     * Returns `true` if `timestamp + offset` is before the current date (`Date.now()`).
     */
    const dateAddSeconds = new Function(
      this,
      "timestampOffsetBeforeCurrent",
      async (input: {
        timestamp: Date | string;
        offsetSeconds: number;
      }): Promise<string> => {
        const date = new Date(input.timestamp);
        return new Date(+date + input.offsetSeconds * 1000).toISOString();
      }
    );

    const selfDestructMachine = new StepFunction(
      this,
      "selfDestruct",
      async (input: SelfDestructorMachineProps) => {
        let destructTime = "";
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

          const currentStack = stackResult.Stacks?.[0] ?? null;
          if (!currentStack) {
            throw new StepFunctionError("StackNotFound", "Stack was not found");
          }

          const stackChangeTime = (currentStack.LastUpdatedTime ??
            currentStack.CreationTime) as unknown as string;

          // if we made it through a wait period and stackChangeTime is still the same the last iteration, destroy the stack
          if (destructTime === stackChangeTime) {
            /**
             * Stack deletion happens asynchronously after this call succeeds.
             */
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

          // add the destruct delay to the last update or creation time.
          const offsetTime = await dateAddSeconds({
            timestamp: stackChangeTime,
            offsetSeconds: input.selfDestructAfterSeconds ?? 43200,
          });

          // set the base time to the destruct time, if these are the same after selfDestructAfterSeconds, destroy the stack
          destructTime = stackChangeTime as unknown as string;

          // wait until selfDestructAfterSeconds + stackChangeTime
          $SFN.waitUntil(offsetTime);
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
          input: JSON.stringify({
            selfDestructAfterSeconds: props?.selfDestructAfterSeconds,
          } as SelfDestructorMachineProps),
        },
      },
      onDelete: {
        action: "stopExecution",
        service: "StepFunctions",
        parameters: {
          executionArn: new PhysicalResourceIdReference(),
        },
      },
      policy: AwsCustomResourcePolicy.fromSdkCalls({
        resources: [
          selfDestructMachine.resource.stateMachineArn,
          // execution arn
          stack.formatArn({
            resource: "execution",
            resourceName: "*",
            service: "states",
            arnFormat: ArnFormat.COLON_RESOURCE_NAME,
          }),
        ],
      }),
      installLatestAwsSdk: false,
    });
  }
}
