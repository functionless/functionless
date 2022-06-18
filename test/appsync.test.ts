import { Stack } from "aws-cdk-lib";
import { AppsyncContext, AppsyncResolver, reflect, StepFunction } from "../src";
import { appsyncTestCase, testAppsyncVelocity } from "./util";

let stack: Stack;
beforeEach(() => {
  stack = new Stack();
});

describe("step function integration", () => {
  test("machine with no parameters", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    const templates = appsyncTestCase(
      reflect(() => {
        machine({});
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
      () => {}
    );

    const templates = appsyncTestCase(
      reflect(() => {
        machine({ input: { id: "1" } });
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
      () => {}
    );

    const templates = appsyncTestCase(
      reflect((context: AppsyncContext<{ id: string }>) => {
        machine({ input: { id: context.arguments.id } });
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
    const machine = new StepFunction(stack, "machine", () => {});

    const templates = appsyncTestCase(
      reflect((context: AppsyncContext<{ id: string }>) => {
        machine({ name: context.arguments.id });
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
    const machine = new StepFunction(stack, "machine", () => {});

    new AppsyncResolver<{ id: string }, void>((context) => {
      machine({ traceHeader: context.arguments.id });
    });
  });

  test("machine describe exec", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    const templates = appsyncTestCase(
      reflect(() => {
        const exec = "exec1";
        machine.describeExecution(exec);
      })
    );

    testAppsyncVelocity(templates[1]);
  });
});

describe("step function describe execution", () => {
  test("machine describe exec string", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    const templates = appsyncTestCase(
      reflect(() => {
        machine.describeExecution("exec1");
      })
    );

    testAppsyncVelocity(templates[1]);
  });

  test("machine with trace header", () => {
    const machine = new StepFunction(stack, "machine", () => {});
    new AppsyncResolver<{ id: string }, void>((context) => {
      machine({ traceHeader: context.arguments.id });
    });
  });
});

test("multiple isolated integrations", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      machine.describeExecution("exec1");
      machine.describeExecution("exec2");
      machine.describeExecution("exec3");
      machine.describeExecution("exec4");
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
    reflect(() => {
      const res1 = machine({ input: {} });
      const res2 = machine({ input: res1 });
      machine({ input: res2 });
    })
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations pre-compute", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      const x = "y";
      const res1 = machine({ input: { x } });
      const res2 = machine({ input: res1 });
      machine({ input: res2 });
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
    reflect(() => {
      const res1 = machine({ input: {} });
      const res2 = machine({ input: res1 });
      const result = machine({ input: res2 });
      return result.startDate;
    })
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations with props", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      const res1 = machine.describeExecution("exec1");
      const res2 = machine.describeExecution(res1.executionArn);
      machine.describeExecution(res2.executionArn);
    }),
    {
      expectedTemplateCount: 8,
    }
  );

  testAppsyncVelocity(templates[1]);
});

// https://github.com/functionless/functionless/issues/212
test.skip("multiple nested integrations", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      machine({ input: machine({ input: machine({ input: {} }) }) });
    }),
    {
      expectedTemplateCount: 8,
    }
  );

  testAppsyncVelocity(templates[1]);
});

// https://github.com/functionless/functionless/issues/212
test.skip("multiple nested integrations prop access", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      machine.describeExecution(
        machine.describeExecution(
          machine.describeExecution("exec1").executionArn
        ).executionArn
      );
    }),
    {
      expectedTemplateCount: 8,
    }
  );

  testAppsyncVelocity(templates[1]);
});

test("multiple linked integrations with mutation", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  const templates = appsyncTestCase(
    reflect(() => {
      const res1 = machine.describeExecution("exec1");
      const formatted = `status: ${res1.status}`;
      machine({ input: { x: formatted } });
    })
  );

  testAppsyncVelocity(templates[1]);
});
