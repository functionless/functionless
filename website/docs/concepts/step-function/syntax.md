---
sidebar_position: 4
---

# Syntax

Only a sub-set of TypeScript syntax is supported by Step Functions because of underlying limitations in the AWS Step Function service.

## let, const

You can assign variables to constants, references or the result of a function call. Both `let` and `const` are supported.

```ts
let name = "hello";
const ref = name;
const result = await lambdaFunctionCall();
```

If the value is a constant or name reference, then a `Pass` State will be used.

```json
{
  "Type": "Pass",
  "Result": "hello",
  "ResultPath": "$.name"
}
```

If the right-hand expression is a function call, then a `Task` State is used.

```json
{
  "Type": "Task",
  "ResultPath": "$.result",
  "Resource": "arn:aws:states:::lambda:invoke",
  "Parameters": {
    "FunctionName": "<function-arn>",
    "Payload": {
      "key.$": "$.items[1:3]"
    }
  }
}
```

## function call

Function calls are supported, but only for [intrinsic functions](#intrinsic-functions) and [integrations](../integration.md).

```ts
$SFN.waitFor(10);
$SFN.waitUntil(timestamp);

await lambdaFunctionCall();
```

## ~~~arithmetic~~~

Arithmetic is **not supported(!)** due to limitations in [Amazon States Language (ASL)](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html).

```ts
// not supported!
const sum = a + b;
if (a < length - 1)
```

## if-else

Use `if`, `else if` and `else` to conditionally branch during a Step Function workflow.

## while

## do while

## for-of

## for-in
