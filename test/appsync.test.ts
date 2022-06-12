import { Stack } from "aws-cdk-lib";
import {
  AppsyncResolver,
  reflect,
  ResolverFunction,
  StepFunction,
} from "../src";
import { appsyncTestCase } from "./util";

let stack: Stack;
beforeEach(() => {
  stack = new Stack();
});

describe("step function integration", () => {
  test("machine with no parameters", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    appsyncTestCase(
      reflect(() => {
        machine({});
      }),
      {
        executeTemplates: [
          {
            index: 1,
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        ],
      }
    );
  });

  test("machine with static parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      () => {}
    );

    appsyncTestCase(
      reflect(() => {
        machine({ input: { id: "1" } });
      }),
      {
        executeTemplates: [
          {
            index: 1,
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        ],
      }
    );
  });

  test("machine with dynamic parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      () => {}
    );

    appsyncTestCase(
      reflect((context) => {
        machine({ input: { id: context.arguments.id } });
      }),
      {
        executeTemplates: [
          {
            index: 1,
            context: { arguments: { id: "1" }, source: {} },
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        ],
      }
    );
  });

  test("machine with name", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    appsyncTestCase(
      reflect((context) => {
        machine({ name: context.arguments.id });
      }),
      {
        executeTemplates: [
          {
            index: 1,
            context: { arguments: { id: "1" }, source: {} },
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        ],
      }
    );
  });

  test("machine with trace header", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    new AppsyncResolver<{ id: string }, void>((context) => {
      machine({ traceHeader: context.arguments.id });
    });
  });

  test("machine describe exec", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    appsyncTestCase(
      reflect(() => {
        const exec = "exec1";
        machine.describeExecution(exec);
      }),
      {
        executeTemplates: [
          {
            index: 1,
          },
        ],
      }
    );
  });
});

describe("step function describe execution", () => {
  test("machine describe exec string", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    appsyncTestCase(
      reflect(() => {
        machine.describeExecution("exec1");
      }),
      {
        expectedTemplateCount: 4,
        executeTemplates: [
          {
            index: 1,
          },
        ],
      }
    );
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

  appsyncTestCase(
    reflect(() => {
      machine.describeExecution("exec1");
      machine.describeExecution("exec2");
      machine.describeExecution("exec3");
      machine.describeExecution("exec4");
    }),
    {
      expectedTemplateCount: 10,
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});

test("multiple linked integrations", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  appsyncTestCase(
    reflect(() => {
      const res1 = machine({ input: {} });
      const res2 = machine({ input: res1 });
      machine({ input: res2 });
    }),
    {
      expectedTemplateCount: 8,
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});

test("multiple linked integrations pre-compute", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  appsyncTestCase(
    reflect(() => {
      const x = "y";
      const res1 = machine({ input: { x } });
      const res2 = machine({ input: res1 });
      machine({ input: res2 });
    }),
    {
      expectedTemplateCount: 8,
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});

test("multiple linked integrations post-compute", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  appsyncTestCase(
    reflect(() => {
      const res1 = machine({ input: {} });
      const res2 = machine({ input: res1 });
      const result = machine({ input: res2 });
      return result.startDate;
    }),
    {
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});

test("multiple linked integrations with props", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  appsyncTestCase(
    reflect(() => {
      const res1 = machine.describeExecution("exec1");
      const res2 = machine.describeExecution(res1.executionArn);
      machine.describeExecution(res2.executionArn);
    }),
    {
      expectedTemplateCount: 8,
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});

// https://github.com/functionless/functionless/issues/212
test.skip("multiple nested integrations", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  appsyncTestCase(
    reflect(() => {
      machine({ input: machine({ input: machine({ input: {} }) }) });
    }),
    {
      expectedTemplateCount: 8,
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});

// https://github.com/functionless/functionless/issues/212
test.skip("multiple nested integrations prop access", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  appsyncTestCase(
    reflect(() => {
      machine.describeExecution(
        machine.describeExecution(
          machine.describeExecution("exec1").executionArn
        ).executionArn
      );
    }),
    {
      expectedTemplateCount: 8,
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});

test("multiple linked integrations with mutation", () => {
  const machine = new StepFunction(stack, "machine", () => {});

  appsyncTestCase(
    reflect(() => {
      const res1 = machine.describeExecution("exec1");
      const formatted = `status: ${res1.status}`;
      machine({ input: { x: formatted } });
    }),
    {
      expectedTemplateCount: 6,
      executeTemplates: [
        {
          index: 1,
        },
      ],
    }
  );
});
