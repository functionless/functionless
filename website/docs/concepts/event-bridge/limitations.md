---
sidebar_position: 99
---

# Limitations

## Events passed to the bus in a step function must literal objects

Events passed to the bus in a step function must be one or more literal objects and may not use the spread (`...`) syntax.

```ts
const sfn = new StepFunction(stack, "sfn", () => {
  const event = { source: "lambda", "detail-type": "type", detail: {} };
  bus.putEvents(event); // error
  bus.putEvents({ ...event }); // error
  bus.putEvents(...[event]); // error
  bus.putEvents({
    // works
    source: "lambda",
    "detail-type": "type",
    detail: {},
  });
});
```

### Workaround

Lambda can be used to generate dynamic event collections.

```ts
const sender = new Function(stack, "sender", async (event) => {
  const event = { source: "lambda", "detail-type": "type", detail: {} };
  bus.putEvents(event); // valid
  bus.putEvents({ ...event }); // valid
  bus.putEvents(...[event]); // valid
  bus.putEvents({
    // works
    source: "lambda",
    "detail-type": "type",
    detail: {},
  });
});

const sfn = new StepFunction(stack, "sfn", () => {
  const event = { source: "lambda", "detail-type": "type", detail: {} };
  sender(event);
});
```

The limitation is due to Step Function's lack of optional or default value retrieval for fields. Attempting to access a missing field in ASL leads to en error. This can be fixed using Choice/Conditions to check for the existence of a single field, but would take all permutations of all optional fields to support optional field at runtime. Due to this limitation, we currently compute the transformation at compile time using the fields present on the literal object. For more details and process see: https://github.com/functionless/functionless/issues/101.

## Bus to Bus rules cannot be transformed

Event Bridge supports forwarding events from one bus to another, including across accounts and region.

:::info
See AWS's documentation for limitations with [cross-account](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-to-bus.html) and [cross-region](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-to-bus.html) bus to bus events.
:::

However, unlike sending events to Lambda or StepFunctions, the inputs cannot be transformed between buses.

```ts
const bus1 = new EventBus(stack, "bus1");
const bus2 = new EventBus(stack, "bus2");

bus1
  .all()
  // we want to change the source before forwarding the events.
  .map((event) => ({
    source: "bus1",
    detail: event.detail,
    "detail-type": event["detail-type"],
  }))
  .pipe(bus2); // invalid - cannot follow a map with a pipe to another bus.

// valid
bus1.all().pipe(bus2);
```

### Workaround

As a workaround, Lambda can be used to transform events.

```ts
const bus1 = new EventBus(stack, "bus1");
const bus2 = new EventBus(stack, "bus2");

// the forwarder transforms the event and then sends to bus 2 for us.
const forwarder = new Function(stack, "forwarder", async (event) => {
  const updatedEvent = { ...event, source: "bus1" };
  bus2.putEvent(updatedEvent);
});

bus1
  .all()
  // we want to change the source before forwarding the events.
  .pipe(forwarder); // invalid - cannot follow a map with a pipe to another bus.
```
