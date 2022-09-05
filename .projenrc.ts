import { readFileSync, writeFileSync, chmodSync } from "fs";
import { join } from "path";
import { typescript, TextFile, JsonFile, Project } from "projen";
import { GithubCredentials } from "projen/lib/github";
import { JobStep } from "projen/lib/github/workflows-model";
import { RenderWorkflowSetupOptions } from "projen/lib/javascript";

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
    chmodSync(this.path, "755");
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
      readFileSync(rootPackageJson).toString("utf8")
    );

    const updated = {
      ...packageJson,
      peerDependencies: {
        ...packageJson.peerDependencies,
        "@aws-cdk/aws-appsync-alpha": "*",
      },
    };

    writeFileSync(rootPackageJson, `${JSON.stringify(updated, null, 2)}\n`);
  }

  public renderWorkflowSetup(
    options?: RenderWorkflowSetupOptions | undefined
  ): JobStep[] {
    return [
      ...super.renderWorkflowSetup(options),
      // https://github.com/aws-actions/configure-aws-credentials#sample-iam-role-cloudformation-template
      // the aws-org stacks create an OIDC provider for github.
      {
        name: "Configure AWS Credentials",
        uses: "aws-actions/configure-aws-credentials@v1",
        with: {
          "role-to-assume":
            "arn:aws:iam::593491530938:role/githubActionStack-githubactionroleA106E4DC-14SHKLVA61IN4",
          "aws-region": "us-east-1",
          "role-duration-seconds": 30 * 60,
        },
      },
    ];
  }
}

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
    "@functionless/ast-reflection@^0.2.2",
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
        "^.+\\.(t|j)sx?$": ["@swc/jest", {}],
      },
    },
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
    dirs: ["src", "test"],
    ignorePatterns: ["scripts/**"],
    lintProjenRc: false,
  },
  tsconfig: {
    compilerOptions: {
      // @ts-ignore
      declarationMap: true,
      noUncheckedIndexedAccess: true,
      lib: ["dom", "ES2019"],
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
});
// projen assumes ts-jest
delete project.jest!.config.globals;
delete project.jest!.config.preset;

new JsonFile(project, ".swcrc", {
  marker: false, // swc's JSON schema is super strict, so disable the `"//": "generated by projen" marker
  obj: {
    jsc: {
      parser: {
        syntax: "typescript",
        dynamicImport: false,
        decorators: false,
        hidden: {
          jest: true,
        },
      },
      transform: null,
      target: "es2021",
      loose: false,
      externalHelpers: false,
      experimental: {
        plugins: [["@functionless/ast-reflection", {}]],
      },
    },
    minify: true,
    sourceMaps: "inline",
    module: {
      type: "commonjs",
    },
  },
});

const packageJson = project.tryFindObjectFile("package.json")!;

packageJson.addOverride("lint-staged", {
  "*.{tsx,jsx,ts,js,json,md,css}": ["eslint --fix"],
});

project.compileTask.prependExec(
  "yarn link && cd ./test-app && yarn link functionless"
);
project.compileTask.env("NODE_OPTIONS", "--max-old-space-size=4096");
project.compileTask.env("TEST_DEPLOY_TARGET", "AWS");
// project.compileTask.env("TEST_DESTROY_STACKS", "1");

project.compileTask.prependExec("ts-node ./scripts/sdk-gen.ts");

project.testTask.prependExec(
  "cd ./test-app && yarn && yarn build && yarn synth --quiet"
);
// project.testTask.prependExec("./scripts/localstack");
// project.testTask.exec("localstack stop");

project.testTask.env("NODE_OPTIONS", "--max-old-space-size=4096");
// project.testTask.env("DEFAULT_REGION", "ap-northeast-1");
// project.testTask.env("AWS_ACCOUNT_ID", "000000000000");
// project.testTask.env("AWS_ACCESS_KEY_ID", "test");
// project.testTask.env("AWS_SECRET_ACCESS_KEY", "test");
project.testTask.env("TEST_DEPLOY_TARGET", "AWS");
// project.testTask.env("TEST_DESTROY_STACKS", "1");

const testFast = project.addTask("test:fast");
testFast.exec(`jest --testPathIgnorePatterns localstack --coverage false`);

project.addPackageIgnore("/test-app");

// id-token is required for aws-actions/configure-aws-credentials@v1 with OIDC
// https://github.com/aws-actions/configure-aws-credentials/issues/271#issuecomment-1012450577
// @ts-ignore
project.buildWorkflow.workflow.jobs.build = {
  // @ts-ignore
  ...project.buildWorkflow.workflow.jobs.build,
  permissions: {
    // @ts-ignore
    ...project.buildWorkflow.workflow.jobs.build.permissions,
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

project.buildWorkflow?.addPostBuildSteps;

project.synth();
