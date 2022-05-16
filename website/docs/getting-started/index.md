---
sidebar_position: 0
---

# Getting Started

Functionless is a compiler plugin and Construct library that enhances your cloud programming experience with TypeScript and the AWS Cloud Development Kit (CDK). Tedious and error-prone configurations are inferred directly from your application logic, including IAM Policies, environment variables and proprietary domain specific languages such as Amazon States Language, Velocity Templates and Event Bridge Pattern Documents. This makes it simple, easy and fun(!) to configure AWS's powerful services without learning a new language or abstraction. Functionless always ensures that your IAM Policies are minimally permissive and that there is no missing plumbing code, so you can be confident that when your code compiles - then it also deploys and runs!

# Example 
Let's illustrate with a simple example of calling `GetItem` on an AWS DynamoDB Table from an Express Step Function workflow.

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

Functionless also supports deriving boilerplate configuration for AppSync GraphQL Velocity Template Resolvers, Event Bridge Rules and Lambda Functions. The experience of configuring each of these services is the same in Functionless - just write functions:
```ts
const getCat = new AppsyncResolver(async ($context: AppsyncContext<{id: string}, Cat>) => {
  return catTable.get($context.id);
}).addResolver(api, {
  typeName: "Query",
  fieldName: "getCat"
});

const bus = new EventBus<CatEvent>(stack, "EventBus");

// filter Events from the Event Bus based on some complex condition
const catPeopleEvents = bus.when(stack, "CatPeopleEvents",
  (event) =>
    event["detail-type"] === "Create" &&
    event.detail.interests.includes("CATS") &&
    event.detail.age >= 18 &&
    event.detail.age < 30
);

// create a Lambda Function and log out the CatEvent
const catLambdaFunction = new Function(stack, "CatLambdaFunction", async (cat: CatEvent) => {
  console.log(cat);
});

// pipe all CatEvents to the Lambda Function
catPeopleEvents.pipe(catLambdaFunction);
```

Behind the scenes, each of these services have their own proprietary configuration and DSL, Functionless makes it so you don't have to learn those details. Instead, you just write TypeScript code.

See [Integrations](../concepts/) for more information on each of these integration patterns.