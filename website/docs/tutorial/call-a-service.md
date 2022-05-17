---
title: Call a Service
sidebar_position: 2
---

# Calling a Service

Let's make our stack more interesting by importing the `Table` Construct and creating a new DynamoDB Table:

```ts
import { aws_dynamodb } from "aws-cdk-lib";
import { Table } from "functionless";

export class HelloWorldStack extends Stack {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const todoItems = new Table(this, "TodoItems", {
      partitionKey: {
        name: "id",
        type: aws_dynamodb.AttributeType.STRING,
      },
      billingMode: aws_dynamo.BillingMode.PAY_PER_REQUEST,
    });
  }
}
```

Next, we'll create a new Function for putting items into the database.

```ts
const addItem = new Function(this, "AddItem", async (text: string) => {
  await todoItems.putItem({
    id: uuid(),
    text,
  });
});
```

Simple as that! Functionless automatically sets up any required IAM Policies and Environment Variables to make this possible.
