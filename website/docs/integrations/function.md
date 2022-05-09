---
title: Lambda Function
sidebar_position: 0
---

# Function

The `Function` Construct represents a Lambda Function. This includes the Function's type signature - both its input and return type.

```ts
const function: Function<Input, Output>;
```

For example, a Function that takes in a `string`, splits it by spaces and returns the list of words would have the following signature:

```ts
const stringSplit: Function<string, string[]>;
```

## Wrap an existing Function

Functionless's `Function` primitive is compatible with existing Lambda Functions created with the vanilla AWS CDK. Use the `from` function to wrap and annotate the types for an `aws_lambda.Function`.

```ts
import { aws_lambda } from "aws-cdk-lib";
import { Function, StepFunction } from "functionless";

const myFunc = Function.from<{ name: string }, string>(
  new aws_lambda.Function(this, "MyFunc", {
    ..
  })
);
```

## Create a new Function

Within an AppsyncResolver, the `myFunc` function is integrated with an ordinary function call.

```ts
new AppsyncResolver(() => {
  return myFunc({ name: "my name" });
});
```

Input to the Lambda Function is a JSON object, as should be expected.

```json
{
  "name": "my name"
}
```

In a `StepFunction`, calling the `myFunc` function configures an integration that returns only the `Payload`:

```ts
new StepFunction(this, "MyStepFunction", (name: string) => {
  return myFunc({ name });
});
```

To get the entire AWS SDK request, use `$AWS.Lambda.Invoke`:

```ts
new StepFunction(this, "MyStepFunction", (name: string) => {
  return $AWS.Lambda.Invoke({
    FunctionName: myFunc,
    Payload: {
      name,
    },
  });
});
```
