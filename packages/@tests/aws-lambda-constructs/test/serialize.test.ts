import { Stack } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import axios from "axios";
import { v4 } from "uuid";
import {
  Function,
  bundle,
  serialize,
} from "@functionless/aws-lambda-constructs";
import { Table } from "@functionless/aws-dynamodb-constructs";
import { EventBus } from "@functionless/aws-events-constructs";
import { StepFunction } from "@functionless/aws-stepfunctions-constructs";
import { $AWS } from "@functionless/aws-sdk";

// 15k arbitrary max bundle size. Some functions may need more.
// In that case increase explicitly.
const BUNDLED_MAX_SIZE = 50 * 1024;

interface CustomMatchers<R = unknown> {
  toHaveLengthLessThan(length: number): R;
}

declare global {
  namespace jest {
    interface Expect extends CustomMatchers {}
    interface Matchers<R> extends CustomMatchers<R> {}
    interface InverseAsymmetricMatchers extends CustomMatchers {}
  }
}

expect.extend({
  toHaveLengthLessThan(received, expected) {
    const options = {
      comment: "String length",
      isNot: this.isNot,
      promise: this.promise,
    };

    const pass = received.length < expected;
    return {
      pass: pass,
      message: pass
        ? () => `${this.utils.matcherHint(
            "toHaveLengthLessThan",
            undefined,
            undefined,
            options
          )}
      
expected: not length less than ${expected}
actual: ${received.length}`
        : () => `${this.utils.matcherHint(
            "toHaveLengthLessThan",
            undefined,
            undefined,
            options
          )}
      
expected: length less than ${expected}
actual: ${received.length}`,
    };
  },
});

describe("serialize", () => {
  test("simple", async () => {
    const [srlz] = await serialize(async () => {
      return "hello";
    }, []);
    expect(srlz).toMatchSnapshot();

    const bundled = await bundle(srlz);
    expect(bundled.text).toMatchSnapshot();
  });

  describe("tableMethods", () => {
    const stack = new Stack();
    const table = new Table<{ id: string }, "id">(stack, "table", {
      partitionKey: {
        name: "id",
        type: AttributeType.STRING,
      },
    });

    test("get", async () => {
      const [srlz] = await serialize(() => {
        return table.attributes.get({
          Key: {
            id: { S: "id" },
          },
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    const { get } = table.attributes;

    test("get referenced", async () => {
      const [srlz] = await serialize(async () => {
        return get({
          Key: {
            id: { S: "id" },
          },
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("put", async () => {
      const [srlz] = await serialize(async () => {
        return table.attributes.put({
          Item: {
            id: { S: "key" },
          },
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("put", async () => {
      const [srlz] = await serialize(async () => {
        return table.attributes.update({
          Key: {
            id: { S: "key" },
          },
          UpdateExpression: "set #value = :value",
          ExpressionAttributeValues: {
            ":value": { S: "value" },
          },
          ExpressionAttributeNames: {
            "#value": "value",
          },
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("delete", async () => {
      const [srlz] = await serialize(async () => {
        return table.attributes.delete({
          Key: {
            id: {
              S: "key",
            },
          },
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("query", async () => {
      const [srlz] = await serialize(async () => {
        return table.query({
          KeyConditionExpression: "#key = :key",
          ExpressionAttributeValues: {
            ":key": { S: "key" },
          },
          ExpressionAttributeNames: {
            "#key": "key",
          },
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("scan", async () => {
      const [srlz] = await serialize(async () => {
        return table.attributes.scan();
      }, []);

      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });
  });

  describe("sdk", () => {
    test("SDK.CloudWatch.describeAlarms", async () => {
      const [srlz] = await serialize(() => {
        return $AWS.SDK.CloudWatch.describeAlarms(
          {},
          {
            iam: { resources: ["*"] },
          }
        );
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test.skip("SDK.CloudWatch.describeAlarms referenced", async () => {
      const describeAlarms = $AWS.SDK.CloudWatch.describeAlarms;
      const [srlz] = await serialize(async () => {
        return describeAlarms(
          {},
          {
            iam: { resources: ["*"] },
          }
        );
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });
  });

  describe("sfn", () => {
    const stack = new Stack();
    const sfn = new StepFunction(stack, "id", () => {});

    test("sfn", async () => {
      const [srlz] = await serialize(() => {
        return sfn({ input: {} });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });
  });

  describe("lambda", () => {
    const stack = new Stack();
    const func = new Function<undefined, void>(stack, "id", async () => {});

    test("func", async () => {
      const [srlz] = await serialize(() => {
        return func();
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("invoke func", async () => {
      const [srlz] = await serialize(() => {
        return $AWS.Lambda.Invoke({
          Function: func,
          Payload: undefined,
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });
  });

  describe("event bridge", () => {
    const stack = new Stack();
    const bus = new EventBus(stack, "id");

    test("put events", async () => {
      const [srlz] = await serialize(() => {
        return bus.putEvents({
          "detail-type": "test",
          detail: {},
          source: "",
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("aws put events", async () => {
      const [srlz] = await serialize(() => {
        return $AWS.EventBridge.putEvents({
          Entries: [
            {
              EventBusName: bus.eventBusName,
            },
          ],
        });
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("aws put events reference", async () => {
      // Necessary to keep the bundle small and stop the test from failing.
      // See https://github.com/functionless/functionless/pull/122
      const putEvents = $AWS.EventBridge.putEvents;
      const [srlz] = await serialize(async () => {
        const result = await putEvents({
          Entries: [
            {
              EventBusName: bus.eventBusArn,
              Source: "MyEvent",
              DetailType: "DetailType",
              Detail: "{}",
            },
          ],
        });
        return result.FailedEntryCount;
      }, []);
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });
  });

  test("axios import", async () => {
    const [srlz] = await serialize(async () => {
      return axios.get("https://functionless.org");
    }, []);

    expect(srlz).toMatchSnapshot();

    const bundled = await bundle(srlz);
    expect(bundled.text).toMatchSnapshot();
    // 300k after bundling
    expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE * 30);
  });

  test("uuid", async () => {
    const [srlz] = await serialize(async () => {
      return v4();
    }, []);

    expect(srlz).toMatchSnapshot();

    const bundled = await bundle(srlz);
    expect(bundled.text).toMatchSnapshot();
    expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE * 1.5);
  });
});
