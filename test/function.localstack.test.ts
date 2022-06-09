import {
  aws_dynamodb,
  aws_events,
  Duration,
  RemovalPolicy,
  Stack,
  Token,
} from "aws-cdk-lib";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Lambda } from "aws-sdk";
import { Construct } from "constructs";
import {
  $AWS,
  EventBus,
  Event,
  ExpressStepFunction,
  Function,
  FunctionProps,
  StepFunction,
  Table,
} from "../src";
import { clientConfig, localstackTestSuite } from "./localstack";

const lambda = new Lambda(clientConfig);

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
  timeout: Duration.seconds(20),
  clientConfigRetriever: () => ({
    endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
  }),
};

interface TestFunctionResource {
  <I, O, Outputs extends Record<string, string> = Record<string, string>>(
    name: string,
    func: (
      parent: Construct
    ) => Function<I, O> | { func: Function<I, O>; outputs: Outputs },
    expected: O | ((context: Outputs) => O),
    payload?: I | ((context: Outputs) => I)
  ): void;

  skip: <I, O, Outputs extends Record<string, string> = Record<string, string>>(
    name: string,
    func: (
      parent: Construct
    ) => Function<I, O> | { func: Function<I, O>; outputs: Outputs },
    expected: O | ((context: Outputs) => O),
    payload?: I | ((context: Outputs) => I)
  ) => void;
}

localstackTestSuite("functionStack", (testResource, _stack, _app) => {
  const test: TestFunctionResource = (name, func, expected, payload) => {
    testResource(
      name,
      (parent) => {
        const res = func(parent);
        const [funcRes, outputs] =
          res instanceof Function ? [res, {}] : [res.func, res.outputs];
        return {
          outputs: {
            function: funcRes.resource.functionName,
            ...outputs,
          },
        };
      },
      async (context) => {
        const exp =
          // @ts-ignore
          typeof expected === "function" ? expected(context) : expected;
        // @ts-ignore
        const pay = typeof payload === "function" ? payload(context) : payload;
        await testFunction(context.function, pay, exp);
      }
    );
  };

  test.skip = (name, _func, _expected, _payload?) =>
    testResource.skip(
      name,
      () => {},
      async () => {}
    );

  test(
    "Call Lambda",
    (parent) => {
      return new Function(
        parent,
        "func2",
        {
          timeout: Duration.seconds(20),
        },
        async (event) => event
      );
    },
    {}
  );

  test(
    "Call Lambda from closure",
    (parent) => {
      const create = () =>
        new Function(
          parent,
          "function",
          {
            timeout: Duration.seconds(20),
          },
          async (event) => event
        );

      return create();
    },
    {}
  );

  test(
    "Call Lambda from closure with variables",
    (parent) => {
      const create = () => {
        const val = "a";
        return new Function(
          parent,
          "function",
          {
            timeout: Duration.seconds(20),
          },
          async () => val
        );
      };

      return create();
    },
    "a"
  );

  test(
    "Call Lambda from closure with parameter",
    (parent) => {
      const create = (val: string) => {
        return new Function(
          parent,
          "func5",
          {
            timeout: Duration.seconds(20),
          },
          async () => val
        );
      };

      return create("b");
    },
    "b"
  );

  const create = (parent: Construct, id: string, val: string) => {
    return new Function(
      parent,
      id,
      {
        timeout: Duration.seconds(20),
      },
      async () => val
    );
  };

  test(
    "Call Lambda from closure with parameter using the same method",
    (parent) => create(parent, "func6", "c"),
    "c"
  );

  test(
    "Call Lambda from closure with parameter using the same method part 2",
    (parent) => create(parent, "func7", "d"),
    "d"
  );

  test("Call Lambda with object", (parent) => {
    const create = () => {
      const obj = { val: 1 };
      return new Function(
        parent,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async () => obj.val
      );
    };

    return create();
  }, 1);

  test(
    "Call Lambda with math",
    (parent) =>
      new Function(
        parent,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async () => {
          const v1 = 1 + 2; // 3
          const v2 = v1 * 3; // 9
          return v2 - 4; // 5
        }
      ),
    5
  );

  test(
    "Call Lambda payload",
    (parent) =>
      new Function(
        parent,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async (event: { val: string }) => {
          return `value: ${event.val}`;
        }
      ),
    "value: hi",
    { val: "hi" }
  );

  test(
    "Call Lambda throw error",
    (parent) =>
      new Function(
        parent,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async () => {
          throw Error("AHHHHHHHHH");
        }
      ),
    { errorMessage: "AHHHHHHHHH", errorType: "Error" }
  );

  test(
    "Call Lambda return arns",
    (parent) => {
      return new Function(
        parent,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async (_, context) => {
          return context.functionName;
        }
      );
    },
    (context) => context.function
  );

  test(
    "Call Lambda return arns",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const busbus = new aws_events.EventBus(parent, "busbus");
      const func = new Function(
        parent,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async () => {
          return `${bus.eventBusArn} ${busbus.eventBusArn}`;
        }
      );

      return {
        func,
        outputs: {
          bus: bus.eventBusArn,
          busbus: busbus.eventBusArn,
        },
      };
    },
    (context) => `${context.bus} ${context.busbus}`
  );

  test(
    "templated tokens",
    (parent) => {
      const token = Token.asString("hello");
      return new Function(
        parent,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async () => {
          return `${token} stuff`;
        }
      );
    },
    "hello stuff"
  );

  test("numeric tokens", (parent) => {
    const token = Token.asNumber(1);
    return new Function(
      parent,
      "function",
      {
        timeout: Duration.seconds(20),
      },
      async () => {
        return token;
      }
    );
  }, 1);

  test(
    "Call Lambda put events",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await bus.putEvents({
            "detail-type": "detail",
            source: "lambda",
            detail: {},
          });
        }
      );
    },
    null
  );

  test("Call Lambda AWS SDK put event to bus with reference", (parent) => {
    const bus = new EventBus<any>(parent, "bus");

    // Necessary to keep the bundle small and stop the test from failing.
    // See https://github.com/functionless/functionless/pull/122
    const putEvents = $AWS.EventBridge.putEvents;
    const func = new Function(
      parent,
      "function",
      localstackClientConfig,
      async () => {
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
      }
    );

    bus.bus.grantPutEventsTo(func.resource);

    return func;
  }, 0);

  // See https://github.com/functionless/functionless/pull/122
  test.skip("Call Lambda AWS SDK put event to bus without reference", (parent) => {
    const bus = new EventBus<Event>(parent, "bus");

    return new Function(
      parent,
      "function",
      localstackClientConfig,
      async () => {
        const result = await $AWS.EventBridge.putEvents({
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
      }
    );
  }, 0);

  test(
    "Call Lambda AWS SDK put event to bus with in closure reference",
    (parent) => {
      const bus = new EventBus<Event>(parent, "bus");
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          const busbus = bus;
          await busbus.putEvents({
            "detail-type": "anyDetail",
            source: "anySource",
            detail: {},
          });
        }
      );
    },
    null
  );

  test(
    "Call Lambda AWS SDK integration from destructured object",
    (parent) => {
      const buses = { bus: new EventBus<Event>(parent, "bus") };
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          const { bus } = buses;
          await bus.putEvents({
            "detail-type": "anyDetail",
            source: "anySource",
            detail: {},
          });
        }
      );
    },
    null
  );

  test(
    "Call Lambda invoke client",
    (parent) => {
      const func1 = new Function<undefined, string>(
        parent,
        "func1",
        async () => "hi"
      );
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          return func1();
        }
      );
    },
    "hi"
  );

  test(
    "Call Lambda invoke client with promise.all",
    (parent) => {
      const func1 = new Function<undefined, string>(
        parent,
        "func1",
        async () => "hi"
      );
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          const promises = [func1(), func1(), func1()];
          await Promise.all(promises);
          return "DONE";
        }
      );
    },
    "DONE"
  );

  test(
    "Call Lambda invoke client with chained promises",
    (parent) => {
      const func1 = new Function<undefined, string>(
        parent,
        "func1",
        async () => "hi"
      );
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await func1()
            .then(() => func1())
            .then(() => func1());
          return "DONE";
        }
      );
    },
    "DONE"
  );

  // https://github.com/functionless/functionless/issues/173
  test.skip(
    "Call Self",
    (parent) => {
      let func1: Function<number, string> | undefined;
      func1 = new Function(
        parent,
        "function",
        localstackClientConfig,
        async (count) => {
          if (count === 0) return "hi";
          return func1 ? func1(count - 1) : "huh";
        }
      );
      return func1;
    },
    "hi",
    2
  );

  // https://github.com/functionless/functionless/issues/173
  test.skip(
    "Call Self",
    (parent) => {
      let func1: Function<number, string> | undefined;
      const func2 = new Function<number, string>(
        parent,
        "func2",
        async (count) => {
          if (!func1) throw Error();
          return func1(count - 1);
        }
      );
      func1 = new Function(
        parent,
        "function",
        localstackClientConfig,
        async (count) => {
          if (count === 0) return "hi";
          return func2(count);
        }
      );
      return func1;
    },
    "hi",
    2
  );

  test(
    "step function integration",
    (parent) => {
      const func1 = new StepFunction<undefined, string>(
        parent,
        "func1",
        () => "hi"
      );
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await func1({});
          return "started!";
        }
      );
    },
    "started!"
  );

  test(
    "step function integration and wait for completion",
    (parent) => {
      const func1 = new StepFunction<undefined, string>(
        parent,
        "func1",
        () => "hi"
      );
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          const result = await func1({});
          let status = "RUNNING";
          while (true) {
            const state = await func1.describeExecution(result.executionArn);
            status = state.status;
            if (status !== "RUNNING") {
              return state.output;
            }
            // wait for 100 ms
            await new Promise((resolve) => setTimeout(resolve, 100));
          }
        }
      );
    },
    `"hi"`
  );

  // Localstack doesn't support start sync
  // https://github.com/localstack/localstack/issues/5258
  test.skip(
    "express step function integration",
    (parent) => {
      const func1 = new ExpressStepFunction<undefined, string>(
        parent,
        "func1",
        () => "hi"
      );
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          const result = await func1({});
          return result.status === "SUCCEEDED" ? result.output : result.error;
        }
      );
    },
    "hi"
  );

  test(
    "dynamo integration get",
    (parent) => {
      const table = new Table<{ key: string }, "key">(
        new aws_dynamodb.Table(parent, "table", {
          partitionKey: {
            name: "key",
            type: aws_dynamodb.AttributeType.STRING,
          },
          removalPolicy: RemovalPolicy.DESTROY,
        })
      );
      const putItem = $AWS.DynamoDB.PutItem;
      const getItem = $AWS.DynamoDB.GetItem;
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await putItem({
            TableName: table,
            Item: {
              key: { S: "key" },
            },
          });
          const item = await getItem({
            TableName: table,
            Key: {
              key: {
                S: "key",
              },
            },
            ConsistentRead: true,
          });
          return item.Item?.key.S;
        }
      );
    },
    "key"
  );
});

const testFunction = async (
  functionName: string,
  payload: any,
  expected: any
) => {
  const result = await lambda
    .invoke({
      FunctionName: functionName,
      Payload: JSON.stringify(payload),
    })
    .promise();

  expect(
    result.Payload ? JSON.parse(result.Payload.toString()) : undefined
  ).toEqual(expected);
};

test("should not create new resources in lambda", async () => {
  await expect(
    async () => {
      const stack = new Stack();
      new Function(
        stack,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async () => {
          const bus = new aws_events.EventBus(stack, "busbus");
          return bus.eventBusArn;
        }
      );
      await Promise.all(Function.promises);
    }
    // TODO: add error message
  ).rejects.toThrow();
});

test("should not create new functionless resources in lambda", async () => {
  await expect(
    async () => {
      const stack = new Stack();
      new Function(
        stack,
        "function",
        {
          timeout: Duration.seconds(20),
        },
        async () => {
          const bus = new EventBus(stack, "busbus");
          return bus.eventBusArn;
        }
      );
      await Promise.all(Function.promises);
    }
    // TODO: add error message
  ).rejects.toThrow();
});
