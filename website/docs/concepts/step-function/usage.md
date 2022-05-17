---
sidebar_position: 3
---

# Usage

## Create a Step Function

Import `StepFunction` from `functionless`.

```ts
import { StepFunction } from "functionless";
```

Instantiate the Construct and provide the implementation as a function.

```ts
new StepFunction(scope, "StepFunction", () => {
  return "hello world";
});
```

## Input Argument

The function can only accept a single argument and it must be an object (key-value pairs).

```ts
new StepFunction(scope, "StepFunction", (input: { key: string }) => {
  return "hello world";
});
```

It must be an object because the input is used as the initial state of the state machine.

## Intrinsic Functions

The `$SFN` object provides intrinsic functions that can be called from within a Step Function. These include APIs for explicitly creating states such as `Wait`, `Parallel` and `Map`.

```ts
import { $SFN } from "functionless";
```

### waitFor

Wait for an amount of time in seconds.

```ts
$SFN.waitFor(100);
$SFN.waitFor(seconds);
```

### waitUntil

Wait until a specific timestamp.

```ts
$SFN.waitUntil("2022-01-01T00:00");
$SFN.waitUntil(timestamp);
```

### map

Map over an array of items with configurable parallelism.

```ts
$SFN.map(list, item => ..);
$SFN.map(list, {
  // configure maximum concurrently processing jobs
  maxConcurrency: 2
}, item => ..);
```

### parallel

Run one or more parallel threads.

```ts
$SFN.parallel(
  () => taskA(),
  () => taskB()
);
```

## AWS SDK Integrations

Use the [$AWS SDK Integrations](../aws.md) to call other services from within a Step Function, for example:

```ts
import { $AWS, Table } from "functionless";

const table = new Table<Item, "pk">(new aws_dynamodb.Table(..));

new StepFunction(stack, "Func", (name: string) => {
  // call DynamoDB's DeleteItem API.
  $AWS.DynamoDB.DeleteItem({
    TableName: table,
    Key: {
      name: {
        S: name
      }
    }
  })
});
```
