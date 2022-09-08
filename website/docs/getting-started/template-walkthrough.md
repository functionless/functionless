---
sidebar_position: 2
---

# Template Walkthrough

The template generates several files, most notably:

- `./package.json` includes `scripts` to `validate`, `synth`, and `deploy` your project.
- `./tsconfig.json` configures the `@functionless/language-service` plugin to improve IDE feedback.
- `./cdk.json` points CDK to the application entrypoint and requires the `functionless/register` hook to transpile project files.
- `./src/app.ts` is the appliction entrypoint.

Let's take a closer look at `./src/app.ts`:

```typescript
import { App, Stack } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";

const app = new App();

const stack = new Stack(app, "MyStack");

const sayFunction = new Function(
  stack,
  "SayFunction",
  async (event: { message: string }) => {
    console.log(event.message);
    return;
  }
);

new StepFunction(stack, "Workflow", async (event: { name: string }) => {
  await sayFunction({ message: `Hello ${event.name}` });
});
```

We start by importing Constructs from `aws-cdk-lib` and `functionless`:

```typescript
import { App, Stack } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";
```

:::note

You can read more about Constructs in the [AWS CDK documentation][cdk-construct].

:::

Functionless exposes AWS CDK compatible Constructs from its top level API.
In this example, we're using the `Function` and `StepFunction` Constructs which map to the AWS Lambda and AWS Step Functions services.

Next, we initialize `app` which will be the root of our CDK Construct tree:

```typescript
const app = new App();
```

CDK models infrastructure as a tree of Constructs with a single instance of `App` at the root.
To add Constructs to the tree, we pass the parent as the first argument when instantiating a child.

This is exactly what we do next with `Stack`:

```typescript
const stack = new Stack(app, "MyStack");
```

`stack` will be the parent of the rest of the Constructs we create.
In CDK, all Resources belong to a Stack - a Stack is a collection of Resources that are deployed and managed together.

:::note

An `App` may contain many stacks, but that is outside the scope of this document.
You can read more about [`App`][cdk-app] and [`Stack`][cdk-stack] in the CDK documentation.

:::

Once we have an instance of `stack`, we're ready to attach our first `Function`:

```typescript
const sayFunction = new Function(
  stack,
  "SayFunction",
  async (event: { message: string }) => {
    // This code will run on AWS Lambda
    console.log(event.message);
    return;
  }
);
```

This might not be the most interesting code in the world, but it offers us our first glimpse at the magic of Functionless.

If you've used CDK before, you're probably familiar with the seperation it imposes between infrastructure and application code.
Functionless bridges this gap by letting you write application code inline with the infrastructure it sits atop.

This opens up a world of new possibilities for how code and infrastructure can interact.
We can see this in action with the `StepFunction` Construct definition:

```typescript
new StepFunction(stack, "Workflow", async (event: { name: string }) => {
  // This will run in an AWS Step Function
  await sayFunction({ message: `Hello ${event.name}` });
});
```

There is a lot to unpack in these three lines.

First off, we're able to call the `sayFunction` Construct we just defined as if it were a standard nodejs `function`.
The types inferred from arrow function in the `Function` definition above are preserved, giving us type-checking when we call `sayFunction`.
In Functionless, types are maintained across service boundaries, removing a whole class of user error.

Secondly, Functionless introspects how your runtime code interacts with its infrastructure and uses this information to automatically configure least-privilege policies.

:::note

CDK happens to have equivalent functionality for inferring IAM permissions for Step Functions, but this behavior does not extend to other runtime usages such as Lambda.

In Functionless, this ability extends to any runtime usage as we'll see later when we [modify the example](./change-the-code).

:::

Lastly, if you've ever created an AWS Step Function before, you might be wondering where all the Amazon States Language (ASL) went.

Functionless automatically transpiles the code you supply in the `StepFunction` arrow function into ASL.
This gives you the benefits of a world-class managed workflow service without requiring you to give up the productivity of TypeScript.

:::caution

The target service-specific languages Functionless transpiles TypeScript into don't always have parity with TypeScript.
As a result, some TypeScript syntax cannot be transpiled into different targets.

To address this **Functionless publishes a TypeScript language server plugin** which is configured in the generated template to catch these cases.

:::

At this point, your new project is [ready for deployment](./deploy-project).

[cdk-construct]: https://docs.aws.amazon.com/cdk/v2/guide/constructs.html
[cdk-app]: https://docs.aws.amazon.com/cdk/v2/guide/apps.html
[cdk-stack]: https://docs.aws.amazon.com/cdk/v2/guide/stacks.html
