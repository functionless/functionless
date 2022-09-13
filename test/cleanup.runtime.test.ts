// TODO add env variable to clean up

// import { Role } from "aws-cdk-lib/aws-iam";
import { FunctionUrlAuthType } from "aws-cdk-lib/aws-lambda";
import { StringParameter } from "aws-cdk-lib/aws-ssm";
// import { STS } from "aws-sdk";
import { $AWS, $SFN, Function, StepFunction } from "../src";
import {
  // clientConfig,
  runtimeTestExecutionContext,
  runtimeTestSuite,
  STACK_TAG_KEY,
} from "./runtime";

// const sts = new STS(clientConfig);

runtimeTestSuite("cleanUp", (test, stack) => {
  test(
    "deleter",
    async (scope) => {
      // step function which deletes all stacks
      // lambda url to trigger
      // set lambda url in ssm parameter
      // grant access to ?? to call ssm and lambda url
      // const stackPartition = new Function(
      //   scope,
      //   "stackPartition",
      //   async (stackArns: string[]) => ({
      //     cleanUpStack: stackArns.find((arn) => arn.includes("/cleanUp/")),
      //     otherStacks: stackArns.filter((arn) => !arn.includes("/cleanUp/")),
      //   })
      // );

      const stackArnPrefix = stack.formatArn({
        resource: "stack",
        resourceName: "*",
        service: "cloudformation",
      });

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

      // const param =
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
      expect(true).toBeTruthy();
    }
  );
});
