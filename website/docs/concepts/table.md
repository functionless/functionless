---
title: Table
sidebar_position: 1
---

# Table

The `Table` Construct creates a new DynamoDB Table and exposes methods for reading and writing its data from [Integrations](./integration).

## Create a new Table

To create a new `Table`, instantiate the Construct and provide the `aws_dynamodb.TableProps`.

```ts
import { aws_dynamodb } from "aws-cdk-lib";
import { Table } from "functionless";

new Table(scope, "Table", {
  partitionKey: {
    name: "itemId",
    type: aws_dynamodb.AttributeType.STRING,
  },
});
```

## Declare the type of data in your Table

You can optionally use [`typesafe-dynamodb`](https://github.com/sam-goodwin/typesafe-dynamodb) to annotate the types of data in your Table for enhanced safety and IDE intellisense. This is considered best practice to avoid common and expensive bugs.

First, declare a type or interface to represent the structure of the data in your Table:

```ts
interface Item {
  itemId: string;
  data: number;
}
```

Use union types to if you're using single table design where different data types are stored within the Table:

```ts
type EcommerceDatabase = User | Cart | Order;
```

Finally, create the `Table` and specify the data type, the name of the Partition Key and (optionally) the name of the Range Key.

```ts
new Table<Item, "itemId">(..)
```

The Range Key is an optional, third type argument.

```ts
new Table<Item, "itemId", "timestamp">(..)
```

See the [`typesafe-dynamodb`](https://github.com/sam-goodwin/typesafe-dynamodb) documentation for more information on how to use types to safely model data in a DynamoDB Table using TypeScript types.

## Wrap an existing Table

Use `Table.from` to wrap an existing Table Construct created with the vanilla AWS CDK.

```ts
Table.from(itemTable);
```

Optionally provide the data type, partition key and range key as type arguments.

```ts
Table.from<Item, "itemId">(itemTable);
```

The Range Key is an optional, third type argument.

```ts
Table.from<Item, "itemId", "timestamp">(itemTable);
```

## Call from an Integration

Use the [`$AWS`](./aws.md) SDK's DynamoDB APIs to access the Table from within a Lambda [Function](./function) or [Step Function](./step-function/index.md).

```ts
new StepFunction(scope, "Function", (itemId: string) => {
  return $AWS.DynamoDB.GetItem({
    TableName: items,
    Key: {
      itemId: {
        S: itemId,
      },
    },
  });
});
```

Remember: plumbing such as IAM Policies and Environment Variables are automatically inferred from the API calls. See [Integration](./integration) for more information.

## Call from an Appsync Resolver

AWS Appsync has a purpose-built integration for DynamoDB that takes care of un-marshalling the Attribute Value JSON format to standard JSON for GraphQL compatibility. These integration methods are exposed as methods directly on the Table Construct.

**TODO**: This is subject to change, see [Issue XYZ](https://github.com/functionless/functionless/issues/33).

```ts
new AppsyncResolver(($context) => {
  return table.get({
    itemId: {
      S: $context.itemId,
    },
  });
});
```

## Pipe Events from Event Bus

Events can be directly routed from an [Event Bus](./event-bridge/event-bus.md) to DynamoDB using the `pipe` functionality.

```ts
bus
  .when(this, "Rule", (event) => event["detail-type"].type === "hello")
  .map((event) => ({
    itemId: {
      S: event.itemId,
    },
    data: {
      N: event.data,
    },
  }))
  .pipe(table);
```
