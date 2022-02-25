const { typescript } = require("projen");
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",
  deps: [
    "@aws-cdk/aws-appsync-alpha",
    "immutable",
    "aws-cdk-lib",
    "constructs",
    "fs-extra",
    "source-map-support",
    "ts-node",
    "ts-patch",
    "typesafe-dynamodb",
    "typescript",
  ],
  devDeps: ["@types/fs-extra", "@types/source-map-support"],
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
  releaseToNpm: false,
});

project.testTask.prependExec("ts-patch install -s");

project.synth();
