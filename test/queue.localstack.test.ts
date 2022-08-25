import "jest";

import { aws_dynamodb, Duration } from "aws-cdk-lib";
import { SQSBatchResponse } from "aws-lambda";
import { v4 } from "uuid";
import {
  $AWS,
  Function,
  FunctionProps,
  Queue,
  QueueProps,
  Table,
} from "../src";
import { JsonSerializer } from "../src/serializer";
import { localstackTestSuite } from "./localstack";
import { localDynamoDB, localLambda, localSQS, retry } from "./runtime-util";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever: () => ({
    endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
    // endpoint: "http://localhost:4566",
  }),
};

const localstackQueueConfig: QueueProps<any> = {
  lambda: {
    queueUrlRetriever: (queueUrl) =>
      process.env.LOCALSTACK_HOSTNAME
        ? queueUrl.replace("localhost", process.env.LOCALSTACK_HOSTNAME)
        : queueUrl,
  },
};

localstackTestSuite("queueStack", (test) => {
  test(
    "onEvent(props, handler)",
    (scope) => {
      const table = new Table(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });
      const queue = new Queue(scope, "queue", localstackQueueConfig);

      queue.onEvent(localstackClientConfig, async (event) => {
        await Promise.all(
          event.Records.map(async (record) => {
            const json = JSON.parse(record.body);
            await $AWS.DynamoDB.PutItem({
              Table: table,
              Item: {
                id: {
                  S: json.id,
                },
                data: {
                  S: json.data,
                },
              },
            });
          })
        );

        return <SQSBatchResponse>{
          batchItemFailures: [],
        };
      });
      return {
        outputs: {
          tableName: table.tableName,
          queueUrl: queue.queueUrl,
        },
      };
    },
    assertForEach
  );

  test(
    "onEvent(id, props, handler)",
    (scope) => {
      const table = new Table(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });
      const queue = new Queue(scope, "queue", localstackQueueConfig);

      queue.onEvent("id", localstackClientConfig, async (event) => {
        await Promise.all(
          event.Records.map(async (record) => {
            const json = JSON.parse(record.body);
            await $AWS.DynamoDB.PutItem({
              Table: table,
              Item: {
                id: {
                  S: json.id,
                },
                data: {
                  S: json.data,
                },
              },
            });
          })
        );

        return <SQSBatchResponse>{
          batchItemFailures: [],
        };
      });
      return {
        outputs: {
          tableName: table.tableName,
          queueUrl: queue.queueUrl,
        },
      };
    },
    assertForEach
  );

  test(
    "onEvent with JsonSerializer",
    (scope) => {
      const table = new Table(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      interface Message {
        id: string;
        data: string;
      }

      const queue = new Queue(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
      });

      queue.onEvent(localstackClientConfig, async (event) => {
        await Promise.all(
          event.Records.map(async (record) => {
            await $AWS.DynamoDB.PutItem({
              Table: table,
              Item: {
                id: {
                  S: record.message.id,
                },
                data: {
                  S: record.message.data,
                },
              },
            });
          })
        );

        return <SQSBatchResponse>{
          batchItemFailures: [],
        };
      });
      return {
        outputs: {
          tableName: table.tableName,
          queueUrl: queue.queueUrl,
        },
      };
    },
    assertForEach
  );

  test(
    "forEach with JsonSerializer",
    (scope) => {
      const table = new Table<Message, "id">(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      interface Message {
        id: string;
        data: string;
      }

      const queue = new Queue(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
      });

      queue.messages().forEach(localstackClientConfig, async (message) => {
        await $AWS.DynamoDB.PutItem({
          Table: table,
          Item: {
            id: {
              S: message.id,
            },
            data: {
              S: message.data,
            },
          },
        });
      });
      return {
        outputs: {
          tableName: table.tableName,
          queueUrl: queue.queueUrl,
        },
      };
    },
    assertForEach
  );

  test(
    "map, filter, flatMap, forEach with JsonSerializer",
    (scope) => {
      const table = new Table<Message, "id">(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      interface Message {
        id: string;
        data: string;
      }

      const queue = new Queue(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
      });

      queue
        .messages()
        .map((message) => message)
        .map(async (message) => message)
        .filter((message) => message === message)
        .filter(async (message) => message === message)
        .flatMap((message) => [message])
        .flatMap(async (message) => [message])
        .forEach(localstackClientConfig, async (message) => {
          await $AWS.DynamoDB.PutItem({
            Table: table,
            Item: {
              id: {
                S: message.id,
              },
              data: {
                S: message.data,
              },
            },
          });
        });
      return {
        outputs: {
          tableName: table.tableName,
          queueUrl: queue.queueUrl,
        },
      };
    },
    assertForEach
  );

  test(
    "map, filter, flatMap, forEachBatch with JsonSerializer",
    (scope) => {
      const table = new Table<Message, "id">(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      interface Message {
        id: string;
        data: string;
      }

      const queue = new Queue(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
      });

      queue
        .messages()
        .map((message) => message)
        .map(async (message) => message)
        .filter((message) => message === message)
        .filter(async (message) => message === message)
        .flatMap((message) => [message])
        .flatMap(async (message) => [message])
        .forEachBatch(localstackClientConfig, async (messages) => {
          await Promise.all(
            messages.map(async (message) => {
              await $AWS.DynamoDB.PutItem({
                Table: table,
                Item: {
                  id: {
                    S: message.id,
                  },
                  data: {
                    S: message.data,
                  },
                },
              });
            })
          );
        });
      return {
        outputs: {
          tableName: table.tableName,
          queueUrl: queue.queueUrl,
        },
      };
    },
    assertForEach
  );

  // skip because localstack is being dumb - has been tested in the cloud
  test(
    "send and receive messages",
    (scope) => {
      interface Message {
        id: string;
        data: string;
      }
      const queue = new Queue<Message>(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer(),
      });

      const send = new Function(
        scope,
        "send",
        localstackClientConfig,
        async (id: string) => {
          await queue.sendMessage({
            Message: {
              id,
              data: "data",
            },
          });
        }
      );

      const receive = new Function(
        scope,
        "receive",
        localstackClientConfig,
        async () => {
          return queue.receiveMessage({
            WaitTimeSeconds: 10,
          });
        }
      );

      return {
        outputs: {
          send: send.resource.functionName,
          receive: receive.resource.functionName,
        },
      };
    },
    async (context) => {
      await localLambda
        .invoke({
          FunctionName: context.send,
          Payload: '"id"',
        })
        .promise();

      const response = await localLambda
        .invoke({
          FunctionName: context.receive,
          Payload: "{}",
        })
        .promise();

      expect(response.Payload).toContain('{"data":"data","id":"id"}');
    }
  );

  /**
   * Localstack queue urls are different in CDK which use localhost as the domain and in
   * the lambda which use the lambda's localstack hostname as the domain
   *
   * This test does not mutate the queue URL (unlike the others) to show the workflow working as expected
   * until we try to interact with the queue SDK.
   *
   * also serves to alert us if the localstack behavior changes.
   */
  test(
    "send and receive messages fail with incorrect localstack queueurl",
    (scope) => {
      interface Message {
        id: string;
        data: string;
      }
      const queue = new Queue<Message>(scope, "queue", {
        serializer: new JsonSerializer(),
      });

      const send = new Function(
        scope,
        "send",
        localstackClientConfig,
        async (id: string) => {
          return queue.sendMessage({
            Message: {
              id,
              data: "data",
            },
          });
        }
      );

      const receive = new Function(
        scope,
        "receive",
        localstackClientConfig,
        async () => {
          return queue.receiveMessage({
            WaitTimeSeconds: 10,
          });
        }
      );

      return {
        outputs: {
          send: send.resource.functionName,
          receive: receive.resource.functionName,
        },
      };
    },
    async (context) => {
      const sendResponse = await localLambda
        .invoke({
          FunctionName: context.send,
          Payload: '"id"',
        })
        .promise();

      expect(sendResponse.FunctionError).toEqual("Unhandled");
      expect(sendResponse.Payload).toContain("localhost");

      const recieveResponse = await localLambda
        .invoke({
          FunctionName: context.receive,
          Payload: "{}",
        })
        .promise();

      expect(recieveResponse.FunctionError).toEqual("Unhandled");
      expect(recieveResponse.Payload).toContain("localhost");
    }
  );
});

async function assertForEach(context: { tableName: string; queueUrl: string }) {
  const message = {
    id: v4(),
    data: "hello world",
  };
  const messageJSON = JSON.stringify(message);
  await localSQS
    .sendMessage({
      MessageBody: messageJSON,
      QueueUrl: context.queueUrl,
    })
    .promise();

  await retry(
    async () =>
      localDynamoDB
        .getItem({
          TableName: context.tableName,
          Key: {
            id: {
              S: message.id,
            },
          },
        })
        .promise(),
    (result) => result.Item?.data?.S === message.data,
    5,
    1000,
    2
  );
}
