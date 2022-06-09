import { Stack } from "aws-cdk-lib";
import { AppsyncResolver, reflect, StepFunction } from "../src";
import { appsyncTestCase } from "./util";

let stack: Stack;
beforeEach(() => {
  stack = new Stack();
});

describe("step function integration", () => {
  test("machine with no parameters", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    appsyncTestCase(
      reflect(async () => {
        await machine({});
      }),
      [
        {
          index: 1,
          expected: {
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        },
      ]
    );
  });

  test("machine with static parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      async () => {}
    );

    appsyncTestCase(
      reflect(async () => {
        await machine({ input: { id: "1" } });
      }),
      [
        {
          index: 1,
          expected: {
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        },
      ]
    );
  });

  test("machine with dynamic parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      async () => {}
    );

    appsyncTestCase(
      reflect(async (context) => {
        await machine({ input: { id: context.arguments.id } });
      }),
      [
        {
          index: 1,
          context: { arguments: { id: "1" }, source: {} },
          expected: {
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        },
      ]
    );
  });

  test("machine with name", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    appsyncTestCase(
      reflect(async (context) => {
        await machine({ name: context.arguments.id });
      }),
      [
        {
          index: 1,
          context: { arguments: { id: "1" }, source: {} },
          expected: {
            match: {
              params: {
                body: {
                  stateMachineArn: machine.stateMachineArn,
                },
              },
            },
          },
        },
      ]
    );
  });

  test("machine with trace header", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    new AppsyncResolver<{ id: string }, void>(async (context) => {
      await machine({ traceHeader: context.arguments.id });
    });
  });

  test("machine describe exec", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    appsyncTestCase(
      reflect(async () => {
        const exec = "exec1";
        await machine.describeExecution(exec);
      }),
      [
        {
          index: 1,
        },
      ]
    );
  });
});

describe("step function describe execution", () => {
  test("machine describe exec string", () => {
    const machine = new StepFunction(stack, "machine", async () => {});

    const func = reflect(async () => {
      await machine.describeExecution("exec1");
    });

    appsyncTestCase(func, [
      {
        index: 1,
      },
    ]);
  });

  test("machine with trace header", () => {
    const machine = new StepFunction(stack, "machine", async () => {});
    new AppsyncResolver<{ id: string }, void>(async (context) => {
      await machine({ traceHeader: context.arguments.id });
    });
  });
});
