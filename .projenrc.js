const { readFileSync, writeFileSync, chmodSync } = require("fs");
const { join } = require("path");
const { typescript, TextFile } = require("projen");

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
  deps: ["fs-extra", "minimatch"],
  devDeps: [
    "@types/fs-extra",
    "@types/minimatch",
    "amplify-appsync-simulator",
    "prettier",
    "ts-node",
    "ts-patch",
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
          // exclude the source of this package while running tests.
          exclude: ["./src/{,**}/*"],
        },
      ],
    },
  },
  gitignore: [".DS_Store"],
  releaseToNpm: true,
});

const packageJson = project.tryFindObjectFile("package.json");

packageJson.addOverride("lint-staged", {
  "*.{ts,js,json}": "prettier --write",
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
