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

___

### Function closure serialization was not allowed to complete

__Error Code__: Functionless(102)

Lambda Function closure synthesis runs async, but CDK does not normally support async.

In order for the synthesis to complete successfully
1. Use autoSynth `new App({ authSynth: true })` or `new App()` with the CDK Cli (`cdk synth`)
2. Use `await asyncSynth(app)` exported from Functionless in place of `app.synth()`
3. Manually await on the closure serializer promises `await Promise.all(Function.promises)`

https://github.com/functionless/functionless/issues/128

___

### Incorrect state machine type imported

__Error Code__: Functionless(104)

Incorrect State Machine Type Imported

Functionless [StepFunction](api/classes/StepFunction.md)s are separated into [ExpressStepFunction](api/classes/ExpressStepFunction.md) and [StepFunction](api/classes/StepFunction.md)
based on being {@link aws_stepfunctions.StateMachineType.EXPRESS} or {@link aws_stepfunctions.StateMachineType.STANDARD}
respectively.

In order to ensure correct function of Functionless integrations, the correct import statement must be used.

```ts
const sfn = new aws_stepfunctions.StateMachine(scope, 'standardMachine', {...});
// valid
StateMachine.fromStepFunction(sfn);
// invalid - not an express machine
ExpressStateMachine.fromStepFunction(sfn);

const exprSfn = new aws_stepfunctions.StateMachine(scope, 'standardMachine', {
   stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
});
// valid
ExpressStateMachine.fromStepFunction(exprSfn);
// invalid - not a standard machine
StateMachine.fromStepFunction(exprSfn);
```

#### Type declaration

| Name | Type |
| :------ | :------ |
| `code` | `number` |
| `messageText` | `string` |

___

### Unexpected Error, please report this issue

__Error Code__: Functionless(103)

Generic error message to denote errors that should not happen and are not the fault of the Functionless library consumer.
