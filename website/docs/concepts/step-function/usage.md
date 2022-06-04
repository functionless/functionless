---
sidebar_position: 1
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

The function can only accept a single argument and it must be an object (key-value pairs). It must be an object because the input is used as the initial state of the state machine.

```ts
new StepFunction(scope, "StepFunction", (input: { key: string }) => {
  return "hello world";
});
```

## Syntax

Functionless enables you to express Step Function workflows with ordinary TypeScript.

```ts
new StepFunction(scope, "StepFunction", () => {
  while (true) {
    if (condition) {
      return "hello world";
    }
  }
});
```

This code is translated into an [Amazon States Language (ASL)](https://states-language.net/) JSON document, as can be seen below.

```json
{
  "StartsAt": "while (true)",
  "States": {
    "while (true)": {
      // etc.
    },
    "if (condition)": {
      "Type": "Choice"
      // etc.
    }
    // etc.
  }
}
```

Due to limitations in ASL, only a subset of TypeScript syntax is supported. Read the [Syntax](./syntax.md) documentation for a detailed guide on the allowed syntax and how it translates to ASL.

## Intrinsic Functions

The `$SFN` object provides intrinsic functions that can be called from within a Step Function. These include APIs for explicitly creating states such as `Wait`, `Parallel` and `Map`.

```ts
import { $SFN } from "functionless";

new StepFunction(scope, "WaitOneSecond", () => {
  $SFN.waitFor(1);
});
```

Refer to the [Intrinsic Functions](./intrinsic-functions.md) documentation for a detailed guide.

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

## Start Execution

A `StepFunction` can be called directly from an [Integration](../integration) such as [`Function`](../function.md), [`StepFunction`](./index.md), [`AppsyncResolver`](../appsync/index.md) or [`EventBus`](../event-bridge/event-bus.md).

### From a Function, StepFunction or AppsyncResolver

Calling a Step Function from a Lambda `Function`, `StepFunction` or `AppsyncResolver` are all achieved with a simple function call.

```ts
const myStepFunc = new StepFunction(scope, "id", (input: {name: string}) => { .. });

new Function(scope, id, () => {
  return myStepFunc({ name: "my name" });
});
```

The first argument is passed to the Step Function as the initial state.

```json
{
  "name": "my name"
}
```

### Pipe Events from an EventBus

Events from an [`EventBus`](../event-bridge/event-bus.md) can be `pipe`ed to a `StepFunction` using the `.pipe` function. Event Bus will trigger an asynchronous execution of the state machine for every event that matches the rule.

```ts
const events = new EventBus<PersonEvent>(scope, "PersonEvents");

const processPersonEventWorkflow = new StepFunction(
  scope,
  "ProcessPeople",
  (event: PersonEvent) => {
    // process the event
  }
);

// process each PersonEvent with the ProcessPeople workflow
events.pipe(processPersonEventWorkflow);
```

### Standard Execution

Executing a `StepFunction` returns a handle to the asynchronously running execution. This is because a `StepFunction` is a [Standard Step Function](../step-function/index.md#standard-step-function) and runs asynchronously, potentially taking up to a year, so its result cannot be returned synchronously.

```ts
const execution = myStepFunc({ name: "my name" });
```

Get the status of the execution by calling `describeExecution`:

### Describe Execution

```ts
const status = myStepFunc.describeExecution(execution.executionArn);
```

The `response` may be in one of five states, `ABORTED`, `RUNNING`, `SUCCEEDED`, `FAILED` or `TIMED_OUT`. Use the `status` field to handle each state gracefully.

```ts
const execution = myStepFunc({ name: "sam" });

// describe the Step Function's execution
const response = myStepFunc.describeExecution(execution.executionArn);

// check the status
if (response.status === "RUNNING") {
  // the function is still running, do nothing
} else if (response.status === "SUCCEEDED") {
  // the output field is present when status is SUCCEEDED
  return response.output; // "hello sam";
} else if (
  response.status === "FAILED" ||
  response.status === "TIMED_OUT" ||
  response.status === "ABORTED"
) {
  // the error and cause fields are present when status is ABORTED, FAILED or TIMED_OUT
  if (response.error === "MY_ERROR") {
    // check for the case when the error code is a known error and handle gracefully
    throw new Error(response.cause);
  } else {
    throw new Error("generic error");
  }
}
```

### Express Execution

Executing an `ExpressStepFunction` returns the result synchronously.

```ts
const myExpressFunc = new ExpressStepFunction(
  scope,
  "id",
  (input: { name: string }) => {
    return `hello ${input.name}`;
  }
);

new Function(scope, id, () => {
  const response = myExpressFunc({ name: "my name" });
});
```

The `response` may be in one of three states, `SUCCEEDED`, `FAILED` or `TIMED_OUT`. Use the `status` field to handle each state gracefully.

```ts
const response = myExpressFunc({ name: "sam" });
if (response.status === "SUCCEEDED") {
  // the output field is present when status is SUCCEEDED
  return response.output; // "hello sam";
} else if (response.status === "FAILED" || response.status === "TIMED_OUT") {
  // the error and cause fields are present when status is FAILED or TIMED_OUT
  if (response.error === "MY_ERROR") {
    // check for the case when the error code is a known error and handle gracefully
    throw new Error(response.cause);
  } else {
    throw new Error("generic error");
  }
}
```
