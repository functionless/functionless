---
label: Hello World
sidebar_position: 2
---

# Hello World

Let's demonstrate the power of Functionless with the traditional example of logging a simple message, "hello, world!". We'll log the message within a Lambda Function, because (you know) we're all about cloud programming over here.

## Pre-requisites
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

## Super-power your App with Functionless
Now, let's import the `Function` Construct from `functionless` and use it to create a Lambda Function that logs out `"hello, world!"`.

```ts
import { Function } from "functionless";
```

This primitive enables you to define your Lambda Function's implementation directly within your Constructs. Let's add it to our `HelloWorldStack`:

```ts
export class HelloWorldStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    new Function(this, "HelloWorld", async () => {
      console.log("hello, world!");
    });
  }
}
```

Deploy with `cdk deploy` and invoke the Function from the AWS Console. You should hopefully see a message in your CloudWatch Logs:
```
hello, world!
```

And just like that, you've created your first functioning application with Functionless. Pretty easy, right?

---
**NOTE**

This example demonstrates a critical aspect of Functionless over the vanilla AWS CDK - your business logic and infrastructure exist within the same file. Functionless aims to consolidate these two, usually separate domains, into a single developer experience. It is still possible (and totally valid) to separate them like is common practice today, but we believe that their fusion will enable more powerful and interesting abstractions.

---
