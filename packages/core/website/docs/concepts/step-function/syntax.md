---
sidebar_position: 2
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

Function calls are supported, but only for [intrinsic functions](#intrinsic-functions) and [integrations](../integration).

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

```ts
if (name == "sam") {
  task();
}
```

If conditions are translated into a `Choice` State where each `if` and `else if` results in an entry in the `Choices` array.

```json
{
  "Type": "Choice",
  "Choices": [
    {
      "Variable": "$.name",
      "StringEquals": "sam",
      "Next": "task()"
    }
  ]
}
```

The final `else` block populates the `Default` state.

```ts
else {
  task()
}
```

```json
{
  "Default": "task()"
}
```

If there is no `else`, then the `Default` state points to the statement immediately following the `if` block.

```ts
if (cond) {
  // ..
}
return true;
```

```json
{
  "Default": "return true"
}
```

## comparison operators

Comparison operators are supported within `if`, `else if`, `while` and `do-while` blocks.

```ts
if (x > 0 && x <= 10) {
  //
} else if (x > 100) {
  //
}

while (x > 0 && x <= 10) {
  //
}

do {
  //
} while (x > 0 && x <= 10);
```

Supported operators include:

- `&&`
- `||`
- `!`
- `==`
- `!=`
- `>`
- `>=`
- `<`
- `<=`

## for-of

A `for-of` loop processes each item in an array.

```ts
for (const item of items) {
  await task(item);
}
```

It translates into a [`Map` State](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-map-state.html) with a `maxConcurrency: 1`.

```json
{
  "Type": "Map",
  "ItemsPath": "$.items",
  "Parameters": {
    "items.$": "$$.Map.Item.Value"
  },
  "Iterator": {
    "StartsAt": "task(item)",
    "States": {
      "task(item)": {
        "Type": "Task"
        // etc.
      }
    }
  }
}
```

Functionless maps JavaScript's behavior to ASL, so max concurrency is set to 1 to emulate the exact behavior of a for loop. This is not always desired in a cloud environment. If you need concurrency, use the [$SFN.map](./intrinsic-functions.md#map) intrinsic function instead.

## for-in

A `for-in` loop processes each index in an array.

```ts
for (const i in array) {
  await task(array[i]);
}
```

It translates into a `Map` State with a `maxConcurrency: 1`.

```json
{
  "Type": "Map",
  "ItemsPath": "$.items",
  "Parameters": {
    // note how `i` is set to the `Index`
    "i.$": "$$.Map.Item.Index"
  },
  "Iterator": {
    "StartsAt": "task(item)",
    "States": {
      "task(item)": {
        "Type": "Task"
        // etc.
      }
    }
  }
}
```

Functionless maps JavaScript's behavior to ASL, so max concurrency is set to 1 to emulate the exact behavior of a for loop. This is not always desired in a cloud environment. If you need concurrency, use the [$SFN.map](./intrinsic-functions.md#map) intrinsic function instead.

### Limitation

Due to a limitation in ASL, `for-in` is only supported for arrays because there is no way to enumerate all keys in an object within ASL.

```ts
// invalid!
for (const key in object) {
}
```

## while

A `while` loop runs a block of code until some condition evaluates to `false`.

```ts
while (flag) {
  flag = await task();
}
return;
```

While loops are translated into a `Choice` State.

```json
{
  "StartsAt": "while (flag)",
  "States": {
    "while (flag)": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.flag",
          "BooleanEquals": true,
          "Next": "flag = task()"
        }
      ],
      "Default": "return"
    },
    "flag = task()": {
      "Type": "Task",
      "Next": "while (flag)"
    }
  }
}
```

## do while

A `do-while` loop runs a block of code until some condition evaluates to `false`. The condition is only checked after the first evaluation, so the block of code will always run regardless of the initial value of the condition.

```ts
do {
  flag = task();
} while (flag);
return;
```

Do-while loops are translated into a `Choice` State.

```json
{
  // note how the machine starts by evaluating `flag = task()`
  "StartsAt": "flag = task()",
  "States": {
    "flag = task()": {
      "Type": "Task",
      "Next": "while (flag)"
    },
    "while (flag)": {
      "Type": "Choice",
      "Choices": [
        {
          "Variable": "$.flag",
          "BooleanEquals": true,
          "Next": "flag = task()"
        }
      ],
      "Default": "return"
    }
  }
}
```

## try-catch-finally

The `try`, `catch` and `finally` blocks make use of ASL's `Pass` and `Catch` functionality to implement various try-catch scenarios.

### catch

The `Catch` property of a Task within the `try` block transitions to a State within the `catch` block.

```ts
try {
  await taskA();
} catch {
  await taskB();
}
```

In this example, `taskA`'s `Catch` transition points to `taskB`.

```json
{
  "Type": "Task",
  "Catch": [
    {
      "ErrorEquals": ["States.ALL"],
      "Next": "taskB()",
      "ResultPath": null
    }
  ]
}
```

### catch(err)

If the error is caught and used within the `catch` block like below:

```ts
try {
  await taskA();
} catch (err) {
  await taskB(err);
}
```

Then, the `ResultPath` of the `Catch` will write the error to a variable, e.g. `$.err`.

```json
{
  "ErrorEquals": ["States.ALL"],
  "Next": "catch(err)",
  "ResultPath": "$.err"
}
```

Two intermediate states, `catch(err)` and `0_catch(err)`, are created to parse the contents of the error. `catch(err)` first parses the JSON payload from the `Cause` and stores in a temporary variable, `$.err.0_ParsedError` and then `0_catch(err)` writes the error back to `$.err.

_Track [#139](https://github.com/functionless/functionless/issues/139) for discussed improvements to this translation._

```json
{
  "catch(err)": {
    "Type": "Pass",
    "ResultPath": "$.err",
    "Parameters": {
      "0_ParsedError.$": "States.StringToJson($.err.Cause)"
    },
    "Next": "0_catch(err)"
  },
  "0_catch(err)": {
    "Type": "Pass",
    "ResultPath": "$.err",
    "InputPath": "$.err.0_ParsedError",
    "Next": "return err.message"
  }
}
```

### finally

A `finally` block is always executed when exiting a `try` or `catch` block. It doesn't matter if the code throws or not, the code within a `finally` must always execute.

```ts
try {
  await task("1");
} catch {
  await task("2");
} finally {
  await task("3");
}
```

- #1 transitions to #2 if there is an error, otherwise it transitions to #3.
- #2 transitions to #3 in both cases.
- #3 transitions to the End if no error was thrown, otherwise it Fails.

<details>

```json
{
  "task(\"1\")": {
    "Catch": [
      {
        "ErrorEquals": ["States.ALL"],
        "Next": "task(\"2\")",
        "ResultPath": null
      }
    ],
    "Next": "task(\"3\")",
    "ResultSelector": "$.Payload",
    "Parameters": {
      "FunctionName": "<function-name>",
      "Payload": "1"
    },
    "Resource": "arn:aws:states:::lambda:invoke",
    "ResultPath": null,
    "Type": "Task"
  },
  "task(\"2\")": {
    "Catch": [
      {
        "ErrorEquals": ["States.ALL"],
        "Next": "task(\"3\")",
        "ResultPath": "$.0_tmp"
      }
    ],
    "Next": "task(\"3\")",
    "ResultSelector": "$.Payload",
    "Parameters": {
      "FunctionName": "<function-name>",
      "Payload": "2"
    },
    "Resource": "arn:aws:states:::lambda:invoke",
    "ResultPath": null,
    "Type": "Task"
  },
  "task(\"3\")": {
    "Next": "exit finally",
    "ResultSelector": "$.Payload",
    "Parameters": {
      "FunctionName": "<function-name>",
      "Payload": "3"
    },
    "Resource": "arn:aws:states:::lambda:invoke",
    "ResultPath": null,
    "Type": "Task"
  },
  "exit finally": {
    "Choices": [
      {
        "IsPresent": true,
        "Next": "throw finally",
        "Variable": "$.0_tmp"
      }
    ],
    "Default": "return null",
    "Type": "Choice"
  },
  "throw finally": {
    "Cause": "an error was re-thrown from a finally block which is unsupported by Step Functions",
    "Error": "ReThrowFromFinally",
    "Type": "Fail"
  },
  "return null": {
    "End": true,
    "OutputPath": "$.null",
    "Parameters": {
      "null": null
    },
    "Type": "Pass"
  }
}
```

</details>

## throw

A `throw` statement can translate into a `Fail` or `Pass` state, depending on the context in which it was thrown.

### throw outside try-catch

If an error is thrown such that it would exit the function, then a `Fail` state is used.

```ts
() => {
  throw new Error("fail");
};
```

Because there is no way for the error to be caught and handled, a `Fail` state will be created that immediately terminates the machine. The `Error` property is set to the name of the error class, in this case `"Error"`. The `Cause` property is set to a stringified JSON payload of the error' constructor's arguments.

```json
{
  "Type": "Fail",
  "Error": "Error",
  "Cause": "{\"message\":\"fail\"}"
}
```

Due to a limitation in ASL, only JSON literals are supported as arguments to the error - ASL does not support using JSON path expressions with the `Fail` State.

### throw inside try-catch

If an error is thrown within a `try-catch` block.

```ts
try {
  throw new Error("fail");
} catch (err) {
  return err.message;
}
```

Then, a `Pass` State is used to transition to the `catch` or `finally` block (if there is `catch`).

```json
{
  "throw new Error(\"cause\")": {
    "Type": "Pass",
    "Result": {
      "message": "cause"
    },
    "ResultPath": "$.err",
    "Next": "return err.message"
  }
}
```

### throw inside a Map State

Throwing from within a `for-of` loop (or any other syntax that creates a `Map` State) translates to a `Fail` State.

```ts
for (const item of items) {
  throw new Error("fail");
}
```

```json
{
  "for(item of input.items)": {
    "Type": "Map",
    "Parameters": {
      "item.$": "$$.Map.Item.Value"
    },
    "ItemsPath": "$.items",
    "Iterator": {
      "StartAt": "throw new Error(\"cause\")",
      "States": {
        "throw new Error(\"cause\")": {
          "Type": "Fail",
          "Error": "Error",
          "Cause": "{\"message\":\"fail\"}"
        }
      }
    }
  }
}
```

If the `Map` state is inside a `try-catch`, then a `Catch` is configured on the `Map` state to transition to the `catch` and `finally` blocks.

```ts
try {
  for (const item of items) {
    throw new Error("fail");
  }
} catch (err) {
  // handle error
}
```

```json
{
  "for(item of input.items)": {
    "Type": "Map",
    "Catch": [
      {
        "ErrorEquals": ["States.ALL"],
        "Next": "catch(err)",
        "ResultPath": "$.err"
      }
    ]

    // ..
  }
}
```
