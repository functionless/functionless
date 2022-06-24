import {
  aws_dynamodb,
  aws_events,
  CfnMapping,
  CfnParameter,
  Duration,
  Fn,
  Lazy,
  RemovalPolicy,
  SecretValue,
  Stack,
  Token,
} from "aws-cdk-lib";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Lambda } from "aws-sdk";
import axios from "axios";
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

interface TestFunctionBase {
  <
    I,
    O,
    // Forces typescript to infer O from the Function and not from the expect argument.
    OO extends O | { errorMessage: string; errorType: string },
    Outputs extends Record<string, string> = Record<string, string>
  >(
    name: string,
    func: (
      parent: Construct
    ) => Function<I, O> | { func: Function<I, O>; outputs: Outputs },
    expected: OO extends void
      ? null
      : OO | ((context: Outputs) => OO extends void ? null : O),
    payload?: I | ((context: Outputs) => I)
  ): void;
}

interface TestFunctionResource extends TestFunctionBase {
  skip: <
    I,
    O, // Forces typescript to infer O from the Function and not from the expect argument.
    OO extends O | { errorMessage: string; errorType: string },
    Outputs extends Record<string, string> = Record<string, string>
  >(
    name: string,
    func: (
      parent: Construct
    ) => Function<I, O> | { func: Function<I, O>; outputs: Outputs },
    expected: OO extends void
      ? null
      : OO | ((context: Outputs) => OO extends void ? null : O),
    payload?: I | ((context: Outputs) => I)
  ) => void;

  only: <
    I,
    O, // Forces typescript to infer O from the Function and not from the expect argument.
    OO extends O | { errorMessage: string; errorType: string },
    Outputs extends Record<string, string> = Record<string, string>
  >(
    name: string,
    func: (
      parent: Construct
    ) => Function<I, O> | { func: Function<I, O>; outputs: Outputs },
    expected: OO extends void
      ? null
      : OO | ((context: Outputs) => OO extends void ? null : O),
    payload?: I | ((context: Outputs) => I)
  ) => void;
}

localstackTestSuite("functionStack", (testResource, _stack, _app) => {
  const _testFunc: (
    f: typeof testResource | typeof testResource.only
  ) => TestFunctionBase = (f) => (name, func, expected, payload) => {
    f(
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

  const test = _testFunc(testResource) as TestFunctionResource;

  test.skip = (name, _func, _expected, _payload?) =>
    testResource.skip(
      name,
      () => {},
      async () => {}
    );

  // eslint-disable-next-line no-only-tests/no-only-tests
  test.only = _testFunc(testResource.only);

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
    "Call Lambda return bus arns",
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
    "function tokens",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const split = Fn.select(1, Fn.split(":", bus.eventBusArn));
      const join = Fn.join("-", Fn.split(":", bus.eventBusArn, 6));
      const base64 = Fn.base64("data");
      const mapping = new CfnMapping(parent, "mapping", {
        mapping: {
          map1: { test: "value" },
        },
      });
      const mapToken = Fn.findInMap(mapping.logicalId, "map1", "test");
      const param = new CfnParameter(parent, "param", {
        default: "paramValue",
      });
      const ref = Fn.ref(param.logicalId);
      return {
        func: new Function(
          parent,
          "function",
          {
            timeout: Duration.seconds(20),
          },
          async () => {
            return {
              split,
              join,
              base64,
              mapToken,
              ref,
            };
          }
        ),
        outputs: { bus: bus.eventBusArn },
      };
    },
    (output) => ({
      split: "aws",
      join: output.bus.split(":").join("-"),
      base64: "ZGF0YQ==",
      mapToken: "value",
      ref: "paramValue",
    })
  );

  test(
    "function token strings",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const split = Fn.select(1, Fn.split(":", bus.eventBusArn)).toString();
      const join = Fn.join("-", Fn.split(":", bus.eventBusArn, 6)).toString();
      const base64 = Fn.base64("data").toString();
      const mapping = new CfnMapping(parent, "mapping", {
        mapping: {
          map1: { test: "value" },
        },
      });
      const mapToken = Fn.findInMap(mapping.logicalId, "map1", "test");
      const param = new CfnParameter(parent, "param", {
        default: "paramValue",
      });
      const ref = Fn.ref(param.logicalId).toString();
      return {
        func: new Function(
          parent,
          "function",
          {
            timeout: Duration.seconds(20),
          },
          async () => {
            return {
              split,
              join,
              base64,
              mapToken,
              ref,
            };
          }
        ),
        outputs: { bus: bus.eventBusArn },
      };
    },
    (output) => ({
      split: "aws",
      join: output.bus.split(":").join("-"),
      base64: "ZGF0YQ==",
      mapToken: "value",
      ref: "paramValue",
    })
  );

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

    bus.resource.grantPutEventsTo(func.resource);

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
    "tokens",
    (parent) => {
      const token = Token.asString("hello");
      const obj = { iam: "object" };
      const token2 = Token.asAny(obj);
      const obj2 = { iam: Token.asString("token") };
      const nestedToken = Token.asAny(obj2);
      const numberToken = Token.asNumber(1);
      const listToken = Token.asList(["1", "2"]);
      const nestedListToken = Token.asList([Token.asString("hello")]);
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          return {
            string: token,
            object: token2 as unknown as typeof obj,
            nested: nestedToken as unknown as typeof obj2,
            number: numberToken,
            list: listToken,
            nestedList: nestedListToken,
          };
        }
      );
    },
    {
      string: "hello",
      object: { iam: "object" },
      nested: { iam: "token" },
      number: 1,
      list: ["1", "2"],
      nestedList: ["hello"],
    }
  );

  test(
    "serialize entire table",
    (parent) => {
      const table = new aws_dynamodb.Table(parent, "table", {
        partitionKey: {
          name: "key",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });
      const get = $AWS.DynamoDB.GetItem;
      table.addGlobalSecondaryIndex({
        indexName: "testIndex",
        partitionKey: {
          name: "key",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      const flTable = Table.fromTable(table);

      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await get({
            Table: flTable,
            Key: {
              key: { S: "hi" },
            },
          });
        }
      );
    },
    null
  );

  test(
    "serialize entire function",
    (parent) => {
      const func = new Function<undefined, string>(parent, "func", async () => {
        return "hello";
      });

      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          const hello = func;
          return hello();
        }
      );
    },
    "hello"
  );

  test(
    "serialize token with nested string",
    (parent) => {
      const table = new aws_dynamodb.Table(parent, "table", {
        partitionKey: {
          name: "key",
          type: aws_dynamodb.AttributeType.STRING,
        },
      });

      const obj = { key: table.tableArn };
      const token = Token.asAny(obj);

      return {
        func: new Function(
          parent,
          "function",
          localstackClientConfig,
          async () => {
            return (token as unknown as typeof obj).key;
          }
        ),
        outputs: { table: table.tableArn },
      };
    },
    (outputs) => {
      return outputs.table;
    }
  );

  //
  test.skip(
    "serialize token with lazy should return",
    (parent) => {
      const obj = {
        key: Lazy.any({ produce: () => "value" }) as unknown as string,
      };
      const token = Token.asAny(obj);

      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          return (token as unknown as typeof obj).key;
        }
      );
    },
    "value"
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

  test("import", (parent) => {
    return new Function(
      parent,
      "function",
      localstackClientConfig,
      async () => {
        console.log("hi");
        return (await axios.get("https://google.com")).status;
      }
    );
  }, 200);

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
    "dynamo integration aws dynamo functions",
    (parent) => {
      const table = Table.fromTable<{ key: string; value: string }, "key">(
        new aws_dynamodb.Table(parent, "table", {
          partitionKey: {
            name: "key",
            type: aws_dynamodb.AttributeType.STRING,
          },
          removalPolicy: RemovalPolicy.DESTROY,
        })
      );
      const { GetItem, DeleteItem, PutItem, Query, Scan, UpdateItem } =
        $AWS.DynamoDB;
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await PutItem({
            Table: table,
            Item: {
              key: { S: "key" },
              value: { S: "wee" },
            },
          });
          const item = await GetItem({
            Table: table,
            Key: {
              key: {
                S: "key",
              },
            },
            ConsistentRead: true,
          });
          await UpdateItem({
            Table: table,
            Key: {
              key: { S: "key" },
            },
            UpdateExpression: "set #value = :value",
            ExpressionAttributeValues: {
              ":value": { S: "value" },
            },
            ExpressionAttributeNames: {
              "#value": "value",
            },
          });
          await DeleteItem({
            Table: table,
            Key: {
              key: {
                S: "key",
              },
            },
          });
          await Query({
            Table: table,
            KeyConditionExpression: "#key = :key",
            ExpressionAttributeValues: {
              ":key": { S: "key" },
            },
            ExpressionAttributeNames: {
              "#key": "key",
            },
          });
          await Scan({
            Table: table,
          });
          return item.Item?.key.S;
        }
      );
    },
    "key"
  );

  /**
   * Higher Order Function Tests
   *
   * Referencing integrations from methods outside of the closure.
   *
   * https://github.com/functionless/functionless/issues/148
   */

  test.skip(
    "use method with closure",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const getBus = () => bus;
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await getBus().putEvents({
            "detail-type": "detail",
            source: "lambda",
            detail: {},
          });
        }
      );
    },
    null
  );

  test.skip(
    "use method with call",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const callBus = () =>
        bus.putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await callBus();
        }
      );
    },
    null
  );

  test.skip(
    "use dynamic method with call",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const bus2 = new EventBus(parent, "bus2");
      const callBus = (bool: boolean) =>
        (bool ? bus : bus2).putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await callBus(true);
          await callBus(false);
        }
      );
    },
    null
  );

  test.skip(
    "use dynamic method with call once",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const bus2 = new EventBus(parent, "bus2");
      const callBus = (bool: boolean) =>
        (bool ? bus : bus2).putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await callBus(false);
        }
      );
    },
    null
  );

  test.skip(
    "use dynamic method",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const bus2 = new EventBus(parent, "bus2");
      const getBus = (bool: boolean) => (bool ? bus : bus2);
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await getBus(false).putEvents({
            "detail-type": "detail",
            source: "lambda",
            detail: {},
          });
          await getBus(true).putEvents({
            "detail-type": "detail",
            source: "lambda",
            detail: {},
          });
        }
      );
    },
    null
  );

  test.skip(
    "use dynamic method don't call",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const bus2 = new EventBus(parent, "bus2");
      const getBus = (bool: boolean) => (bool ? bus : bus2);
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await getBus(false).putEvents({
            "detail-type": "detail",
            source: "lambda",
            detail: {},
          });
        }
      );
    },
    null
  );

  /**
   * This should fail?
   */
  test.skip(
    "method with new ",
    (parent) => {
      const getBus = () => new EventBus(parent, "bus");
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          await getBus().putEvents({
            "detail-type": "detail",
            source: "lambda",
            detail: {},
          });
        }
      );
    },
    null
  );

  test.skip("method with no integration ", (parent) => {
    const mathStuff = (a: number, b: number) => a + b;
    return new Function(
      parent,
      "function",
      localstackClientConfig,
      async () => {
        return mathStuff(1, 2);
      }
    );
  }, 3);

  test.skip("chained methods", (parent) => {
    const mathStuff = (a: number, b: number) => a + b;
    const mathStuff2 = (a: number, b: number) => a + mathStuff(a, b);
    return new Function(
      parent,
      "function",
      localstackClientConfig,
      async () => {
        return mathStuff2(1, 2);
      }
    );
  }, 4);

  test.skip("recursion", (parent) => {
    const mult = (a: number, b: number): number => {
      if (b <= 0) {
        return 1;
      }
      return a * mult(a, b - 1);
    };
    return new Function(
      parent,
      "function",
      localstackClientConfig,
      async () => {
        return mult(2, 3);
      }
    );
  }, 8);

  test.skip("nested closured methods", (parent) => {
    const callMe = (a: number, b: number): number => {
      const helper = () => {
        return a * 2;
      };

      return helper() + b;
    };
    return new Function(
      parent,
      "function",
      localstackClientConfig,
      async () => {
        return callMe(2, 3);
      }
    );
  }, 7);

  test.skip(
    "chained with integration",
    (parent) => {
      const func = new Function<undefined, string>(
        parent,
        "func2",
        async () => {
          return "hello";
        }
      );
      const callFunction = () => func();
      const callFunction2 = () => callFunction();
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          return callFunction2();
        }
      );
    },
    "hello"
  );

  test.skip(
    "nested with integration",
    (parent) => {
      const func = new Function<undefined, string>(
        parent,
        "func2",
        async () => {
          return "hello";
        }
      );
      const callFunction = async () => {
        const helper = async () => `formatted ${await func()}`;
        return helper();
      };
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          return callFunction();
        }
      );
    },
    "formatted hello"
  );

  test.skip(
    "recursion with integration",
    (parent) => {
      const func = new Function<undefined, string>(
        parent,
        "func2",
        async () => {
          return "hello";
        }
      );
      const callFunction = async (n: number): Promise<string> => {
        if (n === 0) {
          return `${n}`;
        }
        return (await callFunction(n - 1)) + (await func());
      };
      return new Function(
        parent,
        "function",
        localstackClientConfig,
        async () => {
          return callFunction(3);
        }
      );
    },
    "0hellohellohello"
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

  try {
    expect(
      result.Payload ? JSON.parse(result.Payload.toString()) : undefined
    ).toEqual(expected);
  } catch (e) {
    console.error(result);
    throw e;
  }
};

test("should not create new resources in lambda", async () => {
  await expect(async () => {
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
  }).rejects.toThrow(
    `Cannot initialize new CDK resources in a native function, found EventBus.`
  );
});

test("should not create new functionless resources in lambda", async () => {
  await expect(async () => {
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
  }).rejects.toThrow(
    "Cannot initialize new resources in a native function, found EventBus."
  );
});

test("should not use SecretValues in lambda", async () => {
  await expect(async () => {
    const stack = new Stack();
    const secret = SecretValue.unsafePlainText("sshhhhh");
    new Function(
      stack,
      "function",
      {
        timeout: Duration.seconds(20),
      },
      async () => {
        return secret;
      }
    );
    await Promise.all(Function.promises);
  }).rejects.toThrow(`Found unsafe use of SecretValue token in a Function.`);
});

test("should not use SecretValues as string in lambda", async () => {
  await expect(async () => {
    const stack = new Stack();
    const secret = SecretValue.unsafePlainText("sshhhhh").toString();
    new Function(
      stack,
      "function",
      {
        timeout: Duration.seconds(20),
      },
      async () => {
        return secret;
      }
    );
    await Promise.all(Function.promises);
  }).rejects.toThrow(`Found unsafe use of SecretValue token in a Function.`);
});
