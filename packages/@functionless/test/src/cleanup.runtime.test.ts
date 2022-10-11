import { $AWS } from "@functionless/aws-sdk";
import { $SFN, StepFunction } from "@functionless/aws-stepfunctions-constructs";
import { FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { Function } from "@functionless/aws-lambda-constructs";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
import {
  runtimeTestExecutionContext,
  runtimeTestSuite,
  STACK_TAG_KEY,
} from "./runtime";

/**
 * When cleanUpStack is enabled, deploys a small CDK/CFN stack which can delete all of the other test stacks in one go.
 *
 * Used by the Github Pull Request Closed CleanUp workflow to clean up all of the test stacks when a PR closes.
 *
 * SSM Parameter - stores reference to the function url to start the machine.
 * Function Url (starter) - a open GET url which starts the step function.
 * Step Function (deleter) - A step function which deletes all stacks deployed by this branch. (using the tagging api and CFN).
 *
 * Invoking the lambda, the lambda url, or the step function will execute the workflow.
 */
if (runtimeTestExecutionContext.cleanUpStack) {
  runtimeTestSuite("cleanUp", (test, stack) => {
    test(
      "deleter",
      async (scope) => {
        const stackArnPrefix = stack.formatArn({
          resource: "stack",
          resourceName: "*",
          service: "cloudformation",
        });

        // pulls all stacks from the current PR/Release/Deployment and deletes them
        // uses the functionless-test-stack tag which matches the current stackTag (ex: github ref)
        const deleterMachine = new StepFunction(scope, "deleter", async () => {
          const stacksWithTag =
            await $AWS.SDK.ResourceGroupsTaggingAPI.getResources(
              {
                TagFilters: [
                  {
                    Key: STACK_TAG_KEY,
                    Values: [runtimeTestExecutionContext.stackTag],
                  },
                ],
                ResourceTypeFilters: ["cloudformation:stack"],
              },
              {
                iam: {
                  resources: ["*"],
                },
              }
            );

          await $SFN.forEach(
            stacksWithTag.ResourceTagMappingList ?? [],
            (resource) =>
              $AWS.SDK.CloudFormation.deleteStack(
                { StackName: resource.ResourceARN! },
                {
                  iam: {
                    resources: [stackArnPrefix],
                  },
                }
              )
          );
        });

        const starter = new Function(scope, "starter", async () => {
          await deleterMachine({});
        });

        const starterFuncUrl = starter.resource.addFunctionUrl({
          authType: FunctionUrlAuthType.NONE,
        });

        new StringParameter(scope, "deleterFunctionUrl", {
          stringValue: starterFuncUrl.url,
          // FunctionlessTest-{process.env.GITHUB_REF}
          parameterName: `/functionlessTestDeleter/${runtimeTestExecutionContext.stackTag}/deleteUrl`,
        });

        return {
          outputs: {},
        };
      },
      async () => {
        // not a real test, just using the harness to deploy things during build
        expect(true).toBeTruthy();
      }
    );
  });
} else {
  test("do nothing", () => {
    expect(true).toBeTruthy();
  });
}
