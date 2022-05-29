---
sidebar_position: 1
---

# Event Bus

An `EventBus` ingests and routes events throughout your application. Events can come from and be sent to any service, including AWS services or non-AWS SaaS such as Slack, Stripe, etc.

## New Event Bus

```ts
import { EventBus } from "functionless";

new EventBus(stack, "bus");

// to name the bus, use props
new EventBus(stack, "bus2", { eventBusName: "myBus" });
```

## Default Bus

There is a default Event Bus in every region of an AWS account. It contains events emitted by your AWS Resources, such as when a Step Function execution completes, or when a scheduled trigger fires.

Functionless provides an easy way to work with the default bus.

```ts
const defaultBus = EventBus.default();
defaultBus.when((event) => event.source === "lambda");
```

## Adopting CDK Resources

To turn a CDK Event bus into a Functionless EventBus using `EventBus.fromBus`.

```ts
const awsBus = new aws_events.EventBus(stack, "awsBus");
const bus = EventBus.fromBus(awsBus);
```

This can also be done with imported AWS CDK buses

```ts
const awsBus = new aws_events.EventBus.fromEventBusName(
  stack,
  "awsBus",
  "someBusInTheAccount"
);
const bus = EventBus.fromBus(awsBus);
```

## Put Events to your bus from other Resources

Event Bus integrates with other AWS Resources via functionless.

- Step Functions
- Lambda
- Event Bus

### Step Functions

```ts
const bus = new EventBus();
const sfn = new StepFunction(stack, "sfn", () => {
  bus({
    source: "myStepFunction",
    "detail-type": "someType",
    detail: {},
  });
});
```

:::caution
Caveat: Events passed to the bus in a step function must be one or more literal objects and may not use the spread (`...`) syntax.

```ts
const event = { source: "lambda", "detail-type": "type", detail: {} };
bus(event); // error
bus({ ...event }); // error
bus(...[event]); // error
bus({
  // works
  source: "lambda",
  "detail-type": "type",
  detail: {},
});
```

:::

### Lambda

```ts
const bus = new EventBus();
const sfn = new StepFunction(stack, "sfn", async () => {
  bus({
    source: "myStepFunction",
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
eventBus.when((event) => event.source === "lambda").pipe(eventBus2);
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
