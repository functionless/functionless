import "jest";

import * as cxapi from "@aws-cdk/cx-api";
import { App, CfnOutput, Stack } from "aws-cdk-lib";
import { ArnPrincipal, Role } from "aws-cdk-lib/aws-iam";
import { SdkProvider } from "aws-cdk/lib/api/aws-auth";
import { CloudFormationDeployments } from "aws-cdk/lib/api/cloudformation-deployments";
// eslint-disable-next-line import/no-extraneous-dependencies
import AWS, {
  DynamoDB,
  EventBridge,
  Lambda,
  SQS,
  StepFunctions,
  STS,
} from "aws-sdk";
import { ServiceConfigurationOptions } from "aws-sdk/lib/service";
import { Construct } from "constructs";
import { Function, asyncSynth } from "@functionless/aws-lambda-constructs";
import { SelfDestructor, SelfDestructorProps } from "./self-destructor";

const selfDestructDelay = Number(process.env.TEST_SELF_DESTRUCT_DELAY_SECONDS);
const deploymentTarget = process.env.TEST_DEPLOY_TARGET ?? "LOCALSTACK";

export interface RuntimeTestExecutionContext {
  stackTag: string;
  stackSuffix?: string;
  selfDestructProps: SelfDestructorProps;
  stackRetentionPolicy: "RETAIN" | "DELETE" | "SELF_DESTRUCT";
  deployTarget: "AWS" | "LOCALSTACK";
  cleanUpStack: boolean;
}

export const STACK_TAG_KEY = "functionless-test-stack";

// https://docs.github.com/en/actions/learn-github-actions/environment-variables#default-environment-variables
export const runtimeTestExecutionContext: RuntimeTestExecutionContext = {
  stackTag: process.env.GITHUB_REF
    ? `FunctionlessTest-${process.env.GITHUB_REF}`
    : "FunctionlessTest",
  stackSuffix: process.env.GITHUB_REF
    ? `-${process.env.GITHUB_REF?.replace(/\//g, "-")}`
    : undefined,
  selfDestructProps: {
    selfDestructAfterSeconds: Number.isNaN(selfDestructDelay)
      ? undefined
      : selfDestructDelay,
  } as SelfDestructorProps,
  // RETAIN | SELF_DESTRUCT | DELETE ; default: SELF_DESTRUCT
  stackRetentionPolicy: (process.env.TEST_STACK_RETENTION_POLICY ??
    (deploymentTarget === "LOCALSTACK"
      ? "RETAIN"
      : "SELF_DESTRUCT")) as RuntimeTestExecutionContext["stackRetentionPolicy"],
  // AWS | LOCALSTACK ; default: LOCALSTACK
  deployTarget: deploymentTarget as RuntimeTestExecutionContext["deployTarget"],
  cleanUpStack: process.env.CLEAN_UP_STACK === "1" ? true : false,
};

export const clientConfig: ServiceConfigurationOptions =
  runtimeTestExecutionContext.deployTarget === "AWS"
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
export const sts = new STS(clientConfig);

export interface RuntimeTestClients {
  stepFunctions: StepFunctions;
  lambda: Lambda;
  dynamoDB: DynamoDB;
  eventBridge: EventBridge;
  sqs: SQS;
}

/**
 * The data form of a test case created by {@link TestInterface}'s.
 */
export interface TestCase<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>,
  TestExtra extends Record<string, any> = Record<string, any>
> {
  name: string;
  resources: (
    parent: Construct,
    testRole: Role
  ) =>
    | Promise<TestCaseDeploymentOutput<Outputs>>
    | TestCaseDeploymentOutput<Outputs>;
  test: (
    context: Outputs,
    clients: RuntimeTestClients,
    extra?: Extra
  ) => Promise<void>;
  skip: boolean;
  only: boolean;
  extras?: TestExtra;
}

/**
 * A test case with post-deployment data.
 */
interface RuntimeTestCase<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>,
  TestExtra extends Record<string, any> = Record<string, any>
> {
  test: TestCase<Outputs, Extra, TestExtra>;
  deployOutputs: TestCaseDeployment<Outputs>;
}

/**
 * Interface used by the {@link beforeAllTests} callback, which is only given successfully deployed test cases.
 */
interface SuccessfulRuntimeTestCase<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>,
  TestExtra extends Record<string, any> = Record<string, any>
> {
  test: TestCase<Outputs, Extra, TestExtra>;
  deployOutputs: TestCaseDeploymentOutput<Outputs, Extra>;
}

/**
 * The callable test interface used by the test suites.
 */
export interface TestInterface<
  BaseOutputs extends Record<string, string> = Record<string, string>,
  TestExtras extends Record<string, any> = Record<string, any>
> {
  <Outputs extends BaseOutputs>(
    name: string,
    resources: TestCase<Outputs>["resources"],
    test: TestCase<Outputs>["test"],
    extras?: TestExtras
  ): void;

  skip: <Outputs extends BaseOutputs>(
    name: string,
    resources: TestCase<Outputs>["resources"],
    test: TestCase<Outputs>["test"],
    extras?: TestExtras
  ) => void;

  only: <Outputs extends BaseOutputs>(
    name: string,
    resources: TestCase<Outputs>["resources"],
    test: TestCase<Outputs>["test"],
    extras?: TestExtras
  ) => void;
}

/**
 * The result of a test case that was successfully deployed.
 */
interface TestCaseDeploymentOutput<
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

/**
 * The possible results of deploying a test case.
 * 1. Successfully deployed
 * 2. An error
 * 3. Skipped/Not only
 */
type TestCaseDeployment<
  Outputs extends Record<string, string> = Record<string, string>,
  Extra extends Record<string, string> = Record<string, string>
> =
  | { error?: Error }
  | TestCaseDeploymentOutput<Outputs, Extra>
  | { skip: true };

/**
 * A general purpose test bed for CDK integration tests.
 *
 * Supports localstack and AWS targeted tests (one at a time right now).
 *
 * 1. Register one or more tests cases using the {@link TestInterface}.
 * 2. (optional) Register BeforeAllTests callback
 * 3. Collect CDK constructs and add to stack using the {@link TestCase.resource} callback. (jest beforeAll)
 * 4. Deploy stack to deployment target. (jest beforeAll)
 * 5. Join the outputs from the stack deployment with the test cases. (jest beforeAll)
 * 6. Run the {@link TestCase.test} callback for each test using Jest. (jest test)
 * 7. (optional) Destroy the stack (jest afterAll)
 *
 * ```ts
 * runtimeTestSuite(test, stack, app, beforeAllTests) {
 *    beforeAllTests(async () => {
 *       // do something after deployment and before all tests are evaluated
 *    });
 *
 *    test("name", (scope) => {
 *       // register cdk and return outputs
 *    }, (context, clients) => {
 *       // evaluate outputs and call clients to test
 *    });
 * }
 * ```
 */
export function runtimeTestSuite<
  BaseOutput extends Record<string, string> = Record<string, string>,
  TestExtras extends Record<string, any> = Record<string, any>
>(
  stackName: string,
  fn: (
    testResource: TestInterface<BaseOutput, TestExtras>,
    stack: Stack,
    app: App,
    beforeAllTests: (
      cb: (
        testOutputs: SuccessfulRuntimeTestCase<BaseOutput, any, TestExtras>[],
        clients: RuntimeTestClients
      ) => Promise<
        SuccessfulRuntimeTestCase<BaseOutput, any, TestExtras>[] | void
      >
    ) => void
  ) => void
): void {
  jest.setTimeout(1000000);

  const tests: TestCase<BaseOutput, any, TestExtras>[] = [];
  // will be set in the before all
  let testContexts: TestCaseDeployment<BaseOutput>[];

  const fullStackName = `${stackName}${
    runtimeTestExecutionContext.stackSuffix ?? ""
  }`;
  const app = new App();
  const stack = new Stack(app, fullStackName, {
    tags: {
      [STACK_TAG_KEY]: runtimeTestExecutionContext.stackTag,
    },
    env:
      runtimeTestExecutionContext.deployTarget === "LOCALSTACK"
        ? {
            account: "000000000000",
            region: "us-east-1",
          }
        : undefined,
  });

  if (runtimeTestExecutionContext.stackRetentionPolicy === "SELF_DESTRUCT") {
    new SelfDestructor(
      stack,
      "selfDestruct",
      runtimeTestExecutionContext.selfDestructProps
    );
  }

  let stackArtifact: cxapi.CloudFormationStackArtifact | undefined;
  let clients: RuntimeTestClients | undefined;
  let testResolvedContexts:
    | RuntimeTestCase<BaseOutput, any, TestExtras>[]
    | undefined;

  // an optional callback the caller can send which is called after deploy and before
  // all test methods are invoked.
  let beforeAllTests:
    | ((
        testOutputs: SuccessfulRuntimeTestCase<BaseOutput, any, TestExtras>[],
        clients: RuntimeTestClients
      ) => Promise<
        SuccessfulRuntimeTestCase<BaseOutput, any, TestExtras>[] | void
      >)
    | undefined = undefined;

  beforeAll(async () => {
    // resolve account and arn of current credentials
    const caller = await sts.getCallerIdentity().promise();
    if (!caller || !caller.Arn) {
      throw Error("Cannot retrieve the current caller.");
    }
    // cdkClientConfig
    const anyOnly = tests.some((t) => t.only);
    // a role which will be used by the test AWS clients to call any aws resources.
    // tests should grant this role permission to interact with any resources they need.
    const testRole = new Role(stack, "testRole", {
      assumedBy: new ArnPrincipal(caller.Arn),
    });
    // stack output which we'll use to get the role arn before executing the tests.
    const testArnOutput = new CfnOutput(stack, `testRoleArn`, {
      value: testRole.roleArn,
      exportName: `TestRoleArn-${fullStackName}`,
    });

    // register CDK resources of each test and return any outputs to use in the test or beforeAll
    testContexts = await Promise.all(
      tests.map((test, i) =>
        collectTestCdkResources(stack, anyOnly, testRole, i, test)
      )
    );

    await Promise.all(Function.promises);

    // don't deploy if they all error
    const allErrored = testContexts.every(
      (t) => ("error" in t && t.error) || ("skip" in t && t.skip)
    );
    if (!allErrored) {
      const cloudAssembly = await asyncSynth(app);
      stackArtifact = cloudAssembly.getStackArtifact(
        stack.artifactId
      ) as unknown as cxapi.CloudFormationStackArtifact;

      // Inspiration for the current approach: https://github.com/aws/aws-cdk/pull/18667#issuecomment-1075348390
      // Writeup on performance improvements: https://github.com/functionless/functionless/pull/184#issuecomment-1144767427
      const deployOut = await getCfnClient().then((client) =>
        client.deployStack({
          stack: stackArtifact!,
          tags: Object.entries(stack.tags.tagValues()).map(([k, v]) => ({
            Key: k,
            Value: v,
          })),
          // hotswap uses the current user's role and not the bootstrapped role.
          // the CI user does not have all of the right permissions.
          hotswap: !process.env.CI,
        })
      );

      const testRoleArn =
        deployOut.outputs[stack.resolve(testArnOutput.logicalId)];

      clients = await getRuntimeClients(testRoleArn);

      // map real stack outputs to their keys in the outputs map.
      // store this object for future use.
      testResolvedContexts = testContexts.map((s, i) =>
        combineTestAndDeploymentOutput(deployOut.outputs, tests[i]!, s)
      );

      if (beforeAllTests) {
        const successDeployments = testResolvedContexts.filter(
          (
            s
          ): s is RuntimeTestCase<BaseOutput, any, TestExtras> & {
            deployOutputs: TestCaseDeploymentOutput<BaseOutput>;
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
      // if the deploy failed, populate with the un-resolved contexts, should only contain failed and skips
      testResolvedContexts = testContexts.map((s, i) => ({
        test: tests[i]!,
        deployOutputs: s,
      }));
    }
  });

  afterAll(async () => {
    if (
      stackArtifact &&
      runtimeTestExecutionContext.stackRetentionPolicy === "DELETE"
    ) {
      await getCfnClient().then((client) =>
        client.destroyStack({
          stack: stackArtifact!,
        })
      );
    }
  });

  // @ts-ignore
  const testResource: TestInterface<BaseOutput, TestExtras> = (
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

async function getCfnClient() {
  const sdkProvider = await SdkProvider.withAwsCliCompatibleDefaults(
    runtimeTestExecutionContext.deployTarget === "LOCALSTACK"
      ? {
          httpOptions: clientConfig as any,
        }
      : undefined
  );

  if (runtimeTestExecutionContext.deployTarget === "LOCALSTACK") {
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

/**
 * Given a test, collect the constructs it needs and register any outputs it needs and return.
 */
async function collectTestCdkResources<
  Output extends Record<string, string> = Record<string, string>
>(
  stack: Stack,
  hasOnly: boolean,
  testRole: Role,
  index: number,
  test: TestCase<Output, any, any>
): Promise<TestCaseDeployment<Output, Record<string, string>>> {
  const { resources, skip, only } = test;
  // create the construct on skip to reduce output changes when moving between skip and not skip
  const construct = new Construct(stack, `parent${index}`);
  if (!skip && (!hasOnly || only)) {
    try {
      const output = await resources(construct, testRole);
      // Place each output in a cfn output, encoded with the unique address of the construct
      if (typeof output === "object") {
        return {
          outputs: Object.fromEntries(
            Object.entries(output.outputs).map(([key, value]) => [
              key,
              stack.resolve(
                new CfnOutput(construct, `${key}_out`, {
                  value,
                }).logicalId
              ),
            ])
          ),
          extra: output.extra,
        } as TestCaseDeploymentOutput<any, any>;
      }
    } catch (e) {
      /** if the node fails to add, remove it from the stack before continuing */
      stack.node.tryRemoveChild(construct.node.id);
      return {
        error: e,
      } as TestCaseDeployment<Output>;
    }
  }
  return { skip: true };
}

/**
 * After deployment, join the test case with the post-deployment outputs and return.
 */
function combineTestAndDeploymentOutput<
  Output extends Record<string, string> = Record<string, string>
>(
  outputs: Record<string, string>,
  test: TestCase<Output, any, any>,
  deploymentResult: TestCaseDeployment<Output>
): RuntimeTestCase<Output, any, any> {
  if ("outputs" in deploymentResult) {
    const resolvedContext = Object.fromEntries(
      Object.entries(deploymentResult.outputs).map(([key, value]) => {
        return [key, outputs[value]];
      })
    );
    return {
      test,
      deployOutputs: {
        outputs: resolvedContext as Output,
        extra: deploymentResult.extra,
      },
    };
  }
  return {
    test,
    deployOutputs: deploymentResult,
  };
}

export function getTestRole(testRoleArn: string | undefined) {
  return testRoleArn
    ? sts
        .assumeRole({
          RoleArn: testRoleArn,
          RoleSessionName: "testSession",
          DurationSeconds: 60 * 60, // hour
        })
        .promise()
    : undefined;
}

/**
 * Build the clients needed by the test cases using the test role built up by the test resources.
 */
async function getRuntimeClients(
  testRoleArn: string | undefined
): Promise<RuntimeTestClients> {
  const testRole = await getTestRole(testRoleArn);

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

  return {
    stepFunctions: new StepFunctions(testClientConfig),
    lambda: new Lambda(testClientConfig),
    dynamoDB: new DynamoDB(testClientConfig),
    eventBridge: new EventBridge(testClientConfig),
    sqs: new SQS(testClientConfig),
  };
}
