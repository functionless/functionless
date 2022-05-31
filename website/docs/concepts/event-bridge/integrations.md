---
sidebar_position: 5
---

# Integrations

| Resource       | From `EventBus` | To `EventBus` |
| -------------- | --------------- | ------------- |
| _via_          | `pipe`          | `putEvents`   |
| Lambda         | &#x2705;        | &#x2705;      |
| Step Functions | &#x2705;        | &#x2705;      |
| EventBus       | &#x2705;        | &#x2705;      |
| App Sync       |                 | Coming Soon   |
| API Gateway    |                 | Coming Soon   |

See [issues](https://github.com/functionless/functionless/issues?q=is%3Aissue+is%3Aopen+label%3Aevent-bridge) for progress or create a new issue in the form `Event Bridge + [Service]`.

## From `EventBus` using `pipe`

```ts
new EventBus(stack, "bus")
  .when("onSignUp", (event) => event.source === "lambda")
  // send an event to a lambda
  .pipe(
    new Function(stack, "func", async (event) => {
      console.log(event.id);
    })
  );
```

## To `EventBus`

### Step Functions

```ts
const bus = new EventBus();
= new StepFunction(stack, "sfn", () => {
  bus.putEvents({
    source: "myStepFunction",
    "detail-type": "someType",
    detail: {},
  });
});
```

:::caution
Limitation: [Events passed to the bus in a step function must one or more literal objects](./integrations#Events_passed-to_the_bus_in_a_step_function_must_literal_objects) and may not use the spread (`...`) syntax.
:::

### Lambda

```ts
const bus = new EventBus();
new Lambda(stack, "sfn", async () => {
  bus.putEvents({
    source: "myFunction",
    "detail-type": "someType",
    detail: {},
  });
});
```

### Event Bus

Bus to bus sends events directly between two event buses.

:::info
See AWS's documentation for limitations with [cross-account](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-to-bus.html) and [cross-region](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-to-bus.html) bus to bus events.
:::

```ts
const eventBus = new EventBus(stack, "bus1");
const eventBus2 = new EventBus(stack, "bus2");
// send lambda events from bus1 to bus2.
eventBus
  .when("lambdaRule", (event) => event.source === "lambda")
  .pipe(eventBus2);
```

:::info
Event Bridge does not support transforming events when sending between buses.

```ts
const bus = new EventBus();
bus
  .all()
  .map((event) => event.id)
  .pipe(bus); // fails
bus.all().pipe(bus); // works
```

:::
