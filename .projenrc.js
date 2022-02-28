const { typescript } = require("projen");
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",
  deps: [
    "@aws-cdk/aws-appsync-alpha",
    "aws-cdk-lib",
    "constructs",
    "fs-extra",
    "ts-node",
    "ts-patch",
    "typesafe-dynamodb",
    "typescript",
  ],
  devDeps: ["@types/fs-extra"],
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
