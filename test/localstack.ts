import { performance, PerformanceObserver } from "node:perf_hooks";
import * as cxapi from "@aws-cdk/cx-api";
import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { SdkProvider } from "aws-cdk/lib/api/aws-auth";
import { CloudFormationDeployments } from "aws-cdk/lib/api/cloudformation-deployments";
// eslint-disable-next-line import/no-extraneous-dependencies
import { CloudFormation } from "aws-sdk";
import { Construct } from "constructs";
import { asyncSynth } from "../src/async-synth";

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

export const deployStack = async (app: App, stack: Stack) => {
  performance.mark("AwaitSynth");
  const cloudAssembly = await asyncSynth(app, {});
  performance.measure("After await synth", "AwaitSynth");
  performance.measure("Add resources", "InvokeResourceGetter");

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

  performance.mark("CfnCompile");

  const cfn = new CloudFormationDeployments({
    sdkProvider,
  });

  // const assembly = new cxapi.CloudAssembly(cloudAssembly.directory);
  // const stackArtifact = cxapi.CloudFormationStackArtifact.fromManifest(
  //   cloudAssembly,
  //   stack.artifactId,
  //   cloudAssembly.getStackArtifact(stack.artifactId).manifest
  // ) as cxapi.CloudFormationStackArtifact;

  performance.measure("Complete CfnCompile", "CfnCompile");

  performance.mark("DeployStack");
  await cfn.deployStack({
    stack: cloudAssembly.getStackArtifact(
      stack.artifactId
    ) as unknown as cxapi.CloudFormationStackArtifact,
    force: true,
  });
  performance.measure("Deploy Stack complete", "DeployStack");
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
}

export const localstackTestSuite = (
  stackName: string,
  fn: (testResource: TestResource, stack: Stack, app: App) => void
) => {
  jest.setTimeout(500000);

  const tests: ResourceTest[] = [];
  // will be set in the before all
  let testContexts: any[];

  const app = new App();
  const stack = new Stack(app, stackName, {
    env: {
      account: "000000000000",
      region: "us-east-1",
    },
  });

  let stackOutputs: CloudFormation.Outputs | undefined;

  const obs = new PerformanceObserver((items) => {
    items
      .getEntries()
      .forEach(({ duration, startTime, name, entryType }) =>
        console.log(entryType, name, startTime, duration)
      );
  });
  obs.observe({ entryTypes: ["mark", "measure", "function"], buffered: true });
  performance.measure("Start to Now");

  beforeAll(async () => {
    performance.mark("Before");

    testContexts = tests.map(({ resources, skip }, i) => {
      // create the construct on skip to reduce output changes when moving between skip and not skip
      const construct = new Construct(stack, `parent${i}`);
      if (!skip) {
        const output = resources(construct);
        // Place each output in a cfn output, encoded with the unique address of the construct
        if (output) {
          return Object.fromEntries(
            Object.entries(output.outputs).map(([key, value]) => {
              new CfnOutput(construct, `${key}_out`, {
                exportName: construct.node.addr + key,
                value,
              });

              return [key, construct.node.addr + key];
            })
          );
        }
      }
      return {};
    });

    performance.mark("DeployStack");
    await performance.timerify(deployStack)(app, stack);
    performance.measure("After deploy stack", "DeployStack");

    performance.mark("DescribeStacks");

    stackOutputs = (
      await CF.describeStacks({ StackName: stack.stackName }).promise()
    ).Stacks?.[0].Outputs;

    performance.measure("After describe stacks", "DescribeStacks");
    performance.mark("BeforeEnd");
  });

  // @ts-ignore
  const testResource: TestResource = (name, resources, test) => {
    tests.push({ name, resources, test: test as any, skip: false });
  };
  testResource.skip = (name, resources, test) => {
    tests.push({ name, resources, test: test as any, skip: true });
  };

  // register tests
  performance.mark("GetTests");
  fn(testResource, stack, app);
  performance.measure("After getting tests", "GetTests");

  performance.mark("InvokeResourceGetter");
  tests.forEach(({ name, test: testFunc, skip }, i) => {
    if (!skip) {
      test(name, () => {
        const context = testContexts[i];
        const resolvedContext = Object.fromEntries(
          Object.entries(context).map(([key, value]) => {
            return [
              key,
              stackOutputs?.find((o) => o.ExportName === value)?.OutputValue!,
            ];
          })
        );
        return testFunc(resolvedContext);
      });
    } else {
      test.skip(name, () => {});
    }
  });
  performance.mark("SyncResource");
  performance.measure("Sync resource time", "SyncResource");
};
