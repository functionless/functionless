---
sidebar_position: 1
---

# Event Bus

An `EventBus` ingests and routes events throughout your application. Events can come from and be sent to any service, including AWS services or non-AWS SaaS such as Slack, Stripe, etc.

## Create an EventBus

Import the `EventBus` Construct and instantiate it.

```ts
import { EventBus } from "functionless";

const bus = new EventBus(scope, "Bus");
```

## Declare the types of Events

It is recommended to declare types for each of the event types flowing through an `EventBus`.

First, declare an `interface` representing an Event's payload.

```ts
interface UserDetails {
  id?: string;
  name: string;
  age: number;
  interests: string[];
}
```

Then, declare an `interface` for the Event's envelope - i.e. the shape of the data

```ts
interface UserEvent
  extends functionless.EventBusRuleInput<
    UserDetails,
    // We can provide custom detail-types to match on
    "Create" | "Update" | "Delete"
  > {}
```

## Filter Events with an EventBusRule

An `EventBusRule` filters events flowing through an `EventBus` using some conditional expression.

```ts
const onSignUp = bus.when(
  scope,
  "OnSignUp",
  (event) => event["detail-type"] === "SignUp"
);
```

See the [Syntax Guide for Event Patterns](./syntax.md#event-patterns) documentation for a detailed reference on the syntax supported within an `EventBusRule`.

## Transform an Event

The `map` function can be applied to an `EventBusRule` to transform the structure of the event before integration.

```ts
const onSignUpTransformed = onSignUp.map((event) => ({
  type: "SignUp",
  ...event,
}));
```

See the [Syntax Guide for Event Transforms](./syntax.md#event-transforms) documentation for a detailed reference on the syntax supported within an `EventBusTransform`.

## Pipe an Event to an Integration

The `pipe` function can be applied to an `EventBusRule` or `EventBusTransform` to send events on to an Integration, such as a Lambda `Function`, `StepFunction` or another `EventBus`.

```ts
const processSignUpEvent = new Function(
  scope,
  "ProcessSignUp",
  async (event: OnSignUp) => {
    await table.putItem({
      item: event,
    });
  }
);

onSignUp.pipe(processSignUpEvent);
```

## Declare an Event Type

Functionless supports well typed events, lets add our event schema to Typescript.

```ts
interface UserDetails {
  id?: string;
  name: string;
  age: number;
  interests: string[];
}

interface UserEvent
  extends functionless.EventBusRuleInput<
    UserDetails,
    // We can provide custom detail-types to match on
    "Create" | "Update" | "Delete"
  > {}
```

## Create an EventBusRule

Now that you have a wrapped `EventBus`, lets add some rules.

Functionless lets you write logic in Typescript on the type safe event.

Lets match all of the `Create` or `Update` events with one rule and another rule for `Delete`s.

```ts
const createOrUpdateEvents = bus.when(
  this,
  "createOrUpdateRule",
  (event) =>
    event["detail-type"] === "Create" || event["detail-type"] === "Update"
);
const deleteEvents = bus.when(
  this,
  "deleteRule",
  (event) => event["detail-type"] === "Delete"
);
```

We also want to do something special when we get a new cat lover who is between 18 and 30 years old, lets make another rule for those.

```ts
const catPeopleEvents = bus.when(
  (event) =>
    event["detail-type"] === "Create" &&
    event.detail.interests.includes("CATS") &&
    event.detail.age >= 18 &&
    event.detail.age < 30
);
```

Rules can be further refined by calling `when` on a Functionless `EventBusRule`.

```ts
// Cat people who are between 18 and 30 and do not also like dogs.
catPeopleEvents.when((event) => !event.detail.interests.includes("DOGS"));
```

## Transform the event before sending to some services like `Lambda` Functions.

We have two lambda functions to invoke, one for create or updates and another for deletes, lets make those.

```ts
const createOrUpdateFunction = new aws_lambda.Function(this, 'createOrUpdate', ...);
const deleteFunction = new aws_lambda.Function(this, 'delete', ...);
```

and wrap them with Functionless's `Function` wrapper, including given them input types.

```ts
interface CreateOrUpdate {
  id?: string;
  name: string;
  age: number;
  operation: "Create" | "Update";
  interests: string[];
}

interface Delete {
  id: string;
}

const createOrUpdateOperation = functionless.Function<CreateOrUpdate, void>(
  createOrUpdateFunction
);
const deleteOperation = functionless.Function<Delete, void>(deleteFunction);
```

The events from before do not match the formats from before, so lets transform them to the structures match.

```ts
const createOrUpdateEventsTransformed =
  createOrUpdateEvents.map<CreateOrUpdate>((event) => ({
    id: event.detail.id,
    name: event.detail.name,
    age: event.detail.age,
    operation: event["detail-type"],
    interests: event.detail.interests,
  }));

const deleteEventsTransformed = createOrUpdateEvents.map<Delete>((event) => ({
  id: event.detail.id,
}));
```

## Target other AWS services like Lambda and other Event Buses

Now that we have created rules on our event buses using `when` and transformed those matched events using `map`, we need to send the events somewhere.

We can `pipe` the transformed events to the lambda functions we defined earlier.

```ts
createOrUpdateEventsTransformed.pipe(createOrUpdateOperation);
deleteEventsTransformed.pipe(deleteOperation);
```

What about our young cat lovers? We want to forward those events to our sister team's event bus for processing.

```ts
const catPeopleBus = functionless.EventBus.fromBus(
  aws_events.EventBus.fromEventBusArn(this, "catTeamBus", catTeamBusArn)
);

// Note: EventBridge does not support transforming events which target other event buses. These events are sent as is.
catPeopleEvents.pipe(catPeopleBus);
```

## Put Events from other sources

Event Bridge Put Events API is one of the methods for putting new events on an event bus. We support some first party integrations between services and event bus.

Support (See [issues](https://github.com/sam-goodwin/functionless/issues?q=is%3Aissue+is%3Aopen+label%3Aevent-bridge) for progress):

- Step Functions
- App Sync (coming soon)
- API Gateway (coming soon)
- More - Please create a new issue in the form `Event Bridge + [Service]`

```ts
bus = new EventBus(stack, "bus");
new StepFunction<{ value: string }, void>((input) => {
  bus({
    detail: {
      value: input.value,
    },
  });
});
```

This will create a step function which sends an event. It is also possible to send multiple events and use other Step Function logic.

> Limit: It is not currently possible to dynamically generate different numbers of events. All events sent must start from objects in the form `{ detail: ..., source: ... }` where all fields are optional.

## Summary

Lets look at the above all together.

```ts
interface UserDetails {
  id?: string;
  name: string;
  age: number;
  interests: string[];
}

interface UserEvent
  extends functionless.EventBusRuleInput<
    UserDetails,
    // We can provide custom detail-types to match on
    "Create" | "Update" | "Delete"
  > {}

interface CreateOrUpdate {
  id?: string;
  name: string;
  age: number;
  operation: "Create" | "Update";
  interests: string[];
}

interface Delete {
  id: string;
}

const createOrUpdateFunction = new functionless.Function<CreateOrUpdate, void>(
  new aws_lambda.Function(this, "createOrUpdate", { ... })
);

const deleteFunction = new functionless.Function<Delete, void>(
  new aws_lambda.Function(this, "delete", { ... })
);

const bus = new functionless.EventBus<UserEvent>(this, "myBus");

// Create and update events are sent to a specific lambda function.
bus
  .when(
    this,
    "createOrUpdateRule",
    (event) =>
      event["detail-type"] === "Create" || event["detail-type"] === "Update"
  )
  .map<CreateOrUpdate>((event) => ({
    id: event.detail.id,
    name: event.detail.name,
    age: event.detail.age,
    operation: event["detail-type"] as "Create" | "Update",
    interests: event.detail.interests,
  }))
  .pipe(createOrUpdateFunction);

// Delete events are sent to a specific lambda function.
bus
  .when(this, "deleteRule", (event) => event["detail-type"] === "Delete")
  .map<Delete>((event) => ({
    id: event.detail.id!,
  }))
  .pipe(deleteFunction);

// New, young users interested in cat are forwarded to our sister team.
bus
  .when(
    this,
    "catLovers",
    (event) =>
      event["detail-type"] === "Create" &&
      event.detail.interests.includes("CATS") &&
      event.detail.age >= 18 &&
      event.detail.age < 30
  )
  .pipe(
    functionless.EventBus<UserEvent>.fromBus(
      aws_events.EventBus.fromEventBusArn(this, "catTeamBus", catBusArn)
    )
  );
```

## Adapt a CDK aws_events.EventBus

Functionless uses a wrapped version of CDK's Event Bus, lets create a CDK event bus first.

```ts
// Create a new Event Bus using CDK.
const bus = new functionless.EventBus(this, "myBus");

// Functionless also supports using the default bus or importing an Event Bus.
const awsBus = functionless.EventBus.fromBus(
  new aws_events.EventBus(this, "awsBus")
);
const defaultBus = functionless.EventBus.fromBus(
  aws_events.EventBus.fromEventBusName(this, "defaultBus", "default")
);
const importedBus = functionless.EventBus.fromBus(
  aws_events.EventBus.fromEventBusArn(this, "defaultBus", arn)
);
```
