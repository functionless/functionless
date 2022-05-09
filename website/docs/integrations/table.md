---
title: DynamoDB Table
sidebar_position: 1
---

# Table

The `Table` wrapper annotates an `aws_dynamodb.Table` with a type-safe interface that describes the Table's data.

See [`typesafe-dynamodb`](https://github.com/sam-goodwin/typesafe-dynamodb) for more information on how to model DynamoDB Tables with TypeScript.

In short: you first declare an `interface` describing the data in your Table:

```ts
interface Item {
  key: string;
  data: number;
}
```

Then, wrap a `aws_dynamodb.Table` CDK Construct with the `functionless.Table` construct, specify the `Item` type, Partition Key `"id"` and (optionally) the Range Key.

```ts
import { aws_dynamodb } from "aws-cdk-lib";
import { Table } from "functionless";

// see https://github.com/sam-goodwin/typesafe-dynamodb for more information on type-safe DynamoDB Tables.
const myTable = new Table<Item, "key">(
  new aws_dynamodb.Table(this, "MyTable", {
    ..
  })
)
```

Finally, call `getItem`, `putItem`, etc. (see: [#3](https://github.com/sam-goodwin/functionless/issues/3)) from within an [AppsyncResolver](#AppsyncResolver):

```ts
new AppsyncResolver(() => {
  return myTable.get({
    key: $util.toDynamoDB("key"),
  });
});
```

For `StepFunction` and `ExpressStepFunction`, you must use the `$AWS.DynamoDB.*` APIs to interact with the table instead of the `Table`'s methods. This is because Step Functions doesn't marshall DynamoDB's JSON format on behalf of the caller. For this, use the `$AWS` APIs which are a one-to-one model of the [AWS SDK service integrations](https://docs.aws.amazon.com/step-functions/latest/dg/supported-services-awssdk.html).

```ts
new StepFunction() => {
  return $AWS.DynamoDB.GetItem({
    TableName: myTable,
    Key: {
      key: {
        S: "key"
      }
    }
  });
})
```
