import { Stack } from "aws-cdk-lib";
import { AttributeType } from "aws-cdk-lib/aws-dynamodb";
import axios from "axios";
import { v4 } from "uuid";
import { serialize, bundle, $AWS, Table } from "@fnls";

// 50k arbitrary max bundle size. Some functions may need more.
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
    const [srlz] = await serialize(
      () => () => {
        return "hello";
      },
      []
    );
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
      const [srlz] = await serialize(
        () => () => {
          return $AWS.DynamoDB.GetItem({
            TableName: table,
            Key: {
              id: { S: "id" },
            },
          });
        },
        []
      );
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    const { GetItem } = $AWS.DynamoDB;

    test("get referenced", async () => {
      const [srlz] = await serialize(
        () => () => {
          return GetItem({
            TableName: table,
            Key: {
              id: { S: "id" },
            },
          });
        },
        []
      );
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("put", async () => {
      const [srlz] = await serialize(
        () => () => {
          return $AWS.DynamoDB.PutItem({
            TableName: table,
            Item: {
              id: { S: "key" },
            },
          });
        },
        []
      );
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("put", async () => {
      const [srlz] = await serialize(
        () => () => {
          return $AWS.DynamoDB.UpdateItem({
            TableName: table,
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
        },
        []
      );
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("delete", async () => {
      const [srlz] = await serialize(
        () => () => {
          return $AWS.DynamoDB.DeleteItem({
            TableName: table,
            Key: {
              id: {
                S: "key",
              },
            },
          });
        },
        []
      );
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("query", async () => {
      const [srlz] = await serialize(
        () => () => {
          return $AWS.DynamoDB.Query({
            TableName: table,
            KeyConditionExpression: "#key = :key",
            ExpressionAttributeValues: {
              ":key": { S: "key" },
            },
            ExpressionAttributeNames: {
              "#key": "key",
            },
          });
        },
        []
      );
      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });

    test("scan", async () => {
      const [srlz] = await serialize(
        () => () => {
          return $AWS.DynamoDB.Scan({
            TableName: table,
          });
        },
        []
      );

      expect(srlz).toMatchSnapshot();

      const bundled = await bundle(srlz);
      expect(bundled.text).toMatchSnapshot();
      expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
    });
  });

  test("axios import", async () => {
    const [srlz] = await serialize(
      () => async () => {
        return axios.get("https://functionless.org");
      },
      []
    );

    expect(srlz).toMatchSnapshot();

    const bundled = await bundle(srlz);
    expect(bundled.text).toMatchSnapshot();
    // 300k after bundling
    expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE * 10);
  });

  test("uuid", async () => {
    const [srlz] = await serialize(
      () => async () => {
        return v4();
      },
      []
    );

    expect(srlz).toMatchSnapshot();

    const bundled = await bundle(srlz);
    expect(bundled.text).toMatchSnapshot();
    expect(bundled.text).toHaveLengthLessThan(BUNDLED_MAX_SIZE);
  });
});
