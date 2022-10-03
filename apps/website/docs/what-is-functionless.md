---
sidebar_position: 0
description: Functionless is a TypeScript compiler plugin and Construct library that enhances your cloud programming experience with the AWS Cloud Development Kit (CDK).
---

# What is Functionless?

Functionless is a TypeScript compiler plugin and Construct library that enhances your cloud programming experience with the AWS Cloud Development Kit (CDK). Tedious and error-prone configurations are inferred directly from your application logic, including IAM Policies, environment variables and proprietary domain specific languages such as Amazon States Language, Velocity Templates and Event Bridge Pattern Documents. This makes it simple, easy and fun(!) to configure AWS's powerful services without learning a new language or abstraction. Functionless always ensures that your IAM Policies are minimally permissive and that there is no missing plumbing code, so you can be confident that when your code compiles - then it also deploys, runs and is secure!

Let's illustrate with a simple example of an Express Step Function workflow. Notice how the Step Function's implementation of `getItem` is included inline as a native TypeScript function.

```ts
const getItem = new ExpressStepFunction(stack, "Function", async () => {
  $SFN.waitFor(10);

  const status = await $AWS.DynamoDB.GetItem({
    Table,
    Key: {
      id: {
        S: "string",
      },
    },
  });

  if (status === "FAILED") {
    throw new Error("Failed");
  }
});
```

Now, compare this with the vanilla AWS CDK implementation (below) which requires you to learn a boiler-plate abstraction, all just to write a simple integration. This can get out of hand very quickly.

```ts
const getItem = new aws_stepfunctions.StateMachine(stack, "GetItem", {
  definition: new aws_stepfunctions.Wait(stack, "Wait10", {
    time: aws_stepfunctions.WaitTime.duration(Duration.seconds(10)),
  })
    .next(
      new aws_stepfunctions_tasks.DynamoGetItem(stack, "GetItemTask", {
        key: {
          id: {
            S: tasks.DynamoAttributeValue.fromString("string"),
          },
        },
        table: table,
      })
    )
    .next(
      new sfn.Choice(this, "Job Complete?")
        .when(sfn.Condition.stringEquals("$.status", "FAILED"), jobFailed)
        .when(sfn.Condition.stringEquals("$.status", "SUCCEEDED"), finalStatus)
        .otherwise(waitX)
    ),
  stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
});
```

At the end of the day, the Amazon States Language (ASL) JSON uploaded to AWS Step Functions can be seen below. Functionless makes authoring this simple and concise, enabling you to move faster.

```json
{
  "StartAt": "$SFN.waitFor(10)",
  "States": {
    "$SFN.waitFor(10)": {
      "Type": "Wait",
      "Seconds": 10,
      "Next": "status = $AWS.DynamoDB.GetItem()"
    },
    "status = $AWS.DynamoDB.GetItem()": {
      "Type": "Task",
      "Resource": "arn:aws:states:::aws-sdk:dynamodb:getItem",
      "Parameters": {
        "TableName": "${Token[TOKEN.256]}",
        "Key": {
          "id": {
            "S": "string"
          }
        }
      },
      "ResultPath": "$.status",
      "Next": "if(status == \"FAILED\")"
    },
    "if(status == \"FAILED\")": {
      "Type": "Choice",
      "Choices": [
        {
          "Next": "throw new Error(\"Failed\")",
          "Variable": "$.status",
          "StringEquals": "FAILED"
        }
      ],
      "Default": "return null"
    },
    "throw new Error(\"Failed\")": {
      "Type": "Fail",
      "Error": "Error",
      "Cause": "{\"message\":\"Failed\"}"
    },
    "return null": {
      "Type": "Pass",
      "End": true,
      "Parameters": {
        "null": null
      },
      "OutputPath": "$.null"
    }
  }
}
```

Functionless isn't just for Step Functions! Also supported are AppSync GraphQL Velocity Template Resolvers, Event Bridge Rules and Lambda Functions. The experience of configuring each of these services is the same in Functionless - just write functions.

```ts
const getCat = new AppsyncResolver(
  ($context: AppsyncContext<{ id: string }, Cat>) => {
    return catTable.appsync.get($context.id);
  }
).addResolver(api, {
  typeName: "Query",
  fieldName: "getCat",
});

const bus = new EventBus<CatEvent>(stack, "EventBus");

// filter Events from the Event Bus based on some complex condition
const catPeopleEvents = bus.when(
  stack,
  "CatPeopleEvents",
  (event) =>
    event["detail-type"] === "Create" &&
    event.detail.interests.includes("CATS") &&
    event.detail.age >= 18 &&
    event.detail.age < 30
);

// create a Lambda Function and log out the CatEvent
const catLambdaFunction = new Function(
  stack,
  "CatLambdaFunction",
  async (cat: CatEvent) => {
    console.log(cat);
  }
);

// pipe all CatEvents to the Lambda Function
catPeopleEvents.pipe(catLambdaFunction);
```

See [Integrations](./concepts/integration) for more information on each of these integration patterns.
