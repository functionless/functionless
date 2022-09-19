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
import {
  CompositePrincipal,
  Role,
  ServicePrincipal,
} from "aws-cdk-lib/aws-iam";
// eslint-disable-next-line import/no-extraneous-dependencies
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
  FunctionClosure,
} from "../src";
import { runtimeTestExecutionContext, runtimeTestSuite } from "./runtime";
import { testFunction } from "./runtime-util";

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
      :
          | OO
          | ((
              context: Outputs,
              payload: OO extends void ? undefined : O
            ) => void),
    payload?: I | ((context: Outputs) => I)
  ): void;
}

interface TestFunctionResource extends TestFunctionBase {
  skip: TestFunctionBase;
  only: TestFunctionBase;
}

runtimeTestSuite("functionStack", (testResource, stack, _app) => {
  const _testFunc: (
    f: typeof testResource | typeof testResource.only
  ) => TestFunctionBase = (f) => (name, func, expected, payload) => {
    f(
      name,
      (parent, role) => {
        const res = func(parent);
        const [funcRes, outputs] =
          res instanceof Function ? [res, {}] : [res.func, res.outputs];
        funcRes.resource.grantInvoke(role);
        return {
          outputs: {
            function: funcRes.resource.functionName,
            ...outputs,
          },
        };
      },
      async (context, clients) => {
        const pay =
          typeof payload === "function"
            ? (<globalThis.Function>payload)(context)
            : payload;
        await testFunction(clients.lambda, context.function, pay, (result) =>
          typeof expected === "function"
            ? (<globalThis.Function>expected)(context, result)
            : expect(result).toEqual(expected)
        );
      }
    );
  };

  const test = _testFunc(testResource) as TestFunctionResource;

  test.skip = (name, _func, _expected, _payload?) =>
    testResource.skip(
      name,
      () => {
        return { outputs: {} };
      },
      async () => {}
    );

  // eslint-disable-next-line no-only-tests/no-only-tests
  test.only = _testFunc(testResource.only);

  const resourceRole = new Role(stack, "resourceRole", {
    assumedBy: new CompositePrincipal(
      new ServicePrincipal("lambda"),
      new ServicePrincipal("states")
    ),
  });

  // inject the localstack client config into the lambda clients
  // without this configuration, the functions will try to hit AWS proper
  const localstackClientConfig: FunctionProps = {
    timeout: Duration.seconds(20),
    clientConfigRetriever:
      runtimeTestExecutionContext.deployTarget === "AWS"
        ? undefined
        : () => ({
            endpoint: `http://${process.env.LOCALSTACK_HOSTNAME}:4566`,
          }),
  };

  function functionWithOwnRole<I, O>(
    scope: Construct,
    closure: FunctionClosure<I, O>
  ): Function<I, O>;
  function functionWithOwnRole<I, O>(
    scope: Construct,
    id: string,
    closure: FunctionClosure<I, O>
  ): Function<I, O>;
  function functionWithOwnRole<I, O>(
    ...args:
      | [scope: Construct, id: string, closure: FunctionClosure<I, O>]
      | [scope: Construct, closure: FunctionClosure<I, O>]
  ) {
    const [scope, id, closure] =
      args.length === 2 ? [args[0], "func", args[1]] : args;
    return new Function(scope, id, localstackClientConfig, closure);
  }

  function functionWithSharedRole<I, O>(
    scope: Construct,
    closure: FunctionClosure<I, O>
  ): Function<I, O>;
  function functionWithSharedRole<I, O>(
    scope: Construct,
    id: string,
    closure: FunctionClosure<I, O>
  ): Function<I, O>;
  function functionWithSharedRole<I, O>(
    ...args:
      | [scope: Construct, id: string, closure: FunctionClosure<I, O>]
      | [scope: Construct, closure: FunctionClosure<I, O>]
  ) {
    const [scope, id, closure] =
      args.length === 2 ? [args[0], "func", args[1]] : args;
    return new Function(
      scope,
      id,
      { ...localstackClientConfig, role: resourceRole },
      closure
    );
  }

  const stringFunction = functionWithSharedRole<undefined, string>(
    stack,
    "stringFunction",
    async () => "hi"
  );

  const stringStepFunction = new StepFunction<undefined, string>(
    stack,
    "stringStepFunction",
    { role: resourceRole },
    () => "hi"
  );

  const table = new Table<{ key: string; value: string }, "key">(
    stack,
    "table",
    {
      partitionKey: {
        name: "key",
        type: aws_dynamodb.AttributeType.STRING,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    }
  );

  const bus = new EventBus<Event>(stack, "bus");

  test(
    "Call Lambda",
    (parent) => {
      return functionWithSharedRole(parent, async (event) => event);
    },
    {}
  );

  test(
    "Call Lambda from closure with variables",
    (parent) => {
      const create = () => {
        const val = "a";
        return functionWithSharedRole(parent, async () => val);
      };

      return create();
    },
    "a"
  );

  test(
    "Call Lambda from closure with parameter",
    (parent) => {
      const create = (val: string) => {
        return functionWithSharedRole(parent, async () => val);
      };

      return create("b");
    },
    "b"
  );

  const create = (parent: Construct, id: string, val: string) => {
    return functionWithSharedRole(parent, id, async () => val);
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
      return functionWithSharedRole(parent, async () => obj.val);
    };

    return create();
  }, 1);

  test(
    "Call Lambda with math",
    (parent) =>
      functionWithSharedRole(parent, async () => {
        const v1 = 1 + 2; // 3
        const v2 = v1 * 3; // 9
        return v2 - 4; // 5
      }),
    5
  );

  test(
    "Call Lambda payload",
    (parent) =>
      functionWithSharedRole(parent, async (event: { val: string }) => {
        return `value: ${event.val}`;
      }),
    "value: hi",
    { val: "hi" }
  );

  test(
    "Call Lambda throw error",
    (parent) =>
      functionWithSharedRole(parent, async () => {
        throw Error("AHHHHHHHHH");
      }),
    (_, result) =>
      expect(result).toMatchObject({
        errorMessage: "AHHHHHHHHH",
        errorType: "Error",
      }),
    undefined
  );

  test(
    "Call Lambda return arns",
    (parent) =>
      functionWithSharedRole(parent, async (_, context) => {
        return context.functionName;
      }),
    (context, result) => expect(result).toEqual(context.function)
  );

  test(
    "Call Lambda return bus arns",
    (parent) => {
      const busbus = new aws_events.EventBus(parent, "busbus");
      const func = functionWithOwnRole(parent, async () => {
        return `${bus.eventBusArn} ${busbus.eventBusArn}`;
      });

      return {
        func,
        outputs: {
          bus: bus.eventBusArn,
          busbus: busbus.eventBusArn,
        },
      };
    },
    (context, result) =>
      expect(`${context.bus} ${context.busbus}`).toEqual(result)
  );

  test(
    "templated tokens",
    (parent) => {
      const token = Token.asString("hello");
      return functionWithSharedRole(parent, async () => {
        return `${token} stuff`;
      });
    },
    "hello stuff"
  );

  test("numeric tokens", (parent) => {
    const token = Token.asNumber(1);
    return functionWithSharedRole(parent, async () => {
      return token;
    });
  }, 1);

  test(
    "function tokens",
    (parent) => {
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
        func: functionWithOwnRole(parent, async () => {
          return {
            split,
            join,
            base64,
            mapToken,
            ref,
          };
        }),
        outputs: { bus: bus.eventBusArn },
      };
    },
    (output, result) =>
      expect(result).toEqual({
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
        func: functionWithOwnRole(parent, async () => {
          return {
            split,
            join,
            base64,
            mapToken,
            ref,
          };
        }),
        outputs: { bus: bus.eventBusArn },
      };
    },
    (output, result) =>
      expect(result).toEqual({
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
      return functionWithOwnRole(parent, async () => {
        await bus.putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
          version: "1",
          id: "bbbbbbbb-eeee-eeee-eeee-ffffffffffff",
          account: "123456789012",
          time: "2022-08-05T16:19:03Z",
          region: "us-east-1",
          resources: ["arn:aws:lambda:us-east-1:123456789012:function:foo"],
          "trace-header":
            "X-Amzn-Trace-Id: Root=1-5759e988-bd862e3fe1be46a994272793;Parent=53995c3f42cd8ad8;Sampled=1",
        });
      });
    },
    null
  );

  test("Call Lambda AWS SDK put event to bus with reference", (parent) => {
    // Necessary to keep the bundle small and stop the test from failing.
    // See https://github.com/functionless/functionless/pull/122
    const putEvents = $AWS.EventBridge.putEvents;
    const func = functionWithOwnRole(parent, async () => {
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
    });

    bus.resource.grantPutEventsTo(func.resource);

    return func;
  }, 0);

  // See https://github.com/functionless/functionless/pull/122
  test.skip("Call Lambda AWS SDK put event to bus without reference", (parent) => {
    return functionWithOwnRole(parent, async () => {
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
    });
  }, 0);

  test(
    "Call Lambda AWS SDK put event to bus with in closure reference",
    (parent) => {
      return functionWithOwnRole(parent, async () => {
        const busbus = bus;
        await busbus.putEvents({
          "detail-type": "anyDetail",
          source: "anySource",
          detail: {},
        });
      });
    },
    null
  );

  test(
    "Call Lambda AWS SDK integration from destructured object",
    (parent) => {
      const buses = { bus };
      return functionWithOwnRole(parent, async () => {
        const { bus } = buses;
        await bus.putEvents({
          "detail-type": "anyDetail",
          source: "anySource",
          detail: {},
        });
      });
    },
    null
  );

  test(
    "Call Lambda invoke client",
    (parent) =>
      functionWithOwnRole(parent, async () => {
        return stringFunction();
      }),
    "hi"
  );

  test(
    "Call Lambda invoke client with promise.all",
    (parent) =>
      functionWithOwnRole(parent, async () => {
        const promises = [stringFunction(), stringFunction(), stringFunction()];
        await Promise.all(promises);
        return "DONE";
      }),
    "DONE"
  );

  test(
    "Call Lambda invoke client with chained promises",
    (parent) => {
      return functionWithOwnRole(parent, async () => {
        await stringFunction()
          .then(() => stringFunction())
          .then(() => stringFunction());
        return "DONE";
      });
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
      return functionWithOwnRole(parent, async () => {
        await stringStepFunction({});
        return "started!";
      });
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
      return functionWithSharedRole(parent, async () => {
        return {
          string: token,
          object: token2 as unknown as typeof obj,
          nested: nestedToken as unknown as typeof obj2,
          number: numberToken,
          list: listToken,
          nestedList: nestedListToken,
        };
      });
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
        removalPolicy: RemovalPolicy.DESTROY,
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

      return functionWithOwnRole(parent, async () => {
        await get({
          Table: flTable,
          Key: {
            key: { S: "hi" },
          },
        });
      });
    },
    null
  );

  test(
    "serialize entire function",
    (parent) => {
      return functionWithOwnRole(parent, async () => {
        const hello = stringFunction;
        return hello();
      });
    },
    "hi"
  );

  test(
    "serialize token with nested string",
    (parent) => {
      const obj = { key: table.tableArn };
      const token = Token.asAny(obj);

      return {
        func: functionWithOwnRole(parent, async () => {
          return (token as unknown as typeof obj).key;
        }),
        outputs: { table: table.tableArn },
      };
    },
    (outputs, result) => {
      return expect(result).toEqual(outputs.table);
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

      return functionWithSharedRole(parent, async () => {
        return (token as unknown as typeof obj).key;
      });
    },
    "value"
  );

  test(
    "step function integration and wait for completion",
    (parent) => {
      return functionWithOwnRole(parent, async () => {
        const result = await stringStepFunction({});
        let status = "RUNNING";
        while (true) {
          const state = await stringStepFunction.describeExecution(
            result.executionArn
          );
          status = state.status;
          if (status !== "RUNNING") {
            return state.output;
          }
          // wait for 100 ms
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      });
    },
    `"hi"`
  );

  test("import", (parent) => {
    return functionWithSharedRole(parent, async () => {
      console.log("hi");
      return (await axios.get("https://google.com")).status;
    });
  }, 200);

  // Localstack doesn't support start sync
  // https://github.com/localstack/localstack/issues/5258
  test.skip(
    "express step function integration",
    (parent) => {
      const func1 = new ExpressStepFunction<undefined, string>(
        parent,
        "func1",
        { role: resourceRole },
        () => "hi"
      );
      return functionWithOwnRole(parent, async () => {
        const result = await func1({});
        return result.status === "SUCCEEDED" ? result.output : result.error;
      });
    },
    "hi"
  );

  test(
    "dynamo integration aws dynamo functions",
    (parent) => {
      const { GetItem, DeleteItem, PutItem, Query, Scan, UpdateItem } =
        $AWS.DynamoDB;
      return functionWithOwnRole(parent, async () => {
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
      });
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
      const getBus = () => bus;
      return functionWithOwnRole(parent, async () => {
        await getBus().putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      });
    },
    null
  );

  test.skip(
    "use method with call",
    (parent) => {
      const callBus = () =>
        bus.putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      return functionWithOwnRole(parent, async () => {
        await callBus();
      });
    },
    null
  );

  test.skip(
    "use dynamic method with call",
    (parent) => {
      const bus2 = new EventBus(parent, "bus2");
      const callBus = (bool: boolean) =>
        (bool ? bus : bus2).putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      return functionWithOwnRole(parent, async () => {
        await callBus(true);
        await callBus(false);
      });
    },
    null
  );

  test.skip(
    "use dynamic method with call once",
    (parent) => {
      const bus2 = new EventBus(parent, "bus2");
      const callBus = (bool: boolean) =>
        (bool ? bus : bus2).putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      return functionWithOwnRole(parent, async () => {
        await callBus(false);
      });
    },
    null
  );

  test.skip(
    "use dynamic method",
    (parent) => {
      const bus2 = new EventBus(parent, "bus2");
      const getBus = (bool: boolean) => (bool ? bus : bus2);
      return functionWithOwnRole(parent, async () => {
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
      });
    },
    null
  );

  test.skip(
    "use dynamic method don't call",
    (parent) => {
      const bus2 = new EventBus(parent, "bus2");
      const getBus = (bool: boolean) => (bool ? bus : bus2);
      return functionWithOwnRole(parent, async () => {
        await getBus(false).putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      });
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
      return functionWithOwnRole(parent, async () => {
        await getBus().putEvents({
          "detail-type": "detail",
          source: "lambda",
          detail: {},
        });
      });
    },
    null
  );

  test.skip("method with no integration ", (parent) => {
    const mathStuff = (a: number, b: number) => a + b;
    return functionWithOwnRole(parent, async () => {
      return mathStuff(1, 2);
    });
  }, 3);

  test.skip("chained methods", (parent) => {
    const mathStuff = (a: number, b: number) => a + b;
    const mathStuff2 = (a: number, b: number) => a + mathStuff(a, b);
    return functionWithSharedRole(parent, async () => {
      return mathStuff2(1, 2);
    });
  }, 4);

  test.skip("recursion", (parent) => {
    const mult = (a: number, b: number): number => {
      if (b <= 0) {
        return 1;
      }
      return a * mult(a, b - 1);
    };
    return functionWithSharedRole(parent, async () => {
      return mult(2, 3);
    });
  }, 8);

  test.skip("nested closured methods", (parent) => {
    const callMe = (a: number, b: number): number => {
      const helper = () => {
        return a * 2;
      };

      return helper() + b;
    };
    return functionWithSharedRole(parent, async () => {
      return callMe(2, 3);
    });
  }, 7);

  test.skip(
    "chained with integration",
    (parent) => {
      const callFunction = () => stringFunction();
      const callFunction2 = () => callFunction();
      return functionWithOwnRole(parent, async () => {
        return callFunction2();
      });
    },
    "hello"
  );

  test.skip(
    "nested with integration",
    (parent) => {
      const callFunction = async () => {
        const helper = async () => `formatted ${await stringFunction()}`;
        return helper();
      };
      return functionWithOwnRole(parent, async () => {
        return callFunction();
      });
    },
    "formatted hello"
  );

  test.skip(
    "recursion with integration",
    (parent) => {
      const callFunction = async (n: number): Promise<string> => {
        if (n === 0) {
          return `${n}`;
        }
        return (await callFunction(n - 1)) + (await stringFunction());
      };
      return functionWithOwnRole(parent, async () => {
        return callFunction(3);
      });
    },
    "0hellohellohello"
  );
});

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
    `Cannot initialize new CDK resources in a runtime function.`
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
    "Cannot initialize new CDK resources in a runtime function."
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
