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

Functionless relies on a TypeScript compiler plugin. Setting this up requires two packages, `functionless` and `ts-patch`, and some configuration added to your `tsconfig.json`.

Install the `functionless` and `ts-patch` NPM packages.

```shell
npm install --save-dev functionless ts-patch
```

Then, add `ts-patch install -s` to your `prepare` script (see [ts-patch](https://github.com/nonara/ts-patch) for mode details.)

```json
{
  "scripts": {
    "prepare": "ts-patch install -s"
  }
}
```

Make sure to run `npm install` to bootstrap `ts-patch` (via the `prepare` script).

```shell
npm install
```

Finally, configure the `functionless/lib/compile` TypeScript transformer plugin in your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "functionless/lib/compile"
      }
    ]
  }
}
```

Files can be ignored by the transformer by using glob patterns in the `tsconfig.json`:

```json
{
  "compilerOptions": {
    "plugins": [
      {
        "transform": "functionless/lib/compile",
        "exclude": ["./src/**/protected/*"]
      }
    ]
  }
}
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
