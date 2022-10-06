---
title: Table
sidebar_position: 5
---

# Table

The `Table` Construct creates a new DynamoDB Table and exposes methods for reading and writing its data from [Integrations](./integration).

## Create a new Table

To create a new `Table`, instantiate the Construct and provide the `aws_dynamodb.TableProps`.

```ts
import { aws_dynamodb } from "aws-cdk-lib";
import { Table } from "@functionless/aws-constructs";

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

Use `Table.fromTable` to wrap an existing Table Construct created with the vanilla AWS CDK.

```ts
Table.fromTable(itemTable);
```

Optionally provide the data type, partition key and range key as type arguments.

```ts
Table.fromTable<Item, "itemId">(itemTable);
```

The Range Key is an optional, third type argument.

```ts
Table.fromTable<Item, "itemId", "timestamp">(itemTable);
```

## Runtime API

Table provides three interfaces that can be interacted with at Runtime:

### Document JSON Format

The Document APIs provide a friendly JSON format where all values are plain JS objects.

All of the Runtime APIs that use the Document JSON format are available directly on the `table.*` methods, e.g. `table.get`, `table.put`, and so on.

```ts
new Function(scope, id, async (): Promise<Person> => {
  const response = await table.get({
    Key: {
      pk: "partition key",
    },
  });

  response.Item; // Person | undefined - a vanilla JS object
});
```

::: caution
The Document are available only in Lambda because direct integrations from Step Functions or AppSync Resolvers do not support the Document JSON format.
:::

### Attribute Value JSON Format

A `Table` can also be interacted with using the "Attribute Value" APIs, available on `table.attributes`. These APIs expose the low-level DynamoDB API that receives and returns data in the "Attribute Value" JSON Format. See the [Data Types documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/HowItWorks.NamingRulesDataTypes.html#HowItWorks.DataTypes) for more information.
)

```ts
new StepFunction(scope, id, async (): Promise<Person> => {
  const response = await table.attributes.get({
    Key: {
      pk: {
        // Step Functions only supports data formatted as Attribute Values
        S: "partition key",
      },
    },
  });

  response.Item; // Person | undefined - a vanilla JS object
});
```

::: note
We recommend using the Document APIs from with AWS Lambda and only using the `table.attributes` API from within a Step Function as AWS Step Functions does not offer a direct DynamoDB Integration for the Document API .
:::

### Appsync Resolver API

Appsync API (available only in an Appsync Resolver) provides an interface to the
optimized DynamoDB interface provided by the AWS Appsync service.

AWS Appsync has a purpose-built integration for DynamoDB that takes care of un-marshalling the Attribute Value JSON format to standard JSON for GraphQL compatibility. These integration methods are exposed as methods on the `Table.appsync` property.

The TableAppsyncApi is available on `table.appsync`.

```ts
new AppsyncResolver(
  scope,
  id,
  {
    typeName: "Query",
    fieldName: "get",
  },
  async () => {
    return table.appsync.get({
      key: {
        pk: {
          S: "partition key",
        },
      },
    });
  }
);
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
