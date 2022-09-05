import { App, Stack } from "aws-cdk-lib";
import { Queue, Function, EventBus, Event, StepFunction } from "functionless";

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
      Message: order,
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
    Message: message,
    // naive back-off policy for demonstration purposes only
    DelaySeconds: 60,
  });
});

processedOrderQueue.messages().forEach((order) => {
  console.log("processed order", order);
});
