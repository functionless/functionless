const { typescript } = require("projen");
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",

  deps: [
    "@aws-cdk/aws-appsync-alpha",
    "immutable",
    "aws-cdk-lib",
    "constructs",
    "ts-patch",
    "typesafe-dynamodb",
    "typescript",
  ],
  eslintOptions: {
    ignorePatterns: ["**"],
  },
  tsconfig: {
    compilerOptions: {
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
