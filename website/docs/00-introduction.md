---
sidebar_position: 0
---

# What is Functionless?

Functionless is a compiler plugin and Construct library that enhances your cloud programming experience with TypeScript and the AWS Cloud Development Kit (CDK). All of the tedious and error-prone boilerplate configurations are inferred directly from your application logic - including IAM Policies, environment variables and proprietary domain specific languages such as Amazon States Language, Velocity Templates and Event Bridge Pattern Documents. This makes it simple, easy and fun to configure AWS's powerful services without learning a new language or abstraction. Functionless always ensures that your IAM Policies are minimally secure and that there is no missing plumbing code, giving you can confidence that when your code compiles, then it also deploys and runs!

# Example 
Let's illustrates with a simple example of calling `GetItem` on am AWS DynamoDB Table from an Express Step Function workflow.

Notice how the Step Function's implementation of `getItem` is included in-line as a native TypScript function.

```ts
const table = new Table(stack, "Table", {
  billingMode: aws_dynamodb.BillingMode.PayPerRequest,
  partitionKey: {
    name: "key",
    type: aws_dynamodb.AttributeType.String
  },
});

const getItem = new ExpressStepFunction(stack, "Function", async () => {
  return $AWS.DynamoDB.GetItem({
    Table: table,
    Key: {
      key: "string"
    }
  });
});
```

Now, compare this with the vanilla AWS CDK implementation (below) which requires you to learn a boiler-plate abstraction, all just to write a simple integration.

```ts
const getItem = new aws_stepfunctions.StateMachine(stack, "GetItem", {
  definition: new aws_stepfunctions_tasks.DynamoGetItem(stack, "GetItemTask", {
    key: { 
      key: tasks.DynamoAttributeValue.fromString("string")
    },
    table: table,
  }),
  stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS
});
```

This can quickly get out of hand as complexity grows.

```ts
// ..

const definition = submitJob
  .next(waitX)
  .next(getStatus)
  .next(new sfn.Choice(this, 'Job Complete?')
    .when(sfn.Condition.stringEquals('$.status', 'FAILED'), jobFailed)
    .when(sfn.Condition.stringEquals('$.status', 'SUCCEEDED'), finalStatus)
    .otherwise(waitX));

// ..
```

Functionless solves this by deriving this configuration from the function implementation.

```ts
// ..

$SFN.waitFor(x);

const status = getStatus();
if (status === "FAILED") {
  throw new Error("Failed");
}

// ..
```

Functionless also supports deriving boilerplate configuration for AppSync GraphQL Velocity Template Resolvers, Event Bridge Rules and Lambda Functions. See [Integrations](./02-integrations/00-integrations.md) for a comprehensive list.