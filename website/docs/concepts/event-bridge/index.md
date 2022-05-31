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

## What is AWS Event Bridge?

[AWS Event Bridge](https://aws.amazon.com/eventbridge/) is a fully managed pub-sub service capable of ingesting an arbitrary number of events from upstream services, (optionally) filtering and transforming them, before (finally) forwarding them to downstream services. Event Bridge enables the development of more scalable systems by de-coupling the producer of an event from its consumers(s). It is a highly managed service, capable of arbitrary scale and is configured declaratively with pure JSON documents - so there is no runtime code for the developer to maintain.

## How it works

An instance of an [`EventBus`](./event-bus.md) ingest events and routes them to downstream integrations according to Rules created by the user. Events are sent to downstream services such as Lambda Functions, Step Functions, or a third party (non-AWS) API. Sources of events include other AWS Resources or third party (non-AWS) SaaS products, e.g. a Slack webhook.

## Declare an Event Type

Functionless supports well typed events, lets define our event schema with Typescript.

```ts
interface UserDetails {
  id?: string;
  name: string;
  age: number;
  interests: string[];
}

interface UserEvent
  extends functionless.EventBusEvent<
    UserDetails,
    // We can provide custom detail-types to match on
    "Create" | "Update" | "Delete"
  > {}
```

## Create a Rule

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

Rules can be further refined by calling `when` on a Functionless `Rule`.

```ts
// Cat people who are between 18 and 30 and do not also like dogs.
catPeopleEvents.when((event) => !event.detail.interests.includes("DOGS"));
```

## Transform the event before sending to some services like `Lambda` Functions.

We have two lambda functions to invoke, one for create or updates and another for deletes, lets make those.

```ts
const createOrUpdateFunction = new Function(this, 'createOrUpdate', ...);
const deleteFunction = new Function(this, 'delete', ...);
```

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
createOrUpdateEventsTransformed.pipe(createOrUpdateFunction);
deleteEventsTransformed.pipe(deleteFunction);
```

What about our young cat lovers? We want to forward those events to our sister team's event bus for processing.

```ts
const catPeopleBus = functionless.EventBus.fromBus(
  aws_events.EventBus.fromEventBusArn(this, "catTeamBus", catTeamBusArn)
);

// Note: EventBridge does not support transforming events which target other event buses. These events are sent as is.
catPeopleEvents.pipe(catPeopleBus);
```

## Putting it all together.

Lets look at the above all together.

```ts
interface UserDetails {
  id?: string;
  name: string;
  age: number;
  interests: string[];
}

interface UserEvent
  extends functionless.EventBusEvent<
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

const createOrUpdateFunction = new functionless.Function<CreateOrUpdate, void>(this, "createOrUpdate", { ... });

const deleteFunction = new functionless.Function<Delete, void>(new aws_lambda.Function(this, "delete", { ... });

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

## Put Events from other sources

Functionless supports integrations between some AWS services and Event Bridge using the PutEvents API.

Supported:

- Step Functions
- App Sync (coming soon)
- API Gateway (coming soon)
- See [issues](https://github.com/functionless/functionless/issues?q=is%3Aissue+is%3Aopen+label%3Aevent-bridge) for progress or create a new issue in the form `Event Bridge + [Service]`.

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

This will create a step function which sends an event. It is also possible to send multiple events and use other Step Function logic.

:::caution
Limitation: [Events passed to the bus in a step function must one or more literal objects](./integrations#Events_passed-to_the_bus_in_a_step_function_must_literal_objects) and may not use the spread (`...`) syntax.
:::
