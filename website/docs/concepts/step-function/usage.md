---
sidebar_position: 3
---

# Usage

## Create a Standard Step Function

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

## Call Intrinsic Functions with `$SFN`

## Call Integration with the `$AWS` SDK

Use the `$AWS` SDK to call other services from within a Step Function.
