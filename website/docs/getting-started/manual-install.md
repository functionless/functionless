---
sidebar_position: 1
---

# Add to an existing CDK project

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

# Setup CDK Application

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

