import { App, aws_dynamodb, Stack } from "aws-cdk-lib";
import { Table, Queue, JsonSerializer } from "@functionless/aws-lib-constructs";

const app = new App();
const stack = new Stack(app, "StreamProcessing");

const table = new Table<Message, "id">(stack, "Table", {
  partitionKey: {
    name: "id",
    type: aws_dynamodb.AttributeType.STRING,
  },
});

interface Message {
  id: string;
  data: string;
}

const queue = new Queue(stack, "queue", {
  serializer: new JsonSerializer<Message>(),
});

queue.messages().forEach(async (message) => {
  await table.put({
    Item: {
      id: message.id,
      data: message.data,
    },
  });
});
