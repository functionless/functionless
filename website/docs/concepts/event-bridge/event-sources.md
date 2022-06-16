---
sidebar_position: 98
---

# Event Sources

Some Functionless resources provide built in event sources. Event Sources are pre-configured rules which match the events output by default or configuration for various resources.

For example, Step Functions provides an event to the `default` bus each time the status changes for a machine execution:

```ts
const sfn = new StepFunction(...);
const successEvents = sfn.onSucceeded(stack, 'successEvent')
  .map(...) // optionally, transform
  .pipe(...); // and send somewhere;
```

Which is the same as doing:

```ts
const sfn = new StepFunction(...);
EventBus.default(scope)
  .when("sfnSuccessRule", (event) => event.detail.status === "SUCCEEDED"
    && event.source === "aws.states"
    && event.detail.stateMachineArn === sfn.stateMachineArn)
  .map(...)
  .pipe(...);
```

## Resources with Event Sources

| Resource                                         | events                                                       |
| ------------------------------------------------ | ------------------------------------------------------------ |
| [Step Functions](../step-function/event-sources) | succeeded, failed, statusChanged, aborted, started, timedOut |
| [Function](../function/event-sources)            | success, failure                                             |
