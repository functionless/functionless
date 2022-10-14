import {
  App,
  aws_logs,
  aws_stepfunctions,
  SecretValue,
  Stack,
} from "aws-cdk-lib";
import {
  Queue,
  Function,
  EventBus,
  Event,
  StepFunction,
  JsonSecret,
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
const failedOrderQueue = new Queue<OrderPlacedEvent>(
  stack,
  "dead letter queue"
);

// create a queue for processing Order Events
const orderQueue = new Queue<OrderPlacedEvent>(stack, "orders", {
  deadLetterQueue: {
    queue: failedOrderQueue,
    maxReceiveCount: 10,
  },
});

const processedOrderQueue = new Queue<OrderPlacedEvent>(
  stack,
  "processedOrders"
);

// filter OrderEvents from the Event Bus and route them to the orderQueue
events
  .when(
    stack,
    "Messages",
    (event): event is CartEventEnvelope<OrderPlacedEvent> =>
      event["detail-type"] === "OrderPlacedEvent"
  )
  .map((envelope) => envelope.detail)
  .pipe(orderQueue);

const chargeCard = new Function(
  stack,
  "PlaceOrder",
  async (order: OrderPlacedEvent) => {
    console.log("Card Charged! (not)", order);
  }
);

const dispatchOrder = new Function(
  stack,
  "DispatchOrder",
  async (order: OrderPlacedEvent) => {
    console.log("Order Dispatched! (not)", order);
  }
);

// use a Standard Step Function to orchestrate order fulfillment
const processOrder = new StepFunction(
  stack,
  "ProcessOrder",
  async (order: OrderPlacedEvent) => {
    await chargeCard(order);
    await dispatchOrder(order);
    await processedOrderQueue.sendMessage({
      MessageBody: order,
    });
  }
);

// kick off a Step Function to reliably process each order
orderQueue.messages().forEach(async (order) => {
  await processOrder({
    // idempotency on the orderId
    name: order.orderId,
    input: order,
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

processedOrderQueue.messages().forEach((order) => {
  console.log("processed order", order);
});

// new StepFunction(
//   stack,
//   "SendMessageBatch",
//   async (input: { messages: OrderPlacedEvent[] }) => {
//     await orderQueue.sendMessageBatch({
//       Entries: input.messages.map((message, idx) => ({
//         Id: `${idx}`,
//         MessageBody: message,
//       })),
//     });
//   }
// );

// new StepFunction(
//   stack,
//   "SendMessage",
//   async (input: { message: OrderPlacedEvent }) => {
//     await orderQueue.sendMessage({
//       MessageBody: input.message,
//     });
//   }
// );

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

export interface UserPass {
  username: string;
  password: string;
}

const secret = new JsonSecret<UserPass>(stack, "JsonSecret", {
  secretStringValue: SecretValue.unsafePlainText(
    JSON.stringify({
      username: "sam2",
      password: "sam",
    })
  ),
});

new Function(stack, "SecretFunc", async (input: "get" | UserPass) => {
  if (input === "get") {
    return (await secret.getSecretValue()).SecretValue;
  } else {
    const response = await secret.putSecretValue({
      SecretValue: input,
    });
    return response;
  }
});

new JsonSecret<UserPass>(stack, "JsonSecret2", {
  secretStringValue: SecretValue.unsafePlainText(
    JSON.stringify({
      username: "sam",
      password: "sam",
    })
  ),
});
