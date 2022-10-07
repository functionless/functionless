import { App, aws_logs, aws_stepfunctions, Stack } from "aws-cdk-lib";
import {
  Queue,
  Function,
  EventBus,
  Event,
  StepFunction,
  Serializer,
} from "@functionless/aws-constructs";

const app = new App();
const stack = new Stack(app, "queue");

type CartEventEnvelope<E extends CartEvent = CartEvent> = Event<E, E["kind"]>;
type CartEvent = OrderPlacedEvent | OrderCancelledEvent;

interface OrderPlacedEvent {
  kind: "OrderPlacedEvent";
  orderId: string;
}
interface OrderCancelledEvent {
  kind: "OrderCancelledEvent";
  orderId: string;
}

// set up an EventBus containing all of our cart events
const events = new EventBus<CartEventEnvelope>(stack, "Events");

// create a queue to store failed Order Events
const failedOrderQueue = new Queue(stack, "dead letter queue", {
  serializer: Serializer.text(),
});

// create a queue for processing Order Events
const orderQueue = new Queue(stack, "orders", {
  serializer: Serializer.text(),
  deadLetterQueue: {
    queue: failedOrderQueue,
    maxReceiveCount: 10,
  },
});

const processedOrderQueue = new Queue(stack, "processedOrders", {
  serializer: Serializer.text(),
});

// filter OrderEvents from the Event Bus and route them to the orderQueue
events
  .when(
    stack,
    "Messages",
    (event): event is CartEventEnvelope<OrderPlacedEvent> =>
      event["detail-type"] === "OrderPlacedEvent"
  )
  .map((envelope) => envelope.detail.orderId)
  .pipe(orderQueue);

const chargeCard = new Function(
  stack,
  "PlaceOrder",
  async (orderId: string) => {
    console.log("Card Charged! (not)", orderId);
  }
);

const dispatchOrder = new Function(
  stack,
  "DispatchOrder",
  async (order: string) => {
    console.log("Order Dispatched! (not)", order);
  }
);

// use a Standard Step Function to orchestrate order fulfillment
const processOrder = new StepFunction(
  stack,
  "ProcessOrder",
  async (input: { orderId: string }) => {
    await chargeCard(input.orderId);
    await dispatchOrder(input.orderId);
    await processedOrderQueue.sendMessage({
      MessageBody: input.orderId,
    });
  }
);

// kick off a Step Function to reliably process each order
orderQueue.messages().forEach(async (orderId) => {
  await processOrder({
    // idempotency on the orderId
    name: orderId,
    input: {
      orderId,
    },
  });
});

// process all failed Order Events and re-send them for re-processing
failedOrderQueue.messages().forEach(async (message) => {
  await orderQueue.sendMessage({
    MessageBody: message,
    // naive back-off policy for demonstration purposes only
    DelaySeconds: 60,
  });
});

// processedOrderQueue.messages().forEach((order) => {
//   console.log("processed order", order);
// });

new StepFunction(
  stack,
  "SendMessageBatch",
  async (input: { messages: string[] }) => {
    await orderQueue.sendMessageBatch({
      Entries: input.messages.map((message, idx) => ({
        Id: `${idx}`,
        MessageBody: message,
      })),
    });
  }
);

new StepFunction(stack, "SendMessage", async (input: { message: string }) => {
  await orderQueue.sendMessage({
    MessageBody: input.message,
  });
});

// TODO: implement retry logic once new intrinsics arrive
// @see https://github.com/functionless/functionless/pull/468
// new ExpressStepFunction(
//   stack,
//   "SendMessageBatch",
//   async (input: { messages: OrderPlacedEvent[] }) => {
//     let response = await orderQueue.sendMessageBatch({
//       Entries: input.messages.map((message, idx) => ({
//         Id: `${idx}`,
//         MessageBody: message,
//       })),
//     });
//     let attempt = 0;
//     while (attempt < 10 && response.Failed.length > 0) {
//       attempt += 1;
//       response = await orderQueue.sendMessageBatch({
//         Entries: response.Failed.map((failed) => ({
//           Id: failed.Id,
//           MessageBody: input.messages[Number(failed.Id)],
//         })),
//       });
//     }
//     if (response.Failed.length > 0) {
//       throw new Error(`failed to send messages after 10 attempts`);
//     }
//   }
// );

new StepFunction(
  stack,
  "ReceiveMessage",
  {
    logs: {
      destination: new aws_logs.LogGroup(stack, "ReceiveMessageLogs"),
      level: aws_stepfunctions.LogLevel.ALL,
    },
  },
  async (input: { maxMessages: number | null }) => {
    return processedOrderQueue.receiveMessage({
      MaxNumberOfMessages: input.maxMessages ?? 10,
    });
  }
);
