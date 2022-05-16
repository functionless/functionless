---
sidebar_position: 4
---

# Intrinsic Functions

The `$SFN` object provides intrinsic functions that can be called from within a Step Function. These include APIs for explicitly creating states such as `Wait`, `Parallel` and `Map`.

```ts
import { $SFN } from "functionless";
```

## waitFor

Wait for an amount of time in seconds.

```ts
$SFN.waitFor(100);
$SFN.waitFor(seconds);
```

## waitUntil

Wait until a specific timestamp.

```ts
$SFN.waitUntil("2022-01-01T00:00");
$SFN.waitUntil(timestamp);
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

## parallel

Run one or more parallel threads.

```ts
$SFN.parallel(
  () => taskA(),
  () => taskB()
);
```
