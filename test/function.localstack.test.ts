import { clientConfig, localstackTestSuite } from "./localstack";
import {
  $AWS,
  EventBus,
  EventBusRuleInput,
  Function,
  FunctionProps,
} from "../src";
import { Lambda } from "aws-sdk";
import { aws_events, Stack, Token } from "aws-cdk-lib";
import { Construct } from "constructs";

const lambda = new Lambda(clientConfig);

// inject the localstack client config into the lambda clients
// without this configuration, the functions will try to hit AWS proper
const localstackClientConfig: FunctionProps = {
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
  const testFunctionResource: TestFunctionResource = (
    name,
    func,
    expected,
    payload
  ) => {
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

  testFunctionResource.skip = (name, _func, _expected, _payload?) =>
    testResource.skip(
      name,
      () => {},
      async () => {}
    );

  testFunctionResource(
    "Call Lambda",
    (parent) => {
      return new Function(parent, "func2", async (event) => event);
    },
    {}
  );

  testFunctionResource(
    "Call Lambda from closure",
    (parent) => {
      const create = () =>
        new Function(parent, "function", async (event) => event);

      return create();
    },
    {}
  );

  testFunctionResource(
    "Call Lambda from closure with variables",
    (parent) => {
      const create = () => {
        const val = "a";
        return new Function(parent, "function", async () => val);
      };

      return create();
    },
    "a"
  );

  testFunctionResource(
    "Call Lambda from closure with parameter",
    (parent) => {
      const create = (val: string) => {
        return new Function(parent, "func5", async () => val);
      };

      return create("b");
    },
    "b"
  );

  const create = (parent: Construct, id: string, val: string) => {
    return new Function(parent, id, async () => val);
  };

  testFunctionResource(
    "Call Lambda from closure with parameter multiple 1",
    (parent) => create(parent, "func6", "c"),
    "c"
  );

  testFunctionResource(
    "Call Lambda from closure with parameter multiple 2",
    (parent) => create(parent, "func7", "d"),
    "d"
  );

  testFunctionResource(
    "Call Lambda with object",
    (parent) => {
      const create = () => {
        const obj = { val: 1 };
        return new Function(parent, "function", async () => obj.val);
      };

      return create();
    },
    1
  );

  testFunctionResource(
    "Call Lambda with math",
    (parent) =>
      new Function(parent, "function", async () => {
        const v1 = 1 + 2; // 3
        const v2 = v1 * 3; // 9
        return v2 - 4; // 5
      }),
    5
  );

  testFunctionResource(
    "Call Lambda payload",
    (parent) =>
      new Function(parent, "function", async (event: { val: string }) => {
        return `value: ${event.val}`;
      }),
    "value: hi",
    { val: "hi" }
  );

  testFunctionResource(
    "Call Lambda throw error",
    (parent) =>
      new Function(parent, "function", async () => {
        throw Error("AHHHHHHHHH");
      }),
    { errorMessage: "AHHHHHHHHH", errorType: "Error" }
  );

  testFunctionResource(
    "Call Lambda return arns",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const busbus = new aws_events.EventBus(parent, "busbus");
      const func = new Function(parent, "function", async () => {
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
    (context) => `${context.bus} ${context.busbus}`
  );

  testFunctionResource(
    "templated tokens",
    (parent) => {
      const token = Token.asString("hello");
      return new Function(parent, "function", async () => {
        return `${token} stuff`;
      });
    },
    "hello stuff"
  );

  testFunctionResource(
    "numeric tokens",
    (parent) => {
      const token = Token.asNumber(1);
      return new Function(parent, "function", async () => {
        return token;
      });
    },
    1
  );

  testFunctionResource(
    "Call Lambda put events",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      return new Function(
        parent,
        "function",
        async () => {
          bus({
            "detail-type": "detail",
            source: "lambda",
            detail: {},
          });
        },
        localstackClientConfig
      );
    },
    null
  );

  testFunctionResource(
    "Call Lambda AWS SDK put event to bus with reference",
    (parent) => {
      const bus = new EventBus<any>(parent, "bus");

      // Necessary to keep the bundle small and stop the test from failing.
      // See https://github.com/sam-goodwin/functionless/pull/122
      const putEvents = $AWS.EventBridge.putEvents;
      const func = new Function(
        parent,
        "function",
        async () => {
          const result = putEvents({
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
        },
        localstackClientConfig
      );

      bus.bus.grantPutEventsTo(func.resource);

      return func;
    },
    0
  );

  // See https://github.com/sam-goodwin/functionless/pull/103#issuecomment-1116396779
  testFunctionResource.skip(
    "Call Lambda AWS SDK put event to bus without reference",
    (parent) => {
      const bus = new EventBus<EventBusRuleInput>(parent, "bus");

      return new Function(
        parent,
        "function",
        async () => {
          const result = $AWS.EventBridge.putEvents({
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
        },
        localstackClientConfig
      );
    },
    0
  );

  // Function serialization breaks when assigning an integration/construct to a variable in the closure.
  // TODO: what should happen here?
  testFunctionResource.skip(
    "Call Lambda AWS SDK put event to bus with in closure reference",
    (parent) => {
      const bus = new EventBus<EventBusRuleInput>(parent, "bus");
      return new Function(
        parent,
        "function",
        async () => {
          const busbus = bus;
          busbus({
            "detail-type": "anyDetail",
            source: "anySource",
            detail: {},
          });
        },
        localstackClientConfig
      );
    },
    null
  );

  test("should not create new resources in lambda", async () => {
    expect(
      async () => {
        const stack = new Stack();
        new Function(stack, "function", async () => {
          const bus = new aws_events.EventBus(stack, "busbus");
          return bus.eventBusArn;
        });
        await Promise.all(Function.promises);
      }
      // TODO: add error message
    ).rejects.toThrow();
  });

  test("should not create new functionless resources in lambda", async () => {
    expect(
      async () => {
        const stack = new Stack();
        new Function(stack, "function", async () => {
          const bus = new EventBus(stack, "busbus");
          return bus.eventBusArn;
        });
        await Promise.all(Function.promises);
      }
      // TODO: add error message
    ).rejects.toThrow();
  });

  testFunctionResource(
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
        async () => {
          // TODO should be awaited?
          return func1();
        },
        localstackClientConfig
      );
    },
    "hi"
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
