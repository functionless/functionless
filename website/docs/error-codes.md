---
title: "Error Codes"
sidebar_position: 3
---

# Error Codes

### Cannot perform arithmetic on variables in Step Function

**Error Code**: Functionless(100)

The computations that [Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)
can do is restricted by JSON Path and the limited [Intrinsic Functions](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-intrinsic-functions.html). Currently, arithmetic expressions are not supported.

```ts
// ok
new StepFunction(scope, id, () => 1 + 2);

// illegal!
new StepFunction(scope, id, (input: { num: number }) => input.number + 1);
```
