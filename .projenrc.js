const { typescript } = require("projen");
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",
  deps: ["fs-extra"],
  devDeps: [
    "@aws-cdk/aws-appsync-alpha",
    "@types/fs-extra",
    "aws-cdk-lib",
    "constructs",
    "ts-node",
    "ts-patch",
    "typesafe-dynamodb",
    "typescript",
  ],
  peerDeps: [
    "@aws-cdk/aws-appsync-alpha@^2.17.0-alpha.0",
    "aws-cdk-lib@^2.17.0",
    "constructs@^10.0.0",
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
        },
      ],
    },
  },
  gitignore: [".DS_Store"],
  releaseToNpm: true,
});

project.compileTask.prependExec(
  "yarn link && cd ./test-app && yarn link functionless"
);

project.testTask.prependExec(
  "cd ./test-app && yarn && yarn build && yarn synth"
);
project.testTask.prependExec("ts-patch install -s");

project.addPackageIgnore("/test-app");

project.synth();
