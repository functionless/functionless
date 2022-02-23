const { typescript } = require("projen");
const project = new typescript.TypeScriptProject({
  defaultReleaseBranch: "main",
  name: "functionless",

  deps: [
    "@aws-cdk/aws-appsync-alpha",
    "aws-cdk-lib",
    "constructs",
    "typesafe-dynamodb",
  ],
  eslintOptions: {
    ignorePatterns: ["**"],
  },
  tsconfig: {
    compilerOptions: {
      lib: ["dom"],
    },
  },
  gitignore: [".DS_Store"],
  releaseToNpm: false,
});
project.synth();
