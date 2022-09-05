import * as cxapi from "@aws-cdk/cx-api";
import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { ArnPrincipal, Role } from "aws-cdk-lib/aws-iam";
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

console.log("runtime test context", RuntimeTestExecutionContext);

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

async function getCdkDeployerClientConfig(
  caller: STS.GetCallerIdentityResponse
) {
  const roleArn = `arn:aws:iam::${caller.Account}:role/cdk-hnb659fds-deploy-role-${caller.Account}-${clientConfig.region}`;
  const cdkDeployRole = await sts
    .assumeRole({
      // simple bootstrap stacks have a computable arn, the hash is hard coded in CDK.
      // https://github.com/aws/aws-cdk/blob/main/packages/aws-cdk/lib/api/bootstrap/bootstrap-template.yaml#L34
      RoleArn: roleArn,
      RoleSessionName: "CdkDeploy",
    })
    .promise();

  if (!cdkDeployRole.Credentials) {
    throw new Error(
      `Could not retrieve credentials for: ${cdkDeployRole.AssumedRoleUser?.Arn} form ${roleArn}`
    );
  }

  return {
    ...clientConfig,
    credentialProvider: undefined,
    credentials: {
      accessKeyId: cdkDeployRole.Credentials.AccessKeyId,
      expireTime: cdkDeployRole.Credentials.Expiration,
      secretAccessKey: cdkDeployRole.Credentials.SecretAccessKey,
      sessionToken: cdkDeployRole.Credentials.SessionToken,
    },
  };
}

async function getCfnClient() {
  //clientConfig: ServiceConfigurationOptions
  const sdkProvider = await SdkProvider
    .withAwsCliCompatibleDefaults
    //   {
    //   httpOptions: clientConfig as any,
    // }
    ();

  // if (clientConfig) {
  //   const credentials = clientConfig.credentialProvider
  //     ? await clientConfig.credentialProvider.resolvePromise()
  //     : clientConfig.credentials;
  //   // @ts-ignore - assigning to private members
  //   sdkProvider.sdkOptions = {
  //     // @ts-ignore - using private members
  //     ...sdkProvider.sdkOptions,
  //     endpoint: clientConfig.endpoint,
  //     s3ForcePathStyle: clientConfig.s3ForcePathStyle,
  //     accessKeyId: credentials!.accessKeyId,
  //     secretAccessKey: credentials!.secretAccessKey,
  //     credentials: credentials,
  //   };
  // }

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
  Extra extends Record<string, string> = Record<string, string>,
  TestExtra extends Record<string, any> = Record<string, any>
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
  extras?: TestExtra;
}

interface ResolvedTestResource<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>,
  TestExtra extends Record<string, any> = Record<string, any>
> {
  test: ResourceTest<Outputs, Extra, TestExtra>;
  deployOutputs: DeployResult<Outputs>;
}

interface ResolvedSuccessfulTestResource<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>,
  TestExtra extends Record<string, any> = Record<string, any>
> {
  test: ResourceTest<Outputs, Extra, TestExtra>;
  deployOutputs: ResourceReference<Outputs, Extra>;
}

interface TestResource<
  BaseOutputs extends Record<string, string> = Record<string, string>,
  TestExtras extends Record<string, any> = Record<string, any>
> {
  <Outputs extends BaseOutputs>(
    name: string,
    resources: ResourceTest<Outputs>["resources"],
    test: ResourceTest<Outputs>["test"],
    extras?: TestExtras
  ): void;

  skip: <Outputs extends BaseOutputs>(
    name: string,
    resources: ResourceTest<Outputs>["resources"],
    test: ResourceTest<Outputs>["test"],
    extras?: TestExtras
  ) => void;

  only: <Outputs extends BaseOutputs>(
    name: string,
    resources: ResourceTest<Outputs>["resources"],
    test: ResourceTest<Outputs>["test"],
    extras?: TestExtras
  ) => void;
}

type DeployResult<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>
> = { error?: Error } | ResourceReference<Outputs, Extra> | { skip: true };

export function runtimeTestSuite<
  BaseOutput extends Record<string, string> = Record<string, string>,
  TestExtras extends Record<string, any> = Record<string, any>
>(
  stackName: string,
  fn: (
    testResource: TestResource<BaseOutput, TestExtras>,
    stack: Stack,
    app: App,
    beforeAllTests: (
      cb: (
        testOutputs: ResolvedSuccessfulTestResource<
          BaseOutput,
          any,
          TestExtras
        >[],
        clients: RuntimeTestClients
      ) => Promise<
        ResolvedSuccessfulTestResource<BaseOutput, any, TestExtras>[] | void
      >
    ) => void
  ) => void
): void {
  jest.setTimeout(500000);

  const tests: ResourceTest<BaseOutput, any, TestExtras>[] = [];
  // will be set in the before all
  let testContexts: DeployResult<BaseOutput>[];

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
  let testResolvedContexts:
    | ResolvedTestResource<BaseOutput, any, TestExtras>[]
    | undefined;
  // an optional callback the caller can send which is called after deploy and before
  // all test methods are invoked.
  let beforeAllTests:
    | ((
        testOutputs: ResolvedSuccessfulTestResource<
          BaseOutput,
          any,
          TestExtras
        >[],
        clients: RuntimeTestClients
      ) => Promise<
        ResolvedSuccessfulTestResource<BaseOutput, any, TestExtras>[] | void
      >)
    | undefined = undefined;

  beforeAll(async () => {
    // resolve account and arn of current credentials
    const caller = await sts.getCallerIdentity().promise();
    if (!caller || !caller.Arn) {
      throw Error("Cannot retrieve the current caller.");
    }
    const cdkClientConfig = await getCdkDeployerClientConfig(caller);
    cfnClient = await getCfnClient();
    // cdkClientConfig
    const anyOnly = tests.some((t) => t.only);
    // a role which will be used by the test AWS clients to call any aws resources.
    // tests should grant this role permission to interact with any resources they need.
    const testRole = new Role(stack, "testRole", {
      assumedBy: new ArnPrincipal(caller.Arn),
    });
    new CfnOutput(stack, `testRoleArn-`, {
      value: testRole.roleArn,
      exportName: `TestRoleArn-${fullStackName}`,
    });
    // register CDK resources of each test and return any outputs to use in the test or beforeAll
    testContexts = tests.map(({ resources, skip, only }, i) => {
      // create the construct on skip to reduce output changes when moving between skip and not skip
      const construct = new Construct(stack, `parent${i}`);
      if (!skip && (!anyOnly || only)) {
        try {
          const output = resources(construct, testRole);
          // Place each output in a cfn output, encoded with the unique address of the construct
          if (typeof output === "object") {
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
              extra: output.extra,
            } as ResourceReference<any, any>;
          }
        } catch (e) {
          /** if the node fails to add, remove it from the stack before continuing */
          stack.node.tryRemoveChild(construct.node.id);
          return {
            error: e,
          } as DeployResult;
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

      // map real stack outputs to their keys in the outputs map.
      // store this object for future use.
      testResolvedContexts = testContexts.map((s, i) => {
        if ("outputs" in s) {
          const resolvedContext = Object.fromEntries(
            Object.entries(s.outputs).map(([key, value]) => {
              return [
                key,
                stackOutputs?.find((o) => o.ExportName === value)?.OutputValue!,
              ];
            })
          );
          return {
            test: tests[i]!,
            deployOutputs: {
              outputs: resolvedContext as BaseOutput,
              extra: s.extra,
            },
          };
        }
        return {
          test: tests[i]!,
          deployOutputs: s,
        };
      });

      if (beforeAllTests) {
        const successDeployments = testResolvedContexts.filter(
          (
            s
          ): s is ResolvedTestResource<BaseOutput, any, TestExtras> & {
            deployOutputs: ResourceReference<BaseOutput>;
          } => "outputs" in s.deployOutputs
        );
        // call the optional beforeAll callback and optionally update the resolved contexts
        const updates = await beforeAllTests?.(successDeployments, clients);
        if (updates) {
          if (successDeployments.length !== updates.length) {
            throw Error(
              "beforeAllTests should return undefined or an array of test contexts of the same size as the input."
            );
          }
          // replace the successful entries with the updates ones
          testResolvedContexts = testResolvedContexts.map((s) => {
            if ("outputs" in s.deployOutputs) {
              return updates.shift()!;
            } else {
              return s;
            }
          });
        }
      }
    } else {
      stackOutputs = [];
      // if the deploy failed, populate with the un-resolved contexts, should only contain failed and skips
      testResolvedContexts = testContexts.map((s, i) => ({
        test: tests[i]!,
        deployOutputs: s,
      }));
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
  const testResource: TestResource<BaseOutput, TestExtras> = (
    name,
    resources,
    test,
    extras
  ) => {
    tests.push({
      name,
      resources,
      test: test as any,
      skip: false,
      only: false,
      extras: extras,
    });
  };
  testResource.skip = (name, resources, test, extras) => {
    tests.push({
      name,
      resources,
      test: test as any,
      skip: true,
      only: false,
      extras,
    });
  };
  testResource.only = (name, resources, test, extras) => {
    tests.push({
      name,
      resources,
      test: test as any,
      skip: false,
      only: true,
      extras,
    });
  };

  // register tests
  fn(testResource, stack, app, (cb) => (beforeAllTests = cb));

  tests?.forEach(({ name, test: testFunc, skip, only }, i) => {
    if (!skip) {
      // eslint-disable-next-line no-only-tests/no-only-tests
      const t = only ? test.only : test;
      t(name, async () => {
        const { deployOutputs } = testResolvedContexts?.[i]!;
        if ("error" in deployOutputs) {
          throw deployOutputs.error;
        } else if ("outputs" in deployOutputs) {
          return testFunc(deployOutputs.outputs, clients!, deployOutputs.extra);
        }
      });
    } else {
      test.skip(name, () => {});
    }
  });
}
