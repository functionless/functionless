---
title: Queue
sidebar_position: 5.5
---

# Queue

With a `Queue` you can send, store, and receive messages between software components at any volume, without losing messages or requiring other services to be available.

```ts
const queue = new Queue<string>(this, "Queue");
```

## Producer/Consumer Pattern

A common architectural pattern involving a `Queue` is to decouple the Producer of messages from the Consumer so that they can scale independently of each other.

```ts
const queue = new Queue<string>(this, "Queue");

// produce messages
new Function(this, "Producer", async () => {
  await queue.sendMessage({
    Message: "hello",
  });
});

// consume messages
queue.messages().forEach(async (message) => {
  console.log(`${message} world`);
});
```

## Send messages to a Queue

The Producer of the system is responsible for sending messages to the `Queue` where it will be consumed and processed asynchronously. Common producer systems include APIs (REST and GraphQL), Functions (Lambda, Express Step Functions), Workflows (Step Function) and Event Buses.

### Send messages from a Function to a Queue

```ts
new Function(this, "Producer", async (input: { message: string }) => {
  // send messages to SQS
  await queue.sendMessage({
    Message: input.message,
  });
});
```

### Send messages from a Standard Step Function to a Queue

```ts
new StepFunction(this, "Producer", async (input: { message: string }) => {
  await queue.sendMessage({
    Message: input.message,
  });
});
```

### Send messages from an Express Step Function to a Queue

```ts
new ExpressStepFunction(
  this,
  "Producer",
  async (input: { message: string }) => {
    await queue.sendMessage({
      Message: input.message,
    });
  }
);
```

### Send messages from an Appsync GraphQL APIs

```ts
new AppsyncResolver(
  this,
  "Producer",
  {
    type: "Mutation",
    field: "sendMessage",
  },
  async ($context: AppsyncContext<{ message: string }>) => {
    await queue.sendMessage({
      Message: $context.arguments.message,
    });
  }
);
```

### Pipe messages from an Event Bus to a Queue

```ts
import { Event } from "functionless";

// order events include OrderPlaced or OrderCancelled
type OrderEvent = OrderPlaced | OrderCancelled;

// the Event Bus Event payload, where the `detail-type` is `OrderEvent["kind]`, i.e. `"OrderPlaced" | "OrderCancelled"`.
type OrderEventEnvelope<E extends OrderEvent> = Event<E, E["kind"]>;

// an event payload for placed orders
interface OrderPlaced {
  kind: "OrderPlaced";
  orderId: string;
}

// an event payload for cancelled orders
interface OrderCancelled {
  kind: "OrderCancelled";
  orderId: string;
}

// an Event Bus for routing all Order Events
const orderEvents = new EventBus<OrderEventEnvelope>(this, "Bus");

// a Queue to store only OrderPlaced Events for procesing
const orderPlacedQueue = new Queue<OrderPlaced>(this, "Queue");

events
  .when(
    this,
    "OnOrderPlaced",

    // filter out all OrderPlaced events by their detail-type
    (event): event is OrderEventEnvelope<OrderPlaced> =>
      event["detail-type"] === "OrderPlaced"
  )
  // extract only the OrderPlaced payload
  .map((event) => event.detail)
  // forward that to the orderPlacedQueue for procesing
  .pipe(orderPlacedQueue);
```

## Consume messages from a Queue with a Lambda Function

The Consumer processes the messages in the `Queue`, for example the Lambda [Function](./function/index.md) [EventSource](./event-source.md) attached to the `Queue` (below).

```ts
// consume messages with a Lambda Function
queue.messages().forEach(async (name) => {
  console.log(`hello ${name}`);
});
```

If the Consumer fails to process the message and throws an Error, then the message will expire and become available for re-processing by another Consumer of the `Queue`.

```ts
// store a Table of names in DynamoDB
const names = new Table<{ name: string }>(this, "Names", {
  partitionKey: {
    name: "name",
    type: aws_dynamodb.AttributeType.String,
  },
});

queue.messages().forEach(async (name) => {
  const response = await $AWS.DynamoDB.GetItem({
    Key: {
      name: {
        S: name,
      },
    },
  });

  if (response.Item === undefined) {
    // if the name does not exist in the Table, throw an error to retry the message
    throw new Error(`name ${name} does not exist`);
  }
});
```

## Standard Queue

## FIFO Queue

## Process Messages in a Lambda Function with `onEvent`

```ts
const queue = new Queue<string>(this, "Queue");
```

## Fluently process Messages with a Lambda Function
