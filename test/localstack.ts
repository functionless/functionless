import * as cxapi from "@aws-cdk/cx-api";
import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { SdkProvider } from "aws-cdk/lib/api/aws-auth";
import { CloudFormationDeployments } from "aws-cdk/lib/api/cloudformation-deployments";
// eslint-disable-next-line import/no-extraneous-dependencies
import { CloudFormation } from "aws-sdk";
import { Construct } from "constructs";
import { asyncSynth } from "../src/async-synth";
import { Function } from "../src/function";

export const clientConfig = {
  endpoint: "http://localhost:4566",
  credentials: {
    accessKeyId: "test",
    secretAccessKey: "test",
  },
  region: "us-east-1",
  sslEnabled: false,
  s3ForcePathStyle: true,
};

const CF = new CloudFormation(clientConfig);

// Inspiration for the current approach: https://github.com/aws/aws-cdk/pull/18667#issuecomment-1075348390
// Writeup on performance improvements: https://github.com/functionless/functionless/pull/184#issuecomment-1144767427
export const deployStack = async (app: App, stack: Stack) => {
  const cloudAssembly = await asyncSynth(app);

  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
    httpOptions: clientConfig as any,
  });

  // @ts-ignore
  sdkProvider.sdkOptions = {
    // @ts-ignore
    ...sdkProvider.sdkOptions,
    endpoint: clientConfig.endpoint,
    s3ForcePathStyle: clientConfig.s3ForcePathStyle,
    accessKeyId: clientConfig.credentials.accessKeyId,
    secretAccessKey: clientConfig.credentials.secretAccessKey,
    credentials: clientConfig.credentials,
  };

  const cfn = new CloudFormationDeployments({
    sdkProvider,
  });

  const stackArtifact = cloudAssembly.getStackArtifact(
    stack.artifactId
  ) as unknown as cxapi.CloudFormationStackArtifact;
  await cfn.deployStack({
    stack: stackArtifact,
    force: true,
  });
};

interface ResourceReference<Outputs extends Record<string, string>> {
  /**
   * CDK references like arns are placed into CfnOutputs and returned to the test function as strings.
   */
  outputs: Outputs;
}

interface ResourceTest<
  Outputs extends Record<string, string> = Record<string, string>
> {
  name: string;
  resources: (parent: Construct) => ResourceReference<Outputs> | void;
  test: (context: Outputs) => Promise<void>;
  skip: boolean;
  only: boolean;
}

interface TestResource {
  <Outputs extends Record<string, string> = Record<string, string>>(
    name: string,
    resources: ResourceTest<Outputs>["resources"],
    test: ResourceTest<Outputs>["test"]
  ): void;

  skip: <Outputs extends Record<string, string> = Record<string, string>>(
    name: string,
    resources: ResourceTest<Outputs>["resources"],
    test: ResourceTest<Outputs>["test"]
  ) => void;

  only: <Outputs extends Record<string, string> = Record<string, string>>(
    name: string,
    resources: ResourceTest<Outputs>["resources"],
    test: ResourceTest<Outputs>["test"]
  ) => void;
}

export const localstackTestSuite = (
  stackName: string,
  fn: (testResource: TestResource, stack: Stack, app: App) => void
) => {
  jest.setTimeout(500000);

  const tests: ResourceTest[] = [];
  // will be set in the before all
  let testContexts: ({ outputs?: Record<string, string> } | { error?: any })[] =
    [];

  const app = new App();
  const stack = new Stack(app, stackName, {
    env: {
      account: "000000000000",
      region: "us-east-1",
    },
  });

  let stackOutputs: CloudFormation.Outputs | undefined;

  beforeAll(async () => {
    const anyOnly = tests.some((t) => t.only);
    // run in series so we can await on a single tests's Function promises.
    for (const i in tests) {
      const { resources, skip, only } = tests[i];
      // create the construct on skip to reduce output changes when moving between skip and not skip
      const createResources = async () => {
        const construct = new Construct(stack, `parent${i}`);
        if (!skip && (!anyOnly || only)) {
          const outputOrError = async () => {
            try {
              const outputs = resources(construct);
              // resolve any promises started by resources before continuing.
              await Promise.all(Function.promises);
              return { output: outputs };
            } catch (e) {
              return { error: e };
            }
          };
          // Clear all of the promises to ensure we don't error again.
          Function.promises.splice(0, Function.promises.length);
          const { output, error } = await outputOrError();
          // Place each output in a cfn output, encoded with the unique address of the construct
          if (output) {
            return {
              outputs: Object.fromEntries(
                Object.entries(output.outputs).map(([key, value]) => {
                  new CfnOutput(construct, `${key}_out`, {
                    exportName: construct.node.addr + key,
                    value,
                  });

                  return [key, construct.node.addr + key];
                })
              ),
            };
          }
          return { error };
        }
        return {};
      };
      testContexts.push(await createResources());
    }

    Function.promises.splice(0, Function.promises.length);
    await deployStack(app, stack);

    stackOutputs = (
      await CF.describeStacks({ StackName: stack.stackName }).promise()
    ).Stacks?.[0].Outputs;
  });

  // @ts-ignore
  const testResource: TestResource = (name, resources, test) => {
    tests.push({
      name,
      resources,
      test: test as any,
      skip: false,
      only: false,
    });
  };
  testResource.skip = (name, resources, test) => {
    tests.push({ name, resources, test: test as any, skip: true, only: false });
  };
  testResource.only = (name, resources, test) => {
    tests.push({ name, resources, test: test as any, skip: false, only: true });
  };

  // register tests
  fn(testResource, stack, app);

  tests.forEach(({ name, test: testFunc, skip, only }, i) => {
    if (!skip) {
      const t = only ? test.only : test;
      t(name, () => {
        const context = testContexts[i];
        if ("error" in context) {
          throw context.error;
        } else {
          const resolvedContext =
            "outputs" in context && context.outputs
              ? Object.fromEntries(
                  Object.entries(context.outputs).map(([key, value]) => {
                    return [
                      key,
                      stackOutputs?.find((o) => o.ExportName === value)
                        ?.OutputValue!,
                    ];
                  })
                )
              : {};
          return testFunc(resolvedContext);
        }
      });
    } else {
      test.skip(name, () => {});
    }
  });
};
