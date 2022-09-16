import * as fs from "fs";
import { join } from "path";
import { typescript, TextFile, Project } from "projen";
import { GithubCredentials } from "projen/lib/github";
import { Job, JobPermission } from "projen/lib/github/workflows-model";

/**
 * Adds githooks into the .git/hooks folder during projen synth.
 *
 * @see https://git-scm.com/docs/githooks
 */
class GitHooksPreCommitComponent extends TextFile {
  constructor(project: Project) {
    super(project, ".git/hooks/pre-commit", {
      lines: ["#!/bin/sh", "npx -y lint-staged"],
    });
  }

  public postSynthesize() {
    fs.chmodSync(this.path, "755");
  }
}

const MIN_CDK_VERSION = "2.28.1";

/**
 * Projen does not currently support a way to set `*` for deerDependency versions.
 * https://github.com/projen/projen/issues/1802
 *
 * Why do we need `*` for peer dependencies?
 *
 * @aws-cdk 2.0 uses pre-release version tags (ex: 2.17.0-alpha.0) for all experimental features.
 * NPM/Semver does not allow version ranges for versions with pre-release tags (ex: 2.17.0-alpha.0)
 *
 * This means we cannot specify a peer version range for @aws-cdk/aws-appsync-alpha, pinning consumers to one CDK version
 * or ignoring/overriding npm/yarn errors and warnings.
 *
 * TODO: Remove this hack once https://github.com/projen/projen/issues/1802 is resolved.
 */
class CustomTypescriptProject extends typescript.TypeScriptProject {
  constructor(opts: typescript.TypeScriptProjectOptions) {
    super(opts);

    new GitHooksPreCommitComponent(this);

    this.postSynthesize = this.postSynthesize.bind(this);
  }

  public postSynthesize() {
    super.postSynthesize();

    /**
     * Hack to fix peer dep issue
     */

    const outdir = this.outdir;
    const rootPackageJson = join(outdir, "package.json");

    const packageJson = JSON.parse(
      fs.readFileSync(rootPackageJson).toString("utf8")
    );

    const updated = {
      ...packageJson,
      peerDependencies: {
        ...packageJson.peerDependencies,
        "@aws-cdk/aws-appsync-alpha": "*",
      },
    };

    fs.writeFileSync(rootPackageJson, `${JSON.stringify(updated, null, 2)}\n`);
  }
}

const assumeRoleStep = {
  name: "Configure AWS Credentials",
  uses: "aws-actions/configure-aws-credentials@v1",
  with: {
    "role-to-assume":
      "arn:aws:iam::593491530938:role/githubActionStack-githubactionroleA106E4DC-14SHKLVA61IN4",
    "aws-region": "us-east-1",
    "role-duration-seconds": 60 * 60,
  },
  if: `contains(fromJson('["release", "build", "close"]'), github.workflow)`,
};

const project = new CustomTypescriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",
  description:
    "Functionless, a TypeScript plugin and Construct library for the AWS CDK",
  bin: {
    functionless: "./bin/functionless.js",
  },
  projenrcTs: true,
  deps: [
    "@types/aws-lambda",
    "fs-extra",
    "minimatch",
    "@functionless/nodejs-closure-serializer",
    "@functionless/ast-reflection@^0.3.1",
    "@swc/cli",
    "@swc/core@1.2.245",
    "@swc/register",
  ],
  devDeps: [
    `@aws-cdk/aws-appsync-alpha@${MIN_CDK_VERSION}-alpha.0`,
    "@types/fs-extra",
    "@types/minimatch",
    "@types/uuid",
    "amplify-appsync-simulator",
    "axios",
    "eslint-plugin-no-only-tests",
    "graphql-request",
    "ts-node",
    "ts-patch",
    "flatted",
    /**
     * For CDK Local Stack tests
     */
    `@aws-cdk/cloud-assembly-schema@${MIN_CDK_VERSION}`,
    `@aws-cdk/cloudformation-diff@${MIN_CDK_VERSION}`,
    `@aws-cdk/cx-api@${MIN_CDK_VERSION}`,
    "aws-sdk",
    `aws-cdk@${MIN_CDK_VERSION}`,
    `cdk-assets@${MIN_CDK_VERSION}`,
    "promptly",
    "proxy-agent",
    /**
     * End Local
     */
    // for serializer testing
    "uuid",
    "@swc/jest",
  ],
  jestOptions: {
    jestConfig: {
      collectCoverage: false,
      coveragePathIgnorePatterns: ["/test/", "/node_modules/", "/lib"],
      moduleNameMapper: {
        "^@fnls$": "<rootDir>/lib/index",
      },
      transform: {
        "^.+\\.(t|j)sx?$": ["./jest.js", {}],
      },
    },
    extraCliOptions: ["--no-cache"],
  },
  scripts: {
    localstack: "./scripts/localstack",
    "build:website": "npx tsc && cd ./website && yarn && yarn build",
  },
  peerDeps: [
    `aws-cdk-lib@^${MIN_CDK_VERSION}`,
    "aws-sdk",
    "constructs@^10.0.0",
    "esbuild",
    "typesafe-dynamodb@^0.1.5",
    "typescript@^4.8.2",
  ],
  eslintOptions: {
    dirs: ["src"],
    ignorePatterns: [
      "scripts/**",
      "register.js",
      "jest.js",
      "swc-config.js",
      "website/**",
    ],
    lintProjenRc: false,
  },
  tsconfig: {
    compilerOptions: {
      // @ts-ignore
      declarationMap: true,
      lib: ["dom", "ES2022"],
      noUncheckedIndexedAccess: true,
      resolveJsonModule: true,
      skipLibCheck: true,
    },
  },
  tsconfigDev: {
    compilerOptions: {
      paths: {
        "@fnls": ["lib/index"],
      },
      baseUrl: ".",
      skipLibCheck: true,
    },
  },
  gitignore: [".DS_Store", ".dccache", ".swc"],
  releaseToNpm: true,
  depsUpgradeOptions: {
    workflowOptions: {
      projenCredentials: GithubCredentials.fromApp(),
    },
  },
  prettier: true,
  workflowBootstrapSteps: [assumeRoleStep],
});
// projen assumes ts-jest
delete project.jest!.config.globals;
delete project.jest!.config.preset;

const packageJson = project.tryFindObjectFile("package.json")!;

packageJson.addOverride("lint-staged", {
  "*.{tsx,jsx,ts,js,json,md,css}": ["eslint --fix"],
});

const closeWorkflow = project.github?.addWorkflow("close");
closeWorkflow?.on({
  pullRequest: {
    types: ["closed"],
  },
});
const cleanJob: Job = {
  permissions: { contents: JobPermission.WRITE, idToken: JobPermission.WRITE },
  runsOn: ["ubuntu-latest"],
  env: {
    CI: "true",
  },
  steps: [
    assumeRoleStep,
    {
      uses: "marvinpinto/action-inject-ssm-secrets@latest",
      with: {
        ssm_parameter:
          // on merge, github.ref no longer returns the same format. github.event.pull_request.number returns the PR number so we can re-construct the ref.
          // https://github.com/actions/runner/issues/256/
          "/functionlessTestDeleter/FunctionlessTest-refs/pull/${{ github.event.pull_request.number }}/merge/deleteUrl",
        env_variable_name: "FL_DELETE_URL",
      },
    },
    {
      uses: "fjogeleit/http-request-action@v1",
      with: {
        url: "${{ env.FL_DELETE_URL }}",
        method: "GET",
      },
    },
  ],
};
closeWorkflow?.addJob("cleanUp", cleanJob);

project.compileTask.prependExec(
  "yarn link && cd ./test-app && yarn link functionless"
);
project.compileTask.env("NODE_OPTIONS", "--max-old-space-size=6144");
project.compileTask.env("TEST_DEPLOY_TARGET", "AWS");

project.compileTask.prependExec("ts-node ./scripts/sdk-gen.ts");

// start over...
project.testTask.reset();

// To run tests on github using localstack instead of AWS, uncomment the below and comment out TEST_DEPLOY_TARGET.
// project.testTask.prependExec("./scripts/localstack");
// project.testTask.exec("localstack stop");
// project.testTask.env("DEFAULT_REGION", "ap-northeast-1");
// project.testTask.env("AWS_ACCOUNT_ID", "000000000000");
// project.testTask.env("AWS_ACCESS_KEY_ID", "test");
// project.testTask.env("AWS_SECRET_ACCESS_KEY", "test");
project.testTask.env("TEST_DEPLOY_TARGET", "AWS");
project.testTask.env("NODE_OPTIONS", "--max-old-space-size=6144");

const testFast = project.addTask("test:fast", {
  exec: "jest --passWithNoTests --all --updateSnapshot --testPathIgnorePatterns '(localstack|runtime)'",
});

const testRuntime = project.addTask("test:runtime", {
  exec: "jest --passWithNoTests --all --updateSnapshot --testPathPattern '(localstack|runtime)' --no-cache",
});

const testApp = project.addTask("test:app", {
  exec: "cd ./test-app && yarn && yarn build && yarn synth --quiet",
});

project.testTask.spawn(testFast);
project.testTask.spawn(testRuntime);
project.testTask.spawn(testApp);
project.testTask.spawn(project.tasks.tryFind("eslint")!);

project.addPackageIgnore("/test-app");
project.addPackageIgnore("/website");

// id-token is required for aws-actions/configure-aws-credentials@v1 with OIDC
// https://github.com/aws-actions/configure-aws-credentials/issues/271#issuecomment-1012450577
// @ts-ignore
project.buildWorkflow.workflow.jobs.build = {
  // @ts-ignore
  ...project.buildWorkflow.workflow.jobs.build,
  // deploy the clean up stack during tests to be available for the cleanup pull_request closed job
  // only do this for build workflow as the release workflow deletes immediately
  env: {
    // @ts-ignore
    ...project.buildWorkflow.workflow.jobs.build.env,
    CLEAN_UP_STACK: "1",
  },
  permissions: {
    // @ts-ignore
    ...project.buildWorkflow.workflow.jobs.build.permissions,
    "id-token": "write",
    contents: "write",
  },
};

// id-token is required for aws-actions/configure-aws-credentials@v1 with OIDC
// https://github.com/aws-actions/configure-aws-credentials/issues/271#issuecomment-1012450577
// @ts-ignore
project.release.defaultBranch.workflow.jobs.release = {
  // @ts-ignore
  ...project.release.defaultBranch.workflow.jobs.release,
  env: {
    // @ts-ignore
    ...project.release.defaultBranch.workflow.jobs.release.env,
    // on release, do not maintain the stacks, delete them right away
    TEST_STACK_RETENTION_POLICY: "DELETE",
  },
  permissions: {
    // @ts-ignore
    ...project.release.defaultBranch.workflow.jobs.release.permissions,
    "id-token": "write",
    contents: "write",
  },
};

project.eslint!.addRules({
  quotes: "off",
  "comma-dangle": "off",
  "quote-props": "off",
  "@typescript-eslint/indent": "off",
  "@typescript-eslint/no-shadow": "off",
  "@typescript-eslint/member-ordering": "off",
  "brace-style": "off",
  "@typescript-eslint/explicit-member-accessibility": "off",
  "no-debugger": "error",
});

project.eslint!.addIgnorePattern("test-app/hook.js");

project.eslint!.addOverride({
  files: ["*.ts", "*.mts", "*.cts", "*.tsx"],
  // @ts-ignore
  plugins: ["no-only-tests"],
  parserOptions: {
    project: [
      "./tsconfig.dev.json",
      "./test-app/tsconfig.json",
      "./website/tsconfig.json",
      "./test/tsconfig.json",
    ],
  },
  rules: {
    "@typescript-eslint/explicit-member-accessibility": [
      "error",
      {
        accessibility: "explicit",
        overrides: {
          accessors: "explicit",
          constructors: "no-public",
          methods: "explicit",
          properties: "off",
          parameterProperties: "off",
        },
      },
    ],
    "no-only-tests/no-only-tests": ["error", { fix: true, block: ["test."] }],
  },
});

project.prettier!.addIgnorePattern("coverage");
project.prettier!.addIgnorePattern("lib");

project.synth();
