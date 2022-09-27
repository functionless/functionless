import "jest";

import {
  aws_dynamodb,
  aws_sqs,
  CfnOutput,
  Duration,
  RemovalPolicy,
} from "aws-cdk-lib";
import { Role } from "aws-cdk-lib/aws-iam";
import { SQSBatchResponse } from "aws-lambda";
import { Construct } from "constructs";
import { v4 } from "uuid";
import {
  EventBus,
  Event,
  Function,
  FunctionProps,
  Queue,
  QueueProps,
  Table,
} from "../src";
import { JsonSerializer } from "../src/serializer";
import {
  RuntimeTestClients,
  runtimeTestExecutionContext,
  runtimeTestSuite,
  TestCase,
} from "./runtime";
import { retry } from "./runtime-util";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever:
    runtimeTestExecutionContext.deployTarget === "LOCALSTACK"
      ? () => ({
          endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
          // endpoint: "http://localhost:4566",
        })
      : undefined,
};

const localstackQueueConfig: QueueProps<any> = {
  lambda:
    runtimeTestExecutionContext.deployTarget === "LOCALSTACK"
      ? {
          queueUrlRetriever: (queueUrl) =>
            process.env.LOCALSTACK_HOSTNAME
              ? queueUrl.replace("localhost", process.env.LOCALSTACK_HOSTNAME)
              : queueUrl,
        }
      : undefined,
};

interface TestQueueBase {
  <
    I extends Record<string, any>,
    // Forces typescript to infer O from the Function and not from the expect argument.
    Outputs extends Record<string, string> = Record<string, string>
  >(
    name: string,
    q: (
      parent: Construct,
      testRole: Role
    ) => Queue<I> | { queue: Queue<I>; outputs: Outputs },
    test: TestCase<Outputs & { queueUrl: string; tableName: string }>["test"]
  ): void;
}

interface TestQueueResource extends TestQueueBase {
  skip: TestQueueBase;
  only: TestQueueBase;
}

runtimeTestSuite<{
  queueUrl: string;
  tableName: string;
  [key: string]: string;
}>("queueStack", (_test, stack) => {
  const table = new Table(stack, "Table", {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.STRING,
    },
    removalPolicy: RemovalPolicy.DESTROY,
  });

  const _testQ: (f: typeof _test | typeof _test.only) => TestQueueBase =
    (f) => (name, q, t) => {
      f(
        name,
        (scope, testRole) => {
          const resource = q(scope, testRole);
          const [queue, outputs] =
            resource instanceof Queue
              ? [resource, {} as any]
              : [resource.queue, resource.outputs];

          queue.resource.grantSendMessages(testRole);
          table.resource.grantReadWriteData(testRole);

          return {
            outputs: {
              queueUrl: queue.queueUrl,
              tableName: table.tableName,
              ...outputs,
            },
          };
        },
        t
      );
    };

  const test = _testQ(_test) as TestQueueResource;

  // eslint-disable-next-line no-only-tests/no-only-tests
  test.only = _testQ(_test.only);

  test.skip = (name, _func, _t) =>
    _test.skip(
      name,
      () => {
        return { outputs: { queueUrl: "", tableName: "" } };
      },
      async () => {},
      { payload: undefined }
    );

  test(
    "onEvent(props, handler)",
    (scope) => {
      interface Message {
        id: string;
      }

      const queue = new Queue<Message>(scope, "queue", localstackQueueConfig);

      queue.onEvent(localstackClientConfig, async (event) => {
        await Promise.all(
          event.Records.map(async (record) => {
            const json = JSON.parse(record.body);
            await table.attributes.put({
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
      return queue;
    },
    assertForEach
  );

  test(
    "onEvent(id, props, handler)",
    (scope) => {
      const queue = new Queue(scope, "queue", localstackQueueConfig);

      queue.onEvent("id", localstackClientConfig, async (event) => {
        await Promise.all(
          event.Records.map(async (record) => {
            const json = JSON.parse(record.body);
            await table.attributes.put({
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
      return queue;
    },
    assertForEach
  );

  test(
    "onEvent with JsonSerializer",
    (scope) => {
      interface Message {
        id: string;
        data: string;
      }

      const queue = new Queue<Message>(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
      });

      queue.onEvent(localstackClientConfig, async (event) => {
        await Promise.all(
          event.Records.map(async (record) => {
            await table.put({
              Item: record.message,
            });
          })
        );

        return <SQSBatchResponse>{
          batchItemFailures: [],
        };
      });
      return queue;
    },
    assertForEach
  );

  test(
    "forEach with JsonSerializer",
    (scope) => {
      interface Message {
        id: string;
        data: string;
      }

      const queue = new Queue(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
      });

      queue.messages().forEach(localstackClientConfig, async (message) => {
        await table.put({
          Item: message,
        });
      });
      return queue;
    },
    assertForEach
  );

  test(
    "forEach event bus target",
    (scope, testRole) => {
      interface Message {
        id: string;
        data: string;
      }

      const addr = new CfnOutput(scope, "out", { value: "" });
      const bus = new EventBus<Event<Message>>(scope, "bus", {
        eventBusName: addr.node.addr,
      });

      bus.resource.grantPutEventsTo(testRole);

      const queue = new Queue<Message>(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
      });

      bus
        .all()
        .map((event) => event.detail)
        .pipe(queue);

      queue.messages().forEach(localstackClientConfig, async (message) => {
        await table.put({
          Item: message,
        });
      });
      return {
        queue,
        outputs: {
          busName: addr.node.addr,
        },
      };
    },
    assertForEach
  );

  test(
    "forEach event bus target fifo",
    (scope, testRole) => {
      interface Message {
        id: string;
        data: string;
      }

      const addr = new CfnOutput(scope, "out", { value: "" });
      const bus = new EventBus<Event<Message>>(scope, "bus", {
        eventBusName: addr.node.addr,
      });

      bus.resource.grantPutEventsTo(testRole);

      const queue = new Queue<Message>(scope, "queue", {
        ...localstackQueueConfig,
        serializer: new JsonSerializer<Message>(),
        fifo: true,
        fifoThroughputLimit: aws_sqs.FifoThroughputLimit.PER_MESSAGE_GROUP_ID,
        contentBasedDeduplication: true,
        deduplicationScope: aws_sqs.DeduplicationScope.MESSAGE_GROUP,
      });

      bus
        .all()
        .map((event) => event.detail)
        /**
         * This value is a fixed string - there is currently no support to make this dependent on a value in the incoming event,
         * which means all your messages will be in the same message group.
         */
        .pipe(queue, { messageGroupId: "busGroup" });

      queue
        .messages()
        .forEach(
          localstackClientConfig,
          async (message, { attributes: { MessageGroupId } }) => {
            await table.attributes.put({
              Item: {
                id: {
                  S: message.id,
                },
                data: {
                  S: message.data,
                },
                messageGroupId: { S: MessageGroupId ?? "" },
              },
            });
          }
        );
      return {
        queue,
        outputs: {
          busName: addr.node.addr,
          messageGroupId: "busGroup",
        },
      };
    },
    assertForEach
  );

  test(
    "map, filter, flatMap, forEach with JsonSerializer",
    (scope) => {
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
          await table.put({
            Item: message,
          });
        });
      return queue;
    },
    assertForEach
  );

  test(
    "map, filter, flatMap, forEachBatch with JsonSerializer",
    (scope) => {
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
              await table.put({
                Item: message,
              });
            })
          );
        });
      return queue;
    },
    assertForEach
  );

  test(
    "send and receive messages",
    (scope, role) => {
      interface Message {
        id: string;
        data: string;
      }
      const queue = new Queue<Message>(scope, "queue", {
        ...localstackQueueConfig,
        fifo: true,
        fifoThroughputLimit: aws_sqs.FifoThroughputLimit.PER_MESSAGE_GROUP_ID,
        deduplicationScope: aws_sqs.DeduplicationScope.MESSAGE_GROUP,
      });

      const send = new Function(
        scope,
        "send",
        localstackClientConfig,
        async (id: string) => {
          await queue.sendMessage({
            MessageBody: {
              id,
              data: "data",
            },
            MessageGroupId: "messages",
            MessageDeduplicationId: id,
          });
        }
      );

      const sendBatch = new Function(
        scope,
        "sendBatch",
        localstackClientConfig,
        async () => {
          const response = await queue.sendMessageBatch({
            Entries: [
              {
                Id: "1",

                MessageBody: {
                  id: "id-1",
                  data: "data-1",
                },
                MessageGroupId: "messages",
                MessageDeduplicationId: "id-1",
              },
              {
                Id: "2",
                MessageBody: {
                  id: "id-2",
                  data: "data-2",
                },
                MessageGroupId: "messages",
                MessageDeduplicationId: "id-2",
              },
            ],
          });

          if (response.Failed.length > 0) {
            // re-try failed messages
          }
        }
      );

      const receive = new Function(
        scope,
        "receive",
        localstackClientConfig,
        async () => {
          return queue.receiveMessage({
            WaitTimeSeconds: 10,
            VisibilityTimeout: 60,
          });
        }
      );

      send.resource.grantInvoke(role);
      sendBatch.resource.grantInvoke(role);
      receive.resource.grantInvoke(role);

      return {
        queue,
        outputs: {
          send: send.resource.functionName,
          sendBatch: sendBatch.resource.functionName,
          receive: receive.resource.functionName,
        },
      };
    },
    async (context, clients) => {
      await clients.lambda
        .invoke({
          FunctionName: context.send,
          Payload: '"id"',
        })
        .promise();

      await clients.lambda
        .invoke({
          FunctionName: context.sendBatch,
          Payload: '"id"',
        })
        .promise();

      const response = await clients.lambda
        .invoke({
          FunctionName: context.receive,
          Payload: "{}",
        })
        .promise();

      expect(response.FunctionError).toBeUndefined();
      expect(
        JSON.parse(String(response.Payload)).Messages[0].Message
      ).toMatchObject({
        data: "data",
        id: "id",
      });
    }
  );

  if (runtimeTestExecutionContext.deployTarget === "LOCALSTACK") {
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
      (scope, role) => {
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
              MessageBody: {
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

        send.resource.grantInvoke(role);
        receive.resource.grantInvoke(role);

        return {
          queue,
          outputs: {
            send: send.resource.functionName,
            receive: receive.resource.functionName,
          },
        };
      },
      async (context, clients) => {
        const sendResponse = await clients.lambda
          .invoke({
            FunctionName: context.send,
            Payload: '"id"',
          })
          .promise();

        expect(sendResponse.FunctionError).toEqual("Unhandled");
        expect(sendResponse.Payload).toContain("localhost");

        const receiveResponse = await clients.lambda
          .invoke({
            FunctionName: context.receive,
            Payload: "{}",
          })
          .promise();

        expect(receiveResponse.FunctionError).toEqual("Unhandled");
        expect(receiveResponse.Payload).toContain("localhost");
      }
    );
  }
});

async function assertForEach(
  context: {
    tableName: string;
    queueUrl: string;
    busName?: string;
    messageGroupId?: string;
  },
  clients: RuntimeTestClients
) {
  const message = {
    id: v4(),
    data: "hello world",
  };
  const messageJSON = JSON.stringify(message);

  if (context.busName) {
    await clients.eventBridge
      .putEvents({
        Entries: [
          {
            Source: "test",
            DetailType: "test",
            Detail: JSON.stringify(message),
            EventBusName: context.busName,
          },
        ],
      })
      .promise();
  } else {
    await clients.sqs
      .sendMessage({
        MessageBody: messageJSON,
        QueueUrl: context.queueUrl,
      })
      .promise();
  }

  await retry(
    async () =>
      clients.dynamoDB
        .getItem({
          TableName: context.tableName,
          Key: {
            id: {
              S: message.id,
            },
          },
        })
        .promise(),
    (result) =>
      result.Item?.data?.S === message.data &&
      (!context.messageGroupId ||
        context.messageGroupId === result.Item?.messageGroupId?.S),
    5,
    1000,
    2
  );
}
