---
title: Queue
sidebar_position: 5.5
---

# Queue

With a `Queue` you can send, store, and receive messages between software components at any volume, without losing messages or requiring other services to be available.

## Create a Queue

```ts
const queue = new Queue<string>(this, "Queue");
```

## Create a FIFO Queue

```ts
const queue = new Queue<string>(this, "Queue", {
  fifo: true,
});
```

## Producer-Consumer Pattern

A common architectural pattern involving a `Queue` is to decouple the Producer of messages from the Consumer so that they can scale independently of each other.

```ts
const queue = new Queue<string>(this, "Queue");

// produce messages
new Function(this, "Producer", async () => {
  await queue.sendMessage({
    MessageBody: "hello",
  });
});

// consume messages
queue.messages().forEach(async (message) => {
  console.log(`${message} world`);
});
```

## Produce Messages

The Producer of the system is responsible for sending messages to the `Queue` where it will be consumed and processed asynchronously. Common producer systems include APIs (REST and GraphQL), Functions (Lambda, Express Step Functions), Workflows (Step Function) and Event Buses.

### Send messages from a Function

```ts
new Function(this, "Producer", async (input: { message: string }) => {
  // send messages to SQS
  await queue.sendMessage({
    MessageBody: input.message,
  });
});
```

### Send messages from a Standard Step Function

```ts
new StepFunction(this, "Producer", async (input: { message: string }) => {
  await queue.sendMessage({
    MessageBody: input.message,
  });
});
```

### Send messages from an Express Step Function

```ts
new ExpressStepFunction(
  this,
  "Producer",
  async (input: { message: string }) => {
    await queue.sendMessage({
      MessageBody: input.message,
    });
  }
);
```

### Send messages from an Appsync GraphQL API

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
      MessageBody: $context.arguments.message,
    });
  }
);
```

### Pipe messages from an Event Bus

```ts
import { Event } from "@functionless/aws-constructs";

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

## Consume Messages

### With a Lambda Function `onEvent` handler

The `onEvent` method will create a new Lambda [Function](./function/index.md) and attach it to the `Queue`. Your Function will be called with a [`SQSEvent`](../api/aws-sqs-constructs/interfaces/SQSEvent.md) containing the messages to be processed.

```ts
import { SQSBatchItemFailure } from "aws-lambda";

const numbers = new Queue<number>(this, "Queue");

const numbersConsumer = numbers.onEvent(async (event) => {
  for (const record of event.Records) {
    // the raw String body of the message
    console.log(record.body);

    // the parsed message - in this case a number
    console.log(record.message);
  }
});
```

By default, if your Function throws an error, then all of the messages in the `event` payload will be re-driven by the SQS service until considered "dead" upon which they will be moved to the dead letter queue (if configured).

### Handle failures with `deadLetterQueue` and `maxReceiveCount`

You can configure the dead letter queue and the maximum number of times a message should be processed before considered "dead" by specifying the props when creating the Queue.

```ts
const deadMessages = new Queue<number>(this, "DLQ");

const liveMessages = new Queue<number>(this, "Queue", {
  deadLetterQueue: {
    queue: deadMessages,
    // attempt to process messages 10 times before moving them to the dead letter queue
    maxReceiveCount: 10,
  },
});
```

### Enable `reportBatchItemFailures` for precise error handling

The aforementioned behavior where all messages in the `event` are re-tried if the Function throws an error is sub-optimal in cases where some messages were processed successfully. To avoid re-driving successful messages, enable `reportBatchItemFailures`.

Now, your Function must return an object containing a list of all the message IDs that failed to be processed so that they can be retried or moved to the Queue's dead letter queue (if configured).

Any messages whose ID is not returned in the array will be considered successfully processed and removed from the Queue.

```ts
import { SQSBatchItemFailure } from "aws-lambda";

const numbers = new Queue<number>(this, "Queue");

const numbersConsumer = numbers.onEvent(
  {
    reportBatchItemFailures: true,
  },
  async (event) => {
    const failedRecords: SQSBatchItemFailure[] = event.Records.flatMap(
      (record) => {
        if (record.message % 2 === 0) {
          // for fun - we'll fail all of the even numbered messages
          return [
            {
              itemIdentifier: record.messageId,
            },
          ];
        }
        return [];
      }
    );

    return {
      // signal to the SQS queue which messages failed and should be retried
      batchItemFailures: failedRecords,
    };
  }
);
```

### Tune performance with `batchSize` and `maxBatchingWindow`

Depending on your use-case, you can change the default values of `batchSize` and `maxBatchingWindow`.

The `batchSize` must be between 1 and 10 and has a default value of 10. It controls the number of messages that will be in a single batch.

The `maxBatchingWindow` controls how long the Event Source will wait for a batch of size `batchSize` before invoking your Function. For example, with a `batchSize: 10` and `maxBatchingWindow: 1 minute`, if 5 messages are received after waiting for a minute, then the messages will be processed even though 5 is less than the `batchSize` of 10.

```ts
queue.onEvent(
  {
    // process 2 messages at a time
    batchSize: 2,
    // wait for up to a minute for 2 messages to arrive before processing the batch
    maxBatchingWindow: Duration.minutes(1),
  },
  async (event) => {
    // guaranteed to be at most two Records in the batc
    const [first, second] = event.Records;
  }
);
```

## Fluent `Iterator` API for consuming messages - `map`, `flatMap`, `filter`, `forEach`

Instead of using the low-level `onEvent` handler interface, you can use a fluent-API with best practices for error handling built in. The interface closely matches what you'd expect when working with Arrays, for example `map`, `flatMap`, `filter` and `forEach`, with some optimizations specific to processing messages in the cloud.

### Iterator

This interface is called an `Iterator`. To acquire an `Iterator` for the `Queue`, call the `messages()` method.

```ts
const queue = new Queue<number>(this, "Queue");

const it = queue.messages();
```

You may then chain calls to `map`, `flatMap`, `filter` and `forEach` to transform, filter and finally processes each of the messages.

```ts
it.map((message) => message * 2)
  .filter((message) => message > 10)
  .forEach((message) => {
    console.log(message);
  });
```

### Asynchronous and Synchronous Processing

Each of the `map`, `flatMap`, `filter` and `forEach` methods have both an asynchronous and synchronous interface. You can choose them interchangeably.

```ts
it.map((message) => {
  // synchronously process the message
  return message * 2;
}).map(async (message) => {
  // or asynchronously
  return await myLambdaFunction(message);
});
```

### Error Handling

The `Iterator` automatically keeps track of which message is being processed and handles errors accordingly. If a message fails to process, then it will be reported as failed and re-driven according to the Queue's re-drive policy.

```ts
// consume messages with a Lambda Function
queue.messages().forEach(async (name) => {
  console.log(`hello ${name}`);
});
```

If the Consumer fails to process the message and throws an Error, then the message will expire and become available for re-processing by another Consumer of the `Queue`.

```ts
queue.messages().forEach(async (name) => {
  if (response.Item === undefined) {
    // if the name does not exist in the Table, throw an error to retry the message
    throw new Error(`name ${name} does not exist`);
  }
});
```

:::caution
All items associated with a received Message in an Iterator must be successfully processed in order for the Message to be considered safe to remove from the Queue. If any fail, the entire message will be re-driven.

This can be problematic when using `flatMap` because you can run into a case where multiple items in the Iterator are associated with same source Record received from the Queue.

```ts
queue
  .messages()
  // flat map each message to an array of two items
  .flatMap((message) => [1, 2])
  .forEach(async (item) => {
    if (item === 1) {
      // here we throw an error when the item is 1 (but not when 2)
      throw new Error("1 is bad");
    } else {
      // this side effect will happen twice because the item `1` failed
      // and is originates from the same source message
      await $AWS.DynamoDB.PutItem({
        Table,
        Item: {
          num: {
            N: `${item}`,
          },
        },
      });
    }
  });
```

:::

### Lazy Processing

The `map`, `flatMap` and `filter` operations are considered "lazy", meaning that no computation will happen until a final `forEach` is called. Only then will the Lambda Function be created with the Event Source attached.

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
