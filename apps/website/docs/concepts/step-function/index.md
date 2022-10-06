# Step Function

AWS's Step Function service offers a powerful primitive for building long-running and short-running state machine workflows in the cloud without managing complex infrastructure.

```ts
new StepFunction(scope, "F", async () => {
  return "hello, world";
});
```

The Step Function can make calls to other resource like a Lambda [Function](../function/), handle a `payload`, introduce wait time, add conditional logic, throw errors, and more.

```ts
const serviceCall = new Function(
  scope,
  "serviceCall",
  async (input: string) => {
    console.log(input);
  }
);
new StepFunction(scope, "F", async (payload: { property?: string }) => {
  if (payload.property) {
    SFN.waitFor(10);
    // the lambda function `serviceCall` is invoked like an ordinary function from the state machine.
    await serviceCall(payload.property);
  } else {
    throw new Error("missing property");
  }
});
```

## Types of Step Functions

There are two types of Step Functions, [Standard](#standard) and [Express](#express).

### Standard Step Function

A Standard Step Function is a long-running workflow that can run for up to a year. Billing of Standard Step Functions is per-state transition as opposed to Express Step Functions which are billed for time. You should use Standard Step Functions when you need to run for more than 5 minutes and need guaranteed **exactly-once** semantics for each State transition. Use-cases include orchestrating an error-prone or slow asynchronous job between disparate services, for example kicking off an ETL job and waiting for it to complete.

### Express Step Function

An Express Step Function is a short-running workflow that can run for a maximum of 5 minutes. You only pay for the time it takes the machine to complete. Express Step Functions are a useful substitute for glue code ordinarily implemented with Lambda Functions, for example to handle an API Gateway request or process some event from an Event Bus. State transitions have **at-least-once** guarantees and may be re-executed if the machine terminates prematurely for any reason, as opposed to a Standard Step Function's exactly-once guarantees.

:::info
Express vs Standard workflows

It's important to choose the right type of Step Function for your workload. Refer to the official [Execution Guarantees](https://docs.aws.amazon.com/step-functions/latest/dg/express-at-least-once-execution.html) documentation for more information.
:::

## Amazon States Language (ASL)

Step Functions are configured declaratively with a JSON document structured according to the [Amazon States Language (ASL) JSON specification](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html). This JSON document specifies distinct States and transitions between them using JSON Path to select, filter and transform data.

```json
{
  "StartsAt": "Start",
  "States": {
    "Start": {
      "Type": "Pass",
      "Parameters": {
        "result": "hello world"
      },
      "End": true
    }
  }
}
```

These State Machines have many use-cases, such as long-running workflows involving both machines and humans, or as a way to implement a backend REST or GraphQL API. They are general purpose and abstract enough to represent any job, but the developer experience of writing JSON documents is verbose and error-prone.

## Generate ASL from TypeScript Code

Functionless automatically generates the ASL (and any IAM Policies) directly from your TypeScript code, enabling you to leverage the operational benefits of Step Functions using ordinary control-flow such as `if-else`, `for`, `while`, etc.

```ts
const serviceCall = new Function(
  scope,
  "serviceCall",
  async (input: string) => {
    console.log(input);
  }
);
new StepFunction(scope, "F", async (payload: { property?: string }) => {
  if (payload.property) {
    SFN.waitFor(10);
    await serviceCall(payload.property);
  } else {
    throw new Error("missing property");
  }
});
```

## Wrap an existing State Machine

There are cases in which you want to integrate with an existing State Machine.

To achieve this, use the `StepFunction.fromStateMachine` or `ExpressStepFunction.fromStateMachine` utilities to wrap existing `aws_stepfunctions.StateMachine`s.

```ts
import { aws_stepfunctions } from "aws-cdk-lib";
import { StepFunction } from "@functionless/aws-constructs";

const myMachine = StepFunction.fromStateMachine<{ name: string }, string>(
  new aws_stepfunctions.StateMachine(this, "MyMachine", {
    ...
  })
);

const myExpressMachine = ExpressStepFunction.fromStateMachine<{ name: string }, string>(
  new aws_stepfunctions.StateMachine(this, "MyMachine", {
    stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
    ...
  })
);
```

A wrapped function annotates the type signature of the `StepFunction` and makes it available to be called from Functionless Constructs.

:::warning
[Incorrect State Machine (104)](../../error-codes.md#incorrect-state-machine-type-imported) will be thrown when the wrong StateMachineType is used with the wrong Functionless `StateMachine` or `ExpressStateMachine`.

The invocation contracts for the types of state machines and permissions to grant are different so we have separated them.
:::
