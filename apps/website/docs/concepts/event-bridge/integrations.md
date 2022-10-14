---
sidebar_position: 5
---

# Integrations

Functionless supports integrations between some AWS services and Event Bridge. Send events to an `EventBus` using the `putEvents` API and send events to other resources using the `.pipe` method.

| Resource       | From `EventBus` | To `EventBus` | To `EventBus`                          |
| -------------- | --------------- | ------------- | -------------------------------------- |
| _via_          | `pipe`          | `putEvents`   | [`$AWS.EventBridge.Invoke`](../aws.md) |
| Lambda         | &#x2705;        | &#x2705;      |                                        |
| Step Functions | &#x2705;        | &#x2705;      |                                        |
| EventBus       | &#x2705;        | &#x2705;      | &#x2705;                               |
| Table          |                 |               |                                        |
| App Sync       |                 | Coming Soon   |                                        |
| API Gateway    |                 | &#x2705;      |                                        |
| Secret         |                 |               |                                        |

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

### Escape Hatches

If a target isn't supported by Functionless, `.pipe` supports [any target supported by EventBridge](https://docs.aws.amazon.com/cdk/api/v2/docs/aws-cdk-lib.aws_events_targets-readme.html).

```ts
const logGroup = new aws_logs.LogGroup(this, "MyLogGroup", {
  logGroupName: "MyLogGroup",
});

// use the pipe callback escape hatch to pipe to a cloudwatch log group (which functionless doesn't natively support, yet)
new EventBus()
  .when("rule1", (event) => event.source === "lambda")
  .map((event) => `log me ${event.id}`)
  .pipe(
    (targetInput) =>
      new targets.CloudWatchLogGroup(logGroup, { event: targetInput })
  );

// or without Functionless's transform
new EventBus()
  .when("rule2", (event) => event.source === "lambda")
  .pipe(() => new targets.CloudWatchLogGroup(logGroup));
```

See [issues](https://github.com/functionless/functionless/issues?q=is%3Aissue+is%3Aopen+label%3Aevent-bridge) for progress or create a new issue in the form `Event Bridge + [Service]`.

## To `EventBus`

### Step Functions

```ts
const bus = new EventBus();
new StepFunction(stack, "sfn", () => {
  await bus.putEvents({
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
new Function(stack, "sfn", async () => {
  bus.putEvents({
    source: "myFunction",
    "detail-type": "someType",
    detail: {},
  });
});
```

### API Gateway

```ts
const api = new RestApi(stack, "api");
const bus = new EventBus();
new AwsMethod(
  {
    httpMethod: "POST",
    resource: api.root,
  },
  ($input: Request) => {
    return bus.putEvents({
      source: "here",
      detail: $input.data,
      "detail-type": "event2",
      resources: ["this api"],
    });
  },
  (result) => {
    return result.data;
  }
);
```

:::caution
Limitation: [Events passed to the bus in a api gateway method must one or more literal objects](../../error-codes.md#expected-an-object-literal), may not use the spread (`...`) syntax, and must not have computed property names.
:::

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
