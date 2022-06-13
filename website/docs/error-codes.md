---
title: "Error Codes"
sidebar_position: 3
---

# Error Codes

### Cannot perform arithmetic on variables in Step Function

__Error Code__: Functionless(100)

The computations that [Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)
can do is restricted by JSON Path and the limited [Intrinsic Functions](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-intrinsic-functions.html). Currently, arithmetic expressions are not supported.
```ts
// ok
new StepFunction(scope, id, () => 1 + 2);

// illegal!
new StepFunction(scope, id, (input: { num: number }) => input.number + 1);
```

To workaround, use a Lambda Function to implement the arithmetic expression. Be aware that this comes with added cost and operational risk.

```ts
const add = new Function(scope, "add", (input: { a: number, b: number }) => input.a + input.b);

new StepFunction(scope, id, async (input: { num: number }) => {
  await add({a: input.number, b: 1});
});
```

___

### Function not compiled by Functionless plugin

__Error Code__: Functionless(101)

During CDK synth a function was encountered which was not compiled by the Functionless compiler plugin.
This suggests that the plugin was not correctly configured for this project.

Ensure you follow the instructions at https://functionless.org/docs/getting-started.
