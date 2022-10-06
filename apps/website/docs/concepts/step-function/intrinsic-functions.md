---
sidebar_position: 3
---

# Intrinsic Functions

The `$SFN` object provides intrinsic functions that can be called from within a Step Function. These include APIs for explicitly creating states such as `Wait`, `Parallel` and `Map`.

```ts
import { $SFN } from "@functionless/aws-constructs";
```

## waitFor

Wait for an amount of time in seconds.

```ts
$SFN.waitFor(100);
$SFN.waitFor(seconds);
```

`waitFor` translates to a [`Wait` State](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html) in ASL.

```json
{
  "Type": "Wait",
  "Seconds": 100
}
```

```json
{
  "Type": "Wait",
  "SecondsPath": "$.seconds"
}
```

## waitUntil

Wait until a specific timestamp.

```ts
$SFN.waitUntil("2022-01-01T00:00");
$SFN.waitUntil(timestamp);
```

`waitFor` translates to a [`Wait` State](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-wait-state.html) in ASL.

```json
{
  "Type": "Wait",
  "Timestamp": "2022-01-01T00:00"
}
```

```json
{
  "Type": "Wait",
  "TimestampPath": "$.timestamp"
}
```

## map

Map over an array of items with configurable parallelism.

```ts
$SFN.map(list, item => ..);
$SFN.map(list, {
  // configure maximum concurrently processing jobs
  maxConcurrency: 2
}, item => ..);
```

`map` translates to a [`Map` State](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html) in ASL.

```json
{
  "Type": "Map",
  "ItemsPath": "$.list",
  "Iterator": {
    // ..
  }
}
```

```json
{
  "Type": "Map",
  "ItemsPath": "$.list",
  "MaxConcurrency": 2,
  "Iterator": {
    // ..
  }
}
```

## parallel

Run one or more parallel threads.

```ts
const result = $SFN.parallel(
  () => taskA(),
  () => taskB()
);

const resultA = result[0];
const resultB = result[1];
```

`parallel` translates to a [`Parallel` State](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-parallel-state.html) in ASL.

```json
{
  "Type": "Parallel",
  "Branches": [
    {
      "StartsAt": "taskA()",
      "States": {
        "taskA": {
          //
        }
      }
    },
    {
      "StartsAt": "taskB()",
      "States": {
        "taskB": {
          //
        }
      }
    }
  ]
}
```
