# Event Bridge

Functionless simplifies development of Event Driven Architectures (EDA) with a typesafe and fluent API for AWS Event Bridge.

```ts
const bus = new EventBus<SignUpEvent, CheckoutEvent>();

bus
  .when(
    scope,
    "onSignUp",
    (event) => event["detail-type"].kind === "SignUpEvent"
  )
  .map((event) => ({
    username: event["detail-type"].username,
    timestamp: event["detail-type"].timestamp,
  }))
  .pipe(onSignupStepFunction);
```

To jump right into building, see the [`EventBus`](./event-bus.md) documentation.

## What is AWS Event Bridge?

[AWS Event Bridge](https://aws.amazon.com/eventbridge/) is a fully managed pub-sub service capable of ingesting an arbitrary number of events from upstream services, (optionally) filtering and transforming them, before (finally) forwarding them to downstream services. Event Bridge enables the development of more scalable systems by de-coupling the producer of an event from its consumers(s). It is a highly managed service, capable of arbitrary scale and is configured declaratively with pure JSON documents - so there is no runtime code for the developer to maintain.

## How it works

An instance of an [`EventBus`](./event-bus.md) ingest events and routes them to downstream integrations according to Rules created by the user. Events are sent to downstream services such as Lambda Functions, Step Functions, or a third party (non-AWS) API. Sources of events include other AWS Resources or third party (non-AWS) SaaS products, e.g. a Slack webhook.

## Default Event Bus

There is a default Event Bus in every region of an AWS account. It contains events emitted by your AWS Resources, such as when a Step Function execution completes, or when a scheduled trigger fires.
