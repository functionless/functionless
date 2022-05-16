---
title: Function
sidebar_position: 1
---

# Function

The `Function` Construct creates a new AWS Lambda Function.

# Features

Functionless's `Function` primitive offers three features over and above the standard CDK Function Construct:

1. the implementation is declared in-line instead of in a separate file

```ts
new Function(scope, "F", async () => {
  console.log("hello, world");
});
```

2. the input and output types are captured as generic parameters

```ts
const func: Function<Input, Output>;
```

3. it can be called directly from an [Integration](./integration.md), for example a Step Function

```ts
new StepFunction(scope, "S", async () => {
  await myFunc();
});
```

# Create a new Function

To create a new `Function`, simply instantiate the Construct and provide an implementation.

```ts
new Function(scope, "F", async () => {
  console.log("hello, world");
});
```

# Configure Properties

To configure its properties, such as memory, timeout, runtime, etc. specify an object as the third argument:

```ts
new Function(
  scope,
  "F",
  {
    memory: 512,
    timeout: Duration.minutes(1),
    runtime: aws_lambda.Runtime.NODE_JS_16,
  },
  async () => {
    console.log("hello, world");
  }
);
```

# Wrap an existing Function

There are cases in which you want to integrate with an existing Lambda Function - perhaps you need to use a different runtime than NodeJS or you have existing Functions that you want to call from Functionless.

To achieve this, use the `Function.from` utility to wrap an existing `aws_lambda.Function`.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";

const myFunc = Function.from<{ name: string }, string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

A wrapped function annotates the type signature of the Function and makes it available to be called from Functionless Constructs.

# Call from an Integration

Lambda Functions can be called directly from any of Functionless's primitives, for example AppsyncResolvers, Step Functions and Lambda Functions.

```ts
await myFunc({ name: "sam" });
```

Input to the Lambda Function is a JSON object, as should be expected.

```json
{
  "name": "sam"
}
```

Output from the Lambda Function is the raw JSON value returned by the Lambda Function, for example:

```json
"hello sam"
```

# Call and receive the entire API Response Envelope

To get the entire AWS SDK response, use `$AWS.Lambda.Invoke`:

```ts
const response = $AWS.Lambda.Invoke({
  FunctionName: myFunc,
  Payload: {
    name,
  },
});
```

# Forward Events from an EventBus to a Lambda Function

Finally, you can route Events from an [Event Bus](./event-bridge/event-bus.md) to a Lambda Function, provided the Function's signature is compatible.

```ts
bus
  .when(..)
  .pipe(myFunc)
```
