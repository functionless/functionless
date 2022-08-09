---
label: Getting Started
sidebar_position: 1
---

# Getting Started

## Projen Template

To create a new project, run the following command.

```sh
npx projen new --from @functionless/projen
```

This will create a new folder containing a CDK application with Functionless installed using the [Projen](https://github.com/projen/projen) template tool.

## Deploy to AWS

Functionless is a library that integrates directly into a standard CDK application. To deploy, first set up your AWS CLI and AWS account for CDK development (see the official [AWS CDK docs](https://docs.aws.amazon.com/cdk/v2/guide/home.html)), and then use the `cdk` CLI as usual:

```bash
npx cdk deploy
```

For convenience, your new project comes with a `deploy` script:

```bash
# if using yarn
yarn deploy

# if using NPM
npm run deploy
```

## Add to an existing CDK project

Functionless relies on a [SWC](https://swc.rs) plugin for analyzing your code, so first install SWC and its core dependencies:

```shell
npm install --save-dev functionless @swc/core@1.2.218 @swc/cli @swc/register @swc/jest
```

Then, create a `.swcrc` file to configure SWC to use the [Functionless AST Reflection Plugin](https://github.com/functionless/ast-reflection).

```json
{
  "jsc": {
    "parser": {
      "syntax": "typescript",
      "dynamicImport": false,
      "decorators": false,
      "hidden": {
        "jest": true
      }
    },
    "transform": null,
    "target": "es2021",
    "loose": false,
    "externalHelpers": false,
    "experimental": {
      "plugins": [
        [
          // make sure to configure the ast-reflection plugin or else Functionless will not work
          "@functionless/ast-reflection",
          {}
        ]
      ]
    }
  },
  "minify": false,
  "sourceMaps": "inline",
  "module": {
    "type": "commonjs"
  }
}
```

In your `cdk.json`, make sure to configure the `@swc/register` require-hook. This hook ensures that the [Functionless AST Reflection Plugin](https://github.com/functionless/ast-reflection) is applied to all `src` and `node_modules`, enabling AST-reflection on not just your code, but also your dependencies.

```json
{
  "app": "node -r '@swc/register' ./src/app.ts"
}
```

For `jest` integration, we use [`@swc/jest`](https://github.com/swc-project/jest) instead of `ts-jest`. To configure `@swc/jest`, simply add the following `transform` configuration and remove any `ts-jest` configuration.

```json
"transform": {
  "^.+\\.(t|j)sx?$": ["@swc/jest", {}]
},
```

## Configure IDE Language Service

The [`@functionless/language-service` plugin](https://github.com/functionless/functionless-language-service) adds validation errors to your IDE, such as VS Code.

To configure, first install the module as a devDependency.

```shell
# if using NPM
npm install --save-dev @functionless/language-service

# if using yarn
yarn add -D @functionless/language-service
```

Then add as a plugin to your `tsconfig.json`.

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "name": "@functionless/language-service"
      }
    ]
  }
}
```

For example, Step Functions does not support arithmetic. The language service plugin will display these errors in real-time so that you can catch errors immediately instead of after synthesizing.

![IDE Language Service Plugin](/img/ide-language-service-preview.png)

## Setup CDK Application

Functionless's Constructs slot right into your existing CDK application code. If you've just set up a new CDK application (hopefully using [projen](https://github.com/projen/projen)), you'll likely have a project with the following two files, `src/stack.ts` and `src/app.ts`.

#### `src/stack.ts`

```ts
import { Construct } from "constructs";
import { Stack } from "aws-cdk-lib";

export class HelloWorldStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);
  }
}
```

This stack is then added to your App so it can be deployed:

#### `src/app.ts`

```ts
import { App } from "aws-cdk-lib";
import { HelloWorldStack } from "./stack";

const app = new App();
const helloWorld = new HelloWorldStack(app, "HelloWorld");
```
