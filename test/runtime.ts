import * as cxapi from "@aws-cdk/cx-api";
import { App, CfnOutput, Stack } from "aws-cdk-lib";
import {
  ArnPrincipal,
  PolicyDocument,
  PolicyStatement,
  Role,
} from "aws-cdk-lib/aws-iam";
import { SdkProvider } from "aws-cdk/lib/api/aws-auth";
import { CloudFormationDeployments } from "aws-cdk/lib/api/cloudformation-deployments";
// eslint-disable-next-line import/no-extraneous-dependencies
import AWS, {
  CloudFormation,
  DynamoDB,
  EventBridge,
  Lambda,
  StepFunctions,
  STS,
} from "aws-sdk";
import { ServiceConfigurationOptions } from "aws-sdk/lib/service";
import { Construct } from "constructs";
import { asyncSynth } from "../src/async-synth";
import { Function } from "../src/function";

const isGithub = !!process.env.CI;

// https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
export const RuntimeTestExecutionContext = {
  stackSuffix: process.env.GITHUB_REF
    ? `-${process.env.GITHUB_REF?.replace(/\//g, "-")}`
    : undefined,
  // default: false unless CI is set
  destroyStack: isGithub || !!process.env.TEST_DESTROY_STACKS,
  // AWS | LOCALSTACK ; default: LOCALSTACK
  deployTarget: (process.env.TEST_DEPLOY_TARGET ?? "LOCALSTACK") as
    | "AWS"
    | "LOCALSTACK",
};

const clientConfig =
  RuntimeTestExecutionContext.deployTarget === "AWS"
    ? {
        region: "us-east-1",
        credentialProvider: new AWS.CredentialProviderChain(
          AWS.CredentialProviderChain.defaultProviders
        ),
      }
    : {
        endpoint: "http://localhost:4566",
        credentials: {
          accessKeyId: "test",
          secretAccessKey: "test",
        },
        region: "us-east-1",
        sslEnabled: false,
        s3ForcePathStyle: true,
      };

// the env (OIDC) role can describe stack and assume roles
const sts = new STS(clientConfig);

async function getCdkDeployerClientConfig() {
  const caller = await sts.getCallerIdentity().promise();
  console.log(
    "cdk deployer arn",
    `arn:aws:iam::${caller.Account}:role/cdk-hnb659fds-deploy-role-${caller.Account}-${clientConfig.region}`
  );
  const cdkDeployRole = await sts
    .assumeRole({
      RoleArn: `arn:aws:iam::${caller.Account}:role/cdk-hnb659fds-deploy-role-${caller.Account}-${clientConfig.region}`,
      RoleSessionName: "CdkDeploy",
    })
    .promise();

  return cdkDeployRole.Credentials
    ? {
        ...clientConfig,
        credentialProvider: undefined,
        credentials: {
          accessKeyId: cdkDeployRole.Credentials?.AccessKeyId,
          expireTime: cdkDeployRole.Credentials?.Expiration,
          secretAccessKey: cdkDeployRole.Credentials?.SecretAccessKey,
          sessionToken: cdkDeployRole.Credentials?.SessionToken,
        },
      }
    : clientConfig;
}

async function getCfnClient(clientConfig: ServiceConfigurationOptions) {
  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults({
    httpOptions: clientConfig as any,
  });

  if (clientConfig) {
    const credentials = clientConfig.credentialProvider
      ? await clientConfig.credentialProvider.resolvePromise()
      : clientConfig.credentials;
    // @ts-ignore - assigning to private members
    sdkProvider.sdkOptions = {
      // @ts-ignore - using private members
      ...sdkProvider.sdkOptions,
      endpoint: clientConfig.endpoint,
      s3ForcePathStyle: clientConfig.s3ForcePathStyle,
      accessKeyId: credentials!.accessKeyId,
      secretAccessKey: credentials!.secretAccessKey,
      credentials: credentials,
    };
  }

  return new CloudFormationDeployments({
    sdkProvider,
  });
}

interface ResourceReference<
  Outputs extends Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>
> {
  /**
   * CDK references like arns are placed into CfnOutputs and returned to the test function as strings.
   */
  outputs: Outputs;
  /**
   * A map of additional strings to set from the resource function to the test.
   */
  extra?: Extra;
}

interface RuntimeTestClients {
  stepFunctions: StepFunctions;
  lambda: Lambda;
  dynamoDB: DynamoDB;
  eventBridge: EventBridge;
}

interface ResourceTest<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>
> {
  name: string;
  resources: (
    parent: Construct,
    testRole: Role
  ) => ResourceReference<Outputs> | void;
  test: (
    context: Outputs,
    clients: RuntimeTestClients,
    extra?: Extra
  ) => Promise<void>;
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

export const runtimeTestSuite = (
  stackName: string,
  fn: (testResource: TestResource, stack: Stack, app: App) => void
) => {
  jest.setTimeout(500000);

  const tests: ResourceTest[] = [];
  // will be set in the before all
  let testContexts: (
    | { error?: Error }
    | { output?: any; extra?: any }
    | { skip: true }
  )[];

  const fullStackName = `${stackName}${
    RuntimeTestExecutionContext.stackSuffix ?? ""
  }`;
  const app = new App();
  const stack = new Stack(app, fullStackName, {
    env:
      RuntimeTestExecutionContext.deployTarget === "AWS"
        ? undefined
        : {
            account: "000000000000",
            region: "us-east-1",
          },
  });

  let stackOutputs: CloudFormation.Outputs | undefined;
  let stackArtifact: cxapi.CloudFormationStackArtifact | undefined;
  let cfnClient: CloudFormationDeployments | undefined;
  let clients: RuntimeTestClients | undefined;

  beforeAll(async () => {
    const cdkClientConfig = await getCdkDeployerClientConfig();
    console.log(cdkClientConfig);
    cfnClient = await getCfnClient(cdkClientConfig);
    const anyOnly = tests.some((t) => t.only);
    // a role which will be used by the test AWS clients to call any aws resources.
    // tests should grant this role permission to interact with any resources they need.
    const testRole = new Role(stack, "testRole", {
      assumedBy: new ArnPrincipal(
        "arn:aws:iam::593491530938:role/githubActionStack-githubactionroleA106E4DC-14SHKLVA61IN4"
      ),
    });
    new CfnOutput(stack, `testRoleArn-`, {
      value: testRole.roleArn,
      exportName: `TestRoleArn-${fullStackName}`,
    });
    testContexts = tests.map(({ resources, skip, only }, i) => {
      // create the construct on skip to reduce output changes when moving between skip and not skip
      const construct = new Construct(stack, `parent${i}`);
      if (!skip && (!anyOnly || only)) {
        try {
          const output = resources(construct, testRole);
          // Place each output in a cfn output, encoded with the unique address of the construct
          if (typeof output === "object") {
            return {
              output: Object.fromEntries(
                Object.entries(output.outputs).map(([key, value]) => {
                  new CfnOutput(construct, `${key}_out`, {
                    exportName: construct.node.addr + key,
                    value,
                  });

                  return [key, construct.node.addr + key];
                })
              ),
              extra: output.extra,
            };
          }
        } catch (e) {
          /** if the node fails to add, remove it from the stack before continuing */
          stack.node.tryRemoveChild(construct.node.id);
          return {
            error: e,
          };
        }
      }
      return { skip: true };
    });

    await Promise.all(Function.promises);

    // don't deploy if they all error
    if (
      !testContexts.every(
        (t) => ("error" in t && t.error) || ("skip" in t && t.skip)
      )
    ) {
      const cloudAssembly = await asyncSynth(app);
      stackArtifact = cloudAssembly.getStackArtifact(
        stack.artifactId
      ) as unknown as cxapi.CloudFormationStackArtifact;

      // Inspiration for the current approach: https://github.com/aws/aws-cdk/pull/18667#issuecomment-1075348390
      // Writeup on performance improvements: https://github.com/functionless/functionless/pull/184#issuecomment-1144767427
      await cfnClient?.deployStack({
        stack: stackArtifact,
        force: true,
      });

      const CF = new CloudFormation(cdkClientConfig);

      stackOutputs = (
        await CF.describeStacks({ StackName: stack.stackName }).promise()
      ).Stacks?.[0]?.Outputs;

      const testRoleArn = stackOutputs?.find(
        (o) => o.ExportName === `TestRoleArn-${stack.stackName}`
      )?.OutputValue;
      const testRole = testRoleArn
        ? await sts
            .assumeRole({
              RoleArn: testRoleArn,
              RoleSessionName: "testSession",
              DurationSeconds: 30 * 60,
            })
            .promise()
        : undefined;
      // update client config with the assumed role
      const testClientConfig = testRole?.Credentials
        ? {
            ...clientConfig,
            credentialProvider: undefined,
            credentials: {
              accessKeyId: testRole?.Credentials.AccessKeyId,
              secretAccessKey: testRole?.Credentials.SecretAccessKey,
              sessionToken: testRole?.Credentials.SessionToken,
              expireTime: testRole?.Credentials.Expiration,
            },
          }
        : clientConfig;

      clients = {
        stepFunctions: new StepFunctions(testClientConfig),
        lambda: new Lambda(testClientConfig),
        dynamoDB: new DynamoDB(testClientConfig),
        eventBridge: new EventBridge(testClientConfig),
      };
    } else {
      stackOutputs = [];
    }
  });

  afterAll(async () => {
    if (stackArtifact && RuntimeTestExecutionContext.destroyStack) {
      await cfnClient?.destroyStack({
        stack: stackArtifact!,
      });
    }
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
      // eslint-disable-next-line no-only-tests/no-only-tests
      const t = only ? test.only : test;
      t(name, async () => {
        const context = testContexts[i]!;
        if ("error" in context) {
          throw context.error;
        } else if ("output" in context) {
          const resolvedContext = Object.fromEntries(
            Object.entries(context.output).map(([key, value]) => {
              return [
                key,
                stackOutputs?.find((o) => o.ExportName === value)?.OutputValue!,
              ];
            })
          );
          return testFunc(resolvedContext, clients!, context.extra);
        }
      });
    } else {
      test.skip(name, () => {});
    }
  });
};
