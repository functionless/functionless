import { aws_dynamodb, CfnOutput } from "aws-cdk-lib";
// eslint-disable-next-line import/no-extraneous-dependencies
import { EventBridge, DynamoDB } from "aws-sdk";
import { $AWS, EventBus, Event, StepFunction, Table } from "../src";
import { clientConfig, runtimeTestSuite } from "./runtime";
import { retry } from "./runtime-util";

const EB = new EventBridge(clientConfig);
const DB = new DynamoDB(clientConfig);

runtimeTestSuite("eventBusStack", (testResource) => {
  testResource(
    "Create bus",
    (parent) => {
      // creating a random ID
      const addr = new CfnOutput(parent, "out", { value: "" });
      new EventBus(parent, "bus", {
        eventBusName: addr.node.addr,
      });

      return {
        outputs: {
          bus: addr.node.addr,
        },
      };
    },
    async (context) => {
      await EB.putEvents({
        Entries: [
          {
            EventBusName: context.bus,
          },
        ],
      }).promise();
    }
  );

  testResource(
    "Bus event starts step function and writes to dynamo",
    (parent) => {
      const addr = new CfnOutput(parent, "out", { value: "" });
      const bus = new EventBus<Event<{ id: string }, "test">>(parent, "bus", {
        eventBusName: addr.node.addr,
      });
      const table = Table.fromTable<{ id: string }, "id">(
        new aws_dynamodb.Table(parent, "table", {
          tableName: addr.node.addr + "table",
          partitionKey: {
            name: "id",
            type: aws_dynamodb.AttributeType.STRING,
          },
        })
      );
      const putMachine = new StepFunction<{ id: string }, void>(
        parent,
        "machine",
        async (event) => {
          await $AWS.DynamoDB.PutItem({
            Item: {
              id: { S: event.id },
            },
            Table: table,
          });
        }
      );
      bus
        .when(parent, "rule", (event) => event.source === "test")
        .map((event) => event.detail)
        .pipe(putMachine);

      return {
        outputs: {
          bus: addr.node.addr,
          table: addr.node.addr + "table",
        },
      };
    },
    async (context) => {
      const id = `${context.bus}${Math.floor(Math.random() * 1000000)}`;

      await EB.putEvents({
        Entries: [
          {
            EventBusName: context.bus,
            Source: "test",
            Detail: JSON.stringify({
              id,
            }),
          },
        ],
      }).promise();

      // Give time for the event to make it to dynamo. Localstack is pretty slow.
      // 1 - 1s
      // 2 - 2s
      // 3 - 4s
      // 4 - 8s
      // 5 - 16s
      const item = await retry(
        () =>
          DB.getItem({
            Key: {
              id: { S: id },
            },
            TableName: context.table,
            ConsistentRead: true,
          }).promise(),
        (item) => !!item.Item,
        5,
        10000,
        2
      );

      expect(item.Item).toBeDefined();
    }
  );
});
