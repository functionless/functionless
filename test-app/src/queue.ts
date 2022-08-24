import { App, Stack } from "aws-cdk-lib";
import { JsonSerializer, Queue, Function } from "functionless";

const app = new App();
const stack = new Stack(app, "queue");

interface Message {
  id: string;
  data: string;
}

const queue = new Queue<Message>(stack, "queue", {
  serializer: new JsonSerializer(),
});

new Function(stack, "send", async (id: string) => {
  await queue.sendMessage({
    Message: {
      id,
      data: "data",
    },
  });
});

new Function(stack, "receive", async () => {
  return queue.receiveMessage({
    WaitTimeSeconds: 10,
  });
});
