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

There is a default Event Bus in every region of an AWS account. It contains events emitted by your AWS Resources, such as when a Step Function execution completes (see [Event Sources](./event-sources#resources-with-event-sources)), or when a scheduled trigger fires.

Functionless provides an easy way to work with the default bus.

```ts
const defaultBus = EventBus.default(scope);
defaultBus.when("lambdaRule", (event) => event.source === "lambda");
```

## Adopting CDK Resources

To turn a CDK `aws_events.EventBus` into a Functionless `EventBus` using `EventBus.fromBus`.

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

Functionless supports `putEvents` integrations with other AWS Resources.

For a full list, see: [Integrations](./integrations#to-eventbus)

```ts
const bus = new EventBus(stack, "bus");
new StepFunction<{ value: string }, void>((input) => {
  bus.putEvents({
    detail: {
      value: input.value,
    },
    source: "mySource",
    "detail-type": "myEventType",
  });
});
```
