import { App, aws_events, CfnOutput, Stack } from "aws-cdk-lib";
import { clientConfig, deployStack } from "./localstack";
import { EventBus, Function } from "../src";
import { Lambda, CloudFormation } from "aws-sdk";
import { Construct } from "constructs";

jest.setTimeout(500000);

// const CF = new CloudFormation(clientConfig);
const lambda = new Lambda(clientConfig);
const CF = new CloudFormation(clientConfig);
let stack: Stack;
let app: App;

const tests: ResourceTest[] = [];
// will be set in the before all
let testContexts: any[];

// Inspiration: https://github.com/aws/aws-cdk/pull/18667#issuecomment-1075348390
beforeAll(async () => {
  app = new App();
  stack = new Stack(app, "testStack2", {
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

testResource(
  "Call Lambda",
  (parent) => {
    new Function(parent, "func2", async (event) => event, {
      functionName: "func2",
    });
  },
  async () => {
    await testFunction("func2", {}, {});
  }
);

testResource(
  "Call Lambda from closure",
  (parent) => {
    const create = () =>
      new Function(parent, "function", async (event) => event, {
        functionName: "func3",
      });
    create();
  },
  async () => {
    await testFunction("func3", {}, {});
  }
);

testResource(
  "Call Lambda from closure with variables",
  (parent) => {
    const create = () => {
      const val = "a";
      new Function(parent, "function", async () => val, {
        functionName: "func4",
      });
    };

    create();
  },
  async () => {
    await testFunction("func4", {}, "a");
  }
);

testResource(
  "Call Lambda from closure with parameter",
  (parent) => {
    const create = (val: string) => {
      new Function(parent, "func5", async () => val, {
        functionName: "func5",
      });
    };

    create("b");
  },
  async () => {
    await testFunction("func5", {}, "b");
  }
);

testResource(
  "Call Lambda from closure with parameter multiple",
  (parent) => {
    const create = (id: string, val: string) => {
      new Function(parent, id, async () => val, {
        functionName: id,
      });
    };

    create("func6", "c");
    create("func7", "d");
  },
  async () => {
    await testFunction("func6", {}, "c");
    await testFunction("func7", {}, "d");
  }
);

testResource(
  "Call Lambda with object",
  (parent) => {
    const create = () => {
      const obj = { val: 1 };
      new Function(parent, "function", async () => obj.val, {
        functionName: "func8",
      });
    };

    create();
  },
  async () => {
    await testFunction("func8", {}, 1);
  }
);

testResource(
  "Call Lambda with math",
  (parent) => {
    const create = () => {
      new Function(
        parent,
        "function",
        async () => {
          const v1 = 1 + 2; // 3
          const v2 = v1 * 3; // 9
          return v2 - 4; // 5
        },
        {
          functionName: "func9",
        }
      );
    };

    create();
  },
  async () => {
    await testFunction("func9", {}, 5);
  }
);

testResource(
  "Call Lambda payload",
  (parent) => {
    const create = () => {
      new Function(
        parent,
        "function",
        async (event: { val: string }) => {
          return `value: ${event.val}`;
        },
        {
          functionName: "func10",
        }
      );
    };

    create();
  },
  async () => {
    await testFunction("func10", { val: "hi" }, "value: hi");
  }
);

testResource(
  "Call Lambda throw error",
  (parent) => {
    const create = () => {
      new Function(
        parent,
        "function",
        async () => {
          throw Error("AHHHHHHHHH");
        },
        {
          functionName: "func11",
        }
      );
    };

    create();
  },
  async () => {
    await testFunction(
      "func11",
      {},
      { errorMessage: "AHHHHHHHHH", errorType: "Error" }
    );
  }
);

testResource(
  "Call Lambda put event to bus",
  (parent) => {
    const create = () => {
      const bus = new EventBus(parent, "bus");
      const busbus = new aws_events.EventBus(parent, "busbus");
      const func = new Function(
        parent,
        "function",
        async () => {
          return `${bus.eventBusArn} ${busbus.eventBusArn}`;
        },
        {
          functionName: "func12",
        }
      );

      return { bus, busbus, func };
    };

    const res = create();

    return {
      busOutput: new CfnOutput(parent, "out1", {
        value: res.bus.eventBusArn,
        exportName: "busOut",
      }).exportName,
      busbusOutput: new CfnOutput(parent, "out2", {
        value: res.busbus.eventBusArn,
        exportName: "busbusOut",
      }).exportName,
    };
  },
  async (context) => {
    const stackOutputs = (
      await CF.describeStacks({ StackName: stack.stackName }).promise()
    ).Stacks?.[0].Outputs;
    const busOut = stackOutputs?.find(
      (o) => o.ExportName === context.busOutput
    );
    const busBusOut = stackOutputs?.find(
      (o) => o.ExportName === context.busbusOutput
    );
    await testFunction(
      "func12",
      {},
      `${busOut?.OutputValue} ${busBusOut?.OutputValue}`
    );
  }
);

// Leave me at the end please.
tests.forEach(({ name, test: testFunc }, i) => {
  test(name, () => testFunc(testContexts[i]));
});
