import { App, aws_dynamodb, CfnOutput, Stack } from "aws-cdk-lib";
import { clientConfig, deployStack } from "./localstack";
import { $AWS, EventBus, EventBusRuleInput, StepFunction, Table } from "../src";
import { EventBridge, DynamoDB } from "aws-sdk";
import { Construct } from "constructs";

jest.setTimeout(500000);

const EB = new EventBridge(clientConfig);
const DB = new DynamoDB(clientConfig);
let stack: Stack;
let app: App;

const tests: ResourceTest[] = [];
// will be set in the before all
let testContexts: any[];

// Inspiration: https://github.com/aws/aws-cdk/pull/18667#issuecomment-1075348390
beforeAll(async () => {
  app = new App();
  stack = new Stack(app, "eventBusStack", {
    env: {
      account: "000000000000",
      region: "us-east-1",
    },
  });

  testContexts = tests.map(({ resources }, i) => {
    const construct = new Construct(stack, `parent${i}`);
    return resources(construct);
  });

  await deployStack(app, stack);
});

interface ResourceTest<T = any> {
  name: string;
  resources: (parent: Construct) => T | void;
  test: (context: T) => Promise<void>;
}

/**
 * Allow for a suit of tests that deploy a single stack once and test the results in separate test cases.
 */
const testResource = <T>(
  name: string,
  resources: ResourceTest<T>["resources"],
  test: ResourceTest<T>["test"]
) => {
  tests.push({ name, resources, test });
};

testResource(
  "Create bus",
  (parent) => {
    // creating a random ID
    const addr = new CfnOutput(parent, "out", { value: "" });
    new EventBus(parent, "bus", {
      eventBusName: addr.node.addr,
    });

    return {
      bus: addr.node.addr,
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
    const bus = new EventBus<EventBusRuleInput<{ id: string }, "test">>(
      parent,
      "bus",
      {
        eventBusName: addr.node.addr,
      }
    );
    const table = new Table<{ id: string }, "id">(
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
      (event) => {
        $AWS.DynamoDB.PutItem({
          Item: {
            id: { S: event.id },
          },
          TableName: table,
        });
      }
    );
    bus
      .when(parent, "rule", (event) => event.source === "test")
      .map((event) => event.detail)
      .pipe(putMachine);

    return {
      bus: addr.node.addr,
      table: addr.node.addr + "table",
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
    const getItem = async (
      attempts: number,
      waitMillis: number,
      factor: number
    ): Promise<DynamoDB.GetItemOutput> => {
      const item = await DB.getItem({
        Key: {
          id: { S: id },
        },
        TableName: context.table,
        ConsistentRead: true,
      }).promise();
      if (!item.Item && attempts) {
        await new Promise((resolve) => setTimeout(resolve, waitMillis));
        return await getItem(attempts - 1, waitMillis * factor, factor);
      }
      return item;
    };

    // Give time for the event to make it to dynamo. Localstack is pretty slow.
    // 1 - 1s
    // 2 - 2s
    // 3 - 4s
    // 4 - 8s
    // 5 - 16s
    const item = await getItem(5, 1000, 2);

    expect(item.Item).toBeDefined();
  }
);

// Leave me at the end please.
tests.forEach(({ name, test: testFunc }, i) => {
  test(name, () => testFunc(testContexts[i]));
});
