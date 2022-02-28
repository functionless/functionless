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
    "@aws-cdk/aws-appsync-alpha@^2.14.0-alpha.0",
    "aws-cdk-lib@^2.14.0",
    "constructs@^10.0.0",
    "typesafe-dynamodb@^0.1.4",
    "typescript@^4.5.5",
  ],
  eslintOptions: {
    ignorePatterns: ["**"],
  },
  tsconfig: {
    compilerOptions: {
      declarationMap: true,
      lib: ["dom"],
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

project.testTask.prependExec(
  "cd ./test-app && yarn && yarn build && yarn synth"
);
project.testTask.prependExec("ts-patch install -s");

project.addPackageIgnore("/test-app");

project.synth();
