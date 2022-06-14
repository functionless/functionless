const { readFileSync, writeFileSync, chmodSync } = require("fs");
const { join } = require("path");
const { typescript, TextFile } = require("projen");
const { GithubCredentials } = require("projen/lib/github");

/**
 * Adds githooks into the .git/hooks folder during projen synth.
 *
 * @see https://git-scm.com/docs/githooks
 */
class GitHooksPreCommitComponent extends TextFile {
  constructor(project) {
    super(project, ".git/hooks/pre-commit", {
      lines: ["#!/bin/sh", "npx -y lint-staged"],
    });
  }

  postSynthesize() {
    chmodSync(this.path, "755");
  }
}

const MIN_CDK_VERSION = "2.20.0";

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
  /**
   * @param {typescript.TypeScriptProjectOptions} opts
   */
  constructor(opts) {
    super(opts);

    new GitHooksPreCommitComponent(this);

    this.postSynthesize = this.postSynthesize.bind(this);
  }

  postSynthesize() {
    super.postSynthesize();

    /**
     * Hack to fix peer dep issue
     */

    const outdir = this.outdir;
    const rootPackageJson = join(outdir, "package.json");

    const packageJson = JSON.parse(readFileSync(rootPackageJson));

    const updated = {
      ...packageJson,
      peerDependencies: {
        ...packageJson.peerDependencies,
        "@aws-cdk/aws-appsync-alpha": "*",
      },
    };

    writeFileSync(rootPackageJson, `${JSON.stringify(updated, null, 2)}\n`);
  }
}

const project = new CustomTypescriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",
  bin: {
    functionless: "./bin/functionless.js",
  },
  deps: ["fs-extra", "minimatch", "@functionless/nodejs-closure-serializer"],
  devDeps: [
    `@aws-cdk/aws-appsync-alpha@${MIN_CDK_VERSION}-alpha.0`,
    "@types/fs-extra",
    "@types/minimatch",
    "@types/uuid",
    "amplify-appsync-simulator",
    "graphql-request",
    "ts-node",
    "ts-patch",

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
  ],
  scripts: {
    localstack: "./scripts/localstack",
    "build:website": "npx tsc && cd ./website && yarn && yarn build",
  },
  peerDeps: [
    `aws-cdk-lib@^${MIN_CDK_VERSION}`,
    "constructs@^10.0.0",
    "esbuild",
    "typesafe-dynamodb@^0.1.5",
    "typescript@^4.7.2",
  ],
  eslintOptions: {
    lintProjenRc: true,
  },
  tsconfig: {
    compilerOptions: {
      declarationMap: true,
      lib: ["dom", "ES2019"],
    },
  },
  tsconfigDev: {
    compilerOptions: {
      plugins: [
        {
          transform: "./lib/compile",
          // exclude the source of this package while running tests.
          exclude: ["./src/{,**}/*"],
        },
      ],
    },
  },
  gitignore: [".DS_Store", ".dccache"],
  releaseToNpm: true,
  jestOptions: {
    jestConfig: {
      coveragePathIgnorePatterns: ["/test/", "/node_modules/"],
    },
  },
  depsUpgradeOptions: {
    workflowOptions: {
      projenCredentials: GithubCredentials.fromApp(),
    },
  },
  prettier: {},
});

const packageJson = project.tryFindObjectFile("package.json");

packageJson.addOverride("lint-staged", {
  "*.{tsx,jsx,ts,js,json,md,css}": ["eslint --fix"],
});

project.compileTask.prependExec(
  "yarn link && cd ./test-app && yarn link functionless"
);

project.testTask.prependExec(
  "cd ./test-app && yarn && yarn build && yarn synth"
);
project.testTask.prependExec("ts-patch install -s");
project.testTask.prependExec("./scripts/localstack");
project.testTask.exec("localstack stop");

project.testTask.env("DEFAULT_REGION", "ap-northeast-1");
project.testTask.env("AWS_ACCOUNT_ID", "000000000000");
project.testTask.env("AWS_ACCESS_KEY_ID", "test");
project.testTask.env("AWS_SECRET_ACCESS_KEY", "test");

const testFast = project.addTask("test:fast");
testFast.exec("ts-patch install -s");
testFast.exec(`jest --testPathIgnorePatterns localstack --coverage false`);

project.addPackageIgnore("/test-app");

project.eslint.addRules({
  quotes: "off",
  "comma-dangle": "off",
  "quote-props": "off",
  "@typescript-eslint/indent": "off",
  "@typescript-eslint/no-shadow": "off",
  "@typescript-eslint/member-ordering": "off",
  "brace-style": "off",
  "@typescript-eslint/explicit-member-accessibility": "off",
});

project.eslint.addOverride({
  files: ["*.ts", "*.mts", "*.cts", "*.tsx"],
  parserOptions: {
    project: [
      "./tsconfig.dev.json",
      "./test-app/tsconfig.json",
      "./website/tsconfig.json",
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
  },
});

project.prettier.addIgnorePattern("coverage");
project.prettier.addIgnorePattern("lib");

project.synth();
