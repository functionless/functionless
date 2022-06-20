import { Stack } from "aws-cdk-lib";
import {
  AppsyncContext,
  AppsyncResolver,
  reflect,
  StepFunction,
  Function,
} from "../src";
import { appsyncTestCase, testAppsyncVelocity } from "./util";

let stack: Stack;
beforeEach(() => {
  stack = new Stack();
});

describe("step function integration", () => {
  test("machine with no parameters", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    const templates = appsyncTestCase(
      reflect(async () => {
        await machine({});
      })
    );

    testAppsyncVelocity(templates[1], {
      resultMatch: {
        params: {
          body: {
            stateMachineArn: machine.resource.stateMachineArn,
          },
        },
      },
    });
  });

  test("machine with static parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      async () => {}
    );

    const templates = appsyncTestCase(
      reflect(async () => {
        await machine({ input: { id: "1" } });
      })
    );

    testAppsyncVelocity(templates[1], {
      resultMatch: {
        params: {
          body: {
            stateMachineArn: machine.resource.stateMachineArn,
          },
        },
      },
    });
  });

  test("machine with dynamic parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      async () => {}
    );

    const templates = appsyncTestCase(
      reflect(async (context: AppsyncContext<{ id: string }>) => {
        await machine({ input: { id: context.arguments.id } });
      })
    );

    testAppsyncVelocity(templates[1], {
      arguments: { id: "1" },
      resultMatch: {
        params: {
          body: {
            stateMachineArn: machine.resource.stateMachineArn,
          },
        },
      },
    });
  });

  test("machine with name", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    const templates = appsyncTestCase(
      reflect(async (context: AppsyncContext<{ id: string }>) => {
        await machine({ name: context.arguments.id });
      })
    );

    testAppsyncVelocity(templates[1], {
      arguments: { id: "1" },
      resultMatch: {
        params: {
          body: {
            stateMachineArn: machine.resource.stateMachineArn,
          },
        },
      },
    });
  });

  test("machine with trace header", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    new AppsyncResolver<{ id: string }, void>(async (context) => {
      await machine({ traceHeader: context.arguments.id });
    });
  });

  test("machine describe exec", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    const templates = appsyncTestCase(
      reflect(async () => {
        const exec = "exec1";
        await machine.describeExecution(exec);
      })
    );

    testAppsyncVelocity(templates[1]);
  });
});

test("machine describe exec return", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      const exec = "exec1";
      return machine.describeExecution(exec);
    })
  );

  testAppsyncVelocity(templates[1]);
});

test("machine describe exec var", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      const exec = "exec1";
      const v = machine.describeExecution(exec);
      return v;
    })
  );

  testAppsyncVelocity(templates[1]);
});

describe("step function describe execution", () => {
  test("machine describe exec string", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    const templates = appsyncTestCase(
      reflect(async () => {
        await machine.describeExecution("exec1");
      })
    );

    testAppsyncVelocity(templates[1]);
  });

  test("machine with trace header", () => {
    const machine = new StepFunction(stack, "machine", async () => {});
    new AppsyncResolver<{ id: string }, void>(async (context) => {
      await machine({ traceHeader: context.arguments.id });
    });
  });
});

test("multiple isolated integrations", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      await machine.describeExecution("exec1");
      await machine.describeExecution("exec2");
      await machine.describeExecution("exec3");
      await machine.describeExecution("exec4");
    }),
    {
      expectedTemplateCount: 10,
    }
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      const res1 = await machine({ input: {} });
      const res2 = await machine({ input: res1 });
      await machine({ input: res2 });
    })
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations pre-compute", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      const x = "y";
      const res1 = await machine({ input: { x } });
      const res2 = await machine({ input: res1 });
      await machine({ input: res2 });
    }),
    {
      expectedTemplateCount: 8,
    }
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations post-compute", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      const res1 = await machine({ input: {} });
      const res2 = await machine({ input: res1 });
      const result = await machine({ input: res2 });
      return result.startDate;
    })
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations with props", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      const res1 = await machine.describeExecution("exec1");
      const res2 = await machine.describeExecution(res1.executionArn);
      await machine.describeExecution(res2.executionArn);
    }),
    {
      expectedTemplateCount: 8,
    }
  );

  testAppsyncVelocity(templates[1]);
});

// https://github.com/functionless/functionless/issues/212
test("multiple nested integrations", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      await machine({
        input: await machine({ input: await machine({ input: {} }) }),
      });
    }),
    {
      expectedTemplateCount: 8,
    }
  );

  testAppsyncVelocity(templates[1]);
});

// https://github.com/functionless/functionless/issues/212
test("multiple nested integrations prop access", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      await machine.describeExecution(
        (
          await machine.describeExecution(
            (
              await machine.describeExecution("exec1")
            ).executionArn
          )
        ).executionArn
      );
    }),
    {
      expectedTemplateCount: 8,
    }
  );

  testAppsyncVelocity(templates[1]);
});

test("integrations separated by in", () => {
  const func = new Function(stack, "func1", async () => {
    return "key";
  });
  const func2 = new Function(stack, "func2", async () => {
    return { key: "value" };
  });

  const templates = appsyncTestCase(
    reflect(async () => {
      if ((await func({})) in (await func2({}))) {
        return true;
      }
      return false;
    }),
    {
      expectedTemplateCount: 6,
    }
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations with mutation", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(async () => {
      const res1 = await machine.describeExecution("exec1");
      const formatted = `status: ${res1.status}`;
      await machine({ input: { x: formatted } });
    })
  );

  testAppsyncVelocity(templates[1]);
});
