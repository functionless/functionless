const { typescript } = require("projen");

const MIN_CDK_VERSION = "2.20.0";

const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",
  deps: ["fs-extra", "minimatch"],
  devDeps: [
    "@aws-cdk/aws-appsync-alpha",
    // "@types/deasync",
    "@types/fs-extra",
    "@types/minimatch",
    "@types/uuid",
    "amplify-appsync-simulator",
    "aws-cdk-lib",
    "constructs",
    // "deasync",
    "esbuild",
    "@pulumi/pulumi",
    // "uuid",
    "synckit",
    "ts-node",
    "ts-patch",
    "typesafe-dynamodb",
    "typescript",
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
  },
  peerDeps: [
    `@aws-cdk/aws-appsync-alpha@^${MIN_CDK_VERSION}-alpha.0`,
    `aws-cdk-lib@^${MIN_CDK_VERSION}`,
    "constructs@^10.0.0",
    "esbuild",
    "typesafe-dynamodb@^0.1.5",
    "typescript@^4.6.2",
  ],
  eslintOptions: {
    ignorePatterns: ["**"],
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
  gitignore: [".DS_Store"],
  releaseToNpm: true,
  jestOptions: {
    jestConfig: {},
  },
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

project.addPackageIgnore("/test-app");

project.synth();
