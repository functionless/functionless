---
sidebar_position: 2
---

# Rule

[Event Bus Rules](https://docs.aws.amazon.com/eventbridge/latest/userguide/eb-bus-to-bus.html) filter the event on a bus and then send those events to a target with optional transformation.

Functionless allows typescript to be used when defining a rule.

```ts
const bus = new EventBus(stack, 'bus');
const func = new Function<string, void>(stack, 'func', (event) => console.log(event.id));

// an event bridge rule made with Functionless
const lambdaEventsRule = bus
  // filters the events on the bus to only event from lambda (or with a source value of `lambda`).
  .when('lambdaEvents', event => event.source === "lambda");
  // send all matched events to the given function.
  .pipe(func);
```

The above is equal to the below in CDK:

```ts
declare const func: aws_lambda.IFunction;
const bus = aws_events.EventBus(stack, "bus");
const lambdaEventsRule = aws_events.Rule(bus, "lambdaEvents", {
  eventBus: bus,
  eventPattern: { source: ["lambda"] },
});
lambdaEventsRule.addTarget(new aws_event_targets.LambdaFunction(func));
```

:::info
For more details on the supported schema for `Rule`s see [syntax](./syntax#event-patterns)
:::

## Scheduled Rules

Functionless supports a thin wrapper around the `EventBus` scheduled events.

Event Bridge only supports scheduled rules on the `default` bus.

```ts
EventBus.scheduled(
  stack,
  "myScheduledRule",
  aws_events.Schedule.duration(Duration.hour(1))
);
// is the same as
EventBus.default(stack).scheduled(
  stack,
  "myScheduledRule2",
  aws_events.Schedule.duration(Duration.hour(1))
);
// or in regular CDK:
new aws_events.Rule(stack, "myScheduledRule", {
  schedule: aws_events.Schedule.duration(Duration.hour(1)),
});
```

Then `map` and/or `pipe` from the scheduled rules.

```ts
EventBus
  .scheduled(stack, 'myScheduledRule',
    aws_events.Schedule.duration(Duration.hour(1)))
  .map(event => event.id)
  .pipe(new Function(...));
```

## Match All Rule

To create a rule that matches all events on a bus, use the `.all` helper on the `EventBus`

```ts
const bus = new EventBus(stack, "bus");
const allEvents = bus.all();
// or
const allEventWhen = bus.when("allBusEvent", () => true);
```

:::info
By default the `.all()` overload uses a singleton rule with the name `"all"` and scope `EventBus`. To create a unique `.all` rule or put the rule on another `Stack`, use the `.all(scope, id)` overload;

```ts
declare const bus: EventBus;
const allEvents = bus.all(anotherStackOrConstruct, "newAllRule");
```

:::

## Refining Rules

`Rule`s can be refined using the `.when` on the `Rule` object. Chained `.when` statement act like AND logic between the new and previous predicates.

```ts
const bus = new EventBus(stack, "bus");

// an event bridge rule made with Functionless
const lambdaEventsRule = bus
  // filters the events on the bus to only event from lambda (or with a source value of `lambda`).
  .when("lambdaEvents", (event) => event.source === "lambda");

// all lambda events with the detail type "some type"
lambdaEventsRule.when("rule1", (event) => event["detail-type"] === "some type");
```

## Escape Hatches

If the rule behavior desired isn't supported by Functionless, Functionless can wrap any valid CDK `aws_events.Rule`.

```ts
interface MyEvent extends Event<{}, "specialEvent", "mySource"> {}

const wrappedRule = Rule.fromRule<MyEvent>(
  new aws_events.Rule(stack, "rule", {
    eventBus: aws_events.EventBus.fromEventBusName(stack, "myBus", "someBus"),
    eventPattern: {
      source: ["lambda"],
    },
  })
);

wrappedRule.pipe(new Function(stack, "func", (event) => console.log(event.id)));
```

Check [issues](https://github.com/functionless/functionless/issues?q=is%3Aissue+is%3Aopen+label%3Aevent-bridge) to see if your use case is known or create a new issue in the form `Event Bridge + [Use Case|Bug]`.
