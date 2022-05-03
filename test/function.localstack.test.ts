import { clientConfig, deployStack, localstackTestSuite } from "./localstack";
import { $AWS, EventBus, Function } from "../src";
import { Lambda } from "aws-sdk";
import { aws_events, Stack } from "aws-cdk-lib";

const lambda = new Lambda(clientConfig);

localstackTestSuite("functionStack", (testResource, _stack, app) => {
  testResource(
    "Call Lambda",
    (parent) => {
      const func = new Function(parent, "func2", async (event) => event);

      return {
        outputs: {
          functionName: func.resource.functionName,
        },
      };
    },
    async (context) => {
      await testFunction(context.functionName, {}, {});
    }
  );

  testResource(
    "Call Lambda from closure",
    (parent) => {
      const create = () =>
        new Function(parent, "function", async (event) => event);

      return { outputs: { function: create().resource.functionName } };
    },
    async (context) => {
      await testFunction(context.function, {}, {});
    }
  );

  testResource(
    "Call Lambda from closure with variables",
    (parent) => {
      const create = () => {
        const val = "a";
        return new Function(parent, "function", async () => val);
      };

      return { outputs: { function: create().resource.functionName } };
    },
    async (context) => {
      await testFunction(context.function, {}, "a");
    }
  );

  testResource(
    "Call Lambda from closure with parameter",
    (parent) => {
      const create = (val: string) => {
        return new Function(parent, "func5", async () => val);
      };

      return { outputs: { function: create("b").resource.functionName } };
    },
    async (context) => {
      await testFunction(context.function, {}, "b");
    }
  );

  testResource(
    "Call Lambda from closure with parameter multiple",
    (parent) => {
      const create = (id: string, val: string) => {
        return new Function(parent, id, async () => val);
      };

      return {
        outputs: {
          function1: create("func6", "c").resource.functionName,
          function2: create("func7", "d").resource.functionName,
        },
      };
    },
    async (context) => {
      await testFunction(context.function1, {}, "c");
      await testFunction(context.function2, {}, "d");
    }
  );

  testResource(
    "Call Lambda with object",
    (parent) => {
      const create = () => {
        const obj = { val: 1 };
        return new Function(parent, "function", async () => obj.val);
      };

      return { outputs: { function: create().resource.functionName } };
    },
    async (context) => {
      await testFunction(context.function, {}, 1);
    }
  );

  testResource(
    "Call Lambda with math",
    (parent) => {
      const func = new Function(parent, "function", async () => {
        const v1 = 1 + 2; // 3
        const v2 = v1 * 3; // 9
        return v2 - 4; // 5
      });

      return {
        outputs: { function: func.resource.functionName },
      };
    },
    async (context) => {
      await testFunction(context.function, {}, 5);
    }
  );

  testResource(
    "Call Lambda payload",
    (parent) => {
      const func = new Function(
        parent,
        "function",
        async (event: { val: string }) => {
          return `value: ${event.val}`;
        }
      );

      return { outputs: { function: func.resource.functionName } };
    },
    async (context) => {
      await testFunction(context.function, { val: "hi" }, "value: hi");
    }
  );

  testResource(
    "Call Lambda throw error",
    (parent) => {
      const func = new Function(parent, "function", async () => {
        throw Error("AHHHHHHHHH");
      });

      return {
        outputs: {
          function: func.resource.functionName,
        },
      };
    },
    async (context) => {
      await testFunction(
        context.function,
        {},
        { errorMessage: "AHHHHHHHHH", errorType: "Error" }
      );
    }
  );

  testResource(
    "Call Lambda put event to bus",
    (parent) => {
      const bus = new EventBus(parent, "bus");
      const busbus = new aws_events.EventBus(parent, "busbus");
      const func = new Function(parent, "function", async () => {
        return `${bus.eventBusArn} ${busbus.eventBusArn}`;
      });

      return {
        outputs: {
          bus: bus.eventBusArn,
          busbus: busbus.eventBusArn,
          function: func.resource.functionName,
        },
      };
    },
    async (context) => {
      await testFunction(
        context.function,
        {},
        `${context.bus} ${context.busbus}`
      );
    }
  );

  testResource(
    "Call Lambda AWS SDK put event to bus with reference",
    (parent) => {
      const bus = new EventBus<any>(parent, "bus");

      // Necessary to keep the bundle small and stop the test from failing.
      // See https://github.com/sam-goodwin/functionless/pull/103#issuecomment-1116396779
      const putEvents = $AWS.EventBridge.putEvents;
      const func = new Function(parent, "function", async () => {
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
      });

      return { outputs: { function: func.resource.functionName } };
    },
    async (context) => {
      await testFunction(context.function, {}, 0);
    }
  );

  // See https://github.com/sam-goodwin/functionless/pull/103#issuecomment-1116396779
  testResource.skip(
    "Call Lambda AWS SDK put event to bus without reference",
    (parent) => {
      const bus = new EventBus<any>(parent, "bus");

      const func = new Function(parent, "function", async () => {
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
      });

      return { outputs: { function: func.resource.functionName } };
    },
    async (context) => {
      await testFunction(context.function, {}, 0);
    }
  );

  test("should not create new resources in lambda", async () => {
    await expect(
      async () => {
        const stack = new Stack();
        new Function(stack, "function", async () => {
          const bus = new aws_events.EventBus(stack, "busbus");
          return bus.eventBusArn;
        });
        await deployStack(app, stack);
      }
      // TODO: add error message
    ).toThrow();
  });

  test("should not create new functionless resources in lambda", async () => {
    await expect(
      async () => {
        const stack = new Stack();
        new Function(stack, "function", async () => {
          const bus = new EventBus(stack, "busbus");
          return bus.eventBusArn;
        });
        await deployStack(app, stack);
      }
      // TODO: add error message
    ).toThrow();
  });

  testResource(
    "Call Lambda invoke client",
    (parent) => {
      const func1 = new Function<undefined, string>(
        parent,
        "func1",
        async () => "hi"
      );
      const func2 = new Function(parent, "function", async () => {
        // TODO should be awaited?
        return func1();
      });

      return {
        outputs: {
          function: func2.resource.functionName,
        },
      };
    },
    async (context) => {
      await testFunction(context.function, {}, "hi");
    }
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
