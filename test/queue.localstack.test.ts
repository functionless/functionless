import "jest";

import { aws_dynamodb, Duration } from "aws-cdk-lib";
import { SQSBatchResponse } from "aws-lambda";
import { v4 } from "uuid";
import { $AWS, FunctionProps, TextQueue, Table } from "../src";
import { localstackTestSuite } from "./localstack";
import { localDynamoDB, localSQS, retry } from "./runtime-util";

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever: () => ({
    endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
  }),
};

localstackTestSuite("queueStack", (test) => {
  test(
    "forEach queue message (props, handler)",
    (scope) => {
      const table = new Table(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });
      const queue = new TextQueue(scope, "queue");

      queue.forEach(localstackClientConfig, async (event) => {
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
    "forEach queue message (id, props, handler)",
    (scope) => {
      const table = new Table(scope, "Table", {
        partitionKey: {
          name: "id",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });
      const queue = new TextQueue(scope, "queue");

      queue.forEach("id", localstackClientConfig, async (event) => {
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
    10,
    1000,
    2
  );
}
