---
title: Function
sidebar_position: 1
---

# Function

The `Function` Construct creates a new AWS Lambda Function.

## Declare a Function

To create a new `Function`, simply instantiate the Construct and provide an implementation.

```ts
new Function(scope, "foo", async () => {
  console.log("hello, world");
});
```

Functionless is all about embedding the business logic within the infrastructure logic, so instead of referencing an external file containing the function implementation, it can be provided in-line as if it were an ordinary function.

## Input Data

Your Function must have 0 or 1 arguments. This argument contains the JSON data from the Invoke Lambda API Request payload.

```ts
// valid
async (arg: string) => {};

// invalid!!
async (arg: string) => {};
```

For example, if you have a Function accepting input of `{key: string}`:

```ts
async (input: { key: string }) => {};
```

Then it can be invoked with the following JSON data:

```json
{
  "key": "value"
}
```

Functionless is flexible and can handle any valid JSON value type (not just objects) - for example, a `string`, `number`, `boolean` or `null`:

```ts
async (input: string | number | boolean | null) => {};
```

Can properly handle one of the the following input JSON payload:

```json
"hello world"
123
true
false
null
```

Note the surrounding double-quotes (`"`).

## Return Data

The Function must return a `Promise`. Any data contained within the Promise is serialized to JSON and returned as the response payload.

For example:

```ts
async () => ({
  key: "value",
});
```

Results in the following JSON response payload:

```json
{
  "key": "value"
}
```

## Closure Serialization

You can write arbitrary code from within the Lambda Function. Be aware that the function's body will run on any invocation, so you should avoid writing expensive one-off computations inside.

## Call an Integration

All of Functionless's integrations can be called from within a Lambda Function. Functionless will automatically infer the required IAM Policies, set any environment variables it needs (such as the ARN of a dependency) and instantiate any SDK clients when the Function is first invoked.

```ts

```

## Configure Properties

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

A wrapped function annotates the type signature of the Function and makes it available to be called from Functionless Constructs.

## Call from an Integration

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

## Call and receive the entire API Response Envelope

To get the entire AWS SDK response, use `$AWS.Lambda.Invoke`:

```ts
const response = $AWS.Lambda.Invoke({
  FunctionName: myFunc,
  Payload: {
    name,
  },
});
```

## Forward Events from an EventBus to a Lambda Function

Finally, you can route Events from an [Event Bus](./event-bridge/event-bus.md) to a Lambda Function, provided the Function's signature is compatible.

```ts
bus
  .when(..)
  .pipe(myFunc)
```

## Wrap an existing Function

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
