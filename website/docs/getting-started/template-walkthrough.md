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

We start by importing constructs from `aws-cdk-lib` and `functionless`:

```typescript
import { App, Stack } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";
```

Functionless exposes AWS CDK compatible constructs from its top level API.
In this example, we're using the `Function` and `StepFunction` constructs which map to the AWS Lambda and AWS Step Functions services.

Next, we initialize `app` which will be the root of our CDK construct tree:

```typescript
const app = new App();
```

CDK models infrastructure as a tree of constructs with a single instance of `App` at the root.
To add constructs to the tree, we pass the parent construct as the first argument when instantiating a child construct.

This is exactly what we do next with `Stack`:

```typescript
const stack = new Stack(app, "MyStack");
```

`stack` will be the parent of the rest of the constructs we create.
In CDK most resources are attached to a `Stack` instance as they are the smallest deployable unit of infrastructure.

:::info

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
Functionless bridges this gap by letting you to write application code inline with the infrastructure it sits atop.

This opens up a world of new possibilities for how code and infrastructure can interact.
We can see this in action the `StepFunction` construct definition:

```typescript
new StepFunction(stack, "Workflow", async (event: { name: string }) => {
  // This will run in an AWS Step Function
  await sayFunction({ message: `Hello ${event.name}` });
});
```

There is a lot to unpack in these three lines.

First off, we're able to call the `sayFunction` construct we just defined as if it were a standard nodejs `function`.
The types infered from the closure in the `Function` definition above are preserved giving us type-checking when we call `sayFunction`.
In Functionless, types are maintained across service boundaries, removing a whole class of user error.

"But wait!", you might say. "Don't I have to set up IAM permissions for this Step Function to call that Lambda?"

Fear not.
Functionless introspects how your runtime code interacts with its infrastructure and uses this information to automatically configure least-privilege policies.

To verify this, you can run `npm run synth` and look at the CloudFormation for the generated workflow policy:

```yaml
# ...
WorkflowRoleDefaultPolicy3B788295:
  Type: AWS::IAM::Policy
  Properties:
    PolicyDocument:
      Statement:
        - Action: lambda:InvokeFunction
          Effect: Allow
          Resource:
            - Fn::GetAtt:
                - SayFunction4D0973CB
                - Arn
            - Fn::Join:
                - ""
                - - Fn::GetAtt:
                      - SayFunction4D0973CB
                      - Arn
                  - :*
      Version: "2012-10-17"
    PolicyName: WorkflowRoleDefaultPolicy3B788295
    Roles:
      - Ref: WorkflowRole98C7DC98
  Metadata:
    aws:cdk:path: MyStack/Workflow/Role/DefaultPolicy/Resource
# ...
```

Lastly, if you've ever created an AWS Step Function before, you might be wondering where all the Amazon States Language (ASL) went.

Functionless automatically transpiles the code you supply in the `StepFunction` closure into ASL.
This gives you the benefits of a world-class managed workflow service without requiring you to give up the productivity of TypeScript.

:::caution

The target service-specific languages Functionless transpiles TypeScript into don't always have parity with TypeScript.
As a result, some TypeScript syntax cannot be transpiled into different targets.

To address this **Functionless publishes a TypeScript language server plugin** which is configured in the generated template to catch these cases.

:::

At this point, your new project is [ready for deployment](./deploy-project).

[cdk-app]: https://docs.aws.amazon.com/cdk/v2/guide/apps.html
[cdk-stack]: https://docs.aws.amazon.com/cdk/v2/guide/stacks.html
