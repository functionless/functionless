---
sidebar_position: 2
---

# Project Walkthrough

The template generates several files, most notably:

- `./package.json` includes `scripts` to `validate`, `synth`, and `deploy` your project.
- `./tsconfig.json` configures the `@functionless/language-service` plugin to improve IDE feedback.
- `./cdk.json` points CDK to the application entrypoint and requires the `functionless/register` hook to transpile project files.
- `./src/app.ts` is the appliction entrypoint.

Let's take a closer look at `./src/app.ts`:

```typescript
import { App, Stack } from "aws-cdk-lib";
import { Function, StepFunction } from "@functionless/aws-constructs";

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
import { Function, StepFunction } from "@functionless/aws-constructs";
```

:::note

Most Constructs wrap some underlying Resource and provide a high-level interface for configuring the service that backs the Resource.

You can read more about [Constructs][cdk-construct] and [Resources][cdk-resource] in the AWS CDK documentation.

:::

Functionless exposes AWS CDK compatible Resource Constructs from its top-level API.
In this example, we're using the `Function` and `StepFunction` Resource Constructs which map to the AWS Lambda and AWS Step Functions services.

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

The instance `stack` will be the container for the rest of the Constructs we create.
In CDK, all Resource Constructs must belong to a `Stack` - a `Stack` is a collection of Resources that are deployed and managed together.

:::note

You may be wondering why we have an `App` Construct when all Resource Constructs must belong to a `Stack`.

An `App` may contain many stacks, but this is outside the scope of this document.
You can read more about [`App`][cdk-app] and [`Stack`][cdk-stack] in the CDK documentation.

:::

Once we have an instance of `Stack`, we're ready to attach our first `Function`:

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

This bit of code offers us our first glimpse at the magic of Functionless.
If you've used CDK before, you're probably familiar with the strict seperation it imposes between infrastructure code and runtime code.

:::info

Functionless lets you write runtime code inline with the code that defines the infrastructure for your runtime code.

:::

:::note

**Runtime code** refers the application code you write that will run after the infrastructure defined by your `Stack` has been deployed.

**Infrastructure code** refers to the CDK code used to configure the services that host your runtime code as well as any supporting services used by your runtime code.

:::

This opens up a world of new possibilities for how our runtime code can interface with our infrastructure.
We can see this in action in the `StepFunction` Construct definition:

```typescript
new StepFunction(stack, "Workflow", async (event: { name: string }) => {
  // This will run in an AWS Step Function
  await sayFunction({ message: `Hello ${event.name}` });
});
```

Functionless is doing three important things for us in this block of code:

1. Allowing us to call the `sayFunction` Construct as a typed TypeScript function.
2. Recognizing that we've called an Lambda Function and granting Step Functions permissions to invoke that Lambda Function.
3. Converting a block of TypeScript code into [Amazon States Language (ASL)][asl-docs] for us.

We're able to call the `sayFunction` Construct we just defined as if it were a standard TypeScript function call.
Additionally, the arguments and return type of `sayFunction` match what we defined above:

```typescript
type sayFunction = (event: { message: string }) => Promise<void>;
```

:::info

Functionless uses type-safety to ensure the shape of your data is consistent throughout your application.
Changing your `Function` definition to accept a `number` instead of `string` for `message` would raise a TypeScript compiler error.
Functionless maintains types across service boundaries eliminating data shape consistency errors and saving countless hours of toil.

:::

You also might have noticed that we don't need to to explicitly grant Step Functions permission to invoke your Lambda Function.

:::info

Functionless introspects how your runtime code interacts with its infrastructure and uses this information to automatically configure least-privilege policies.

:::

Finally, if you've ever created an AWS Step Function before, you might be wondering where all the ASL went.

:::info

Functionless automatically transpiles the code you supply in the `StepFunction` arrow function into ASL.
This gives you the benefits of a world-class managed workflow service without requiring you to give up the productivity of TypeScript.

:::

At this point, your new project is [ready for deployment](./deploy-project).

[cdk-construct]: https://docs.aws.amazon.com/cdk/v2/guide/constructs.html
[cdk-resource]: https://docs.aws.amazon.com/cdk/v2/guide/resources.html
[cdk-app]: https://docs.aws.amazon.com/cdk/v2/guide/apps.html
[cdk-stack]: https://docs.aws.amazon.com/cdk/v2/guide/stacks.html
[asl-docs]: https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html
