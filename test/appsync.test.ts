import { Stack } from "aws-cdk-lib";
import { AppsyncResolver, reflect, StepFunction } from "../src";
import { VTL } from "../src/vtl";
import {
  appsyncTestCase,
  appsyncVelocityJsonTestCase,
  getAppSyncTemplates,
} from "./util";

describe("step function integration", () => {
  let stack: Stack;
  beforeEach(() => {
    stack = new Stack();
  });
  test("machine with no parameters", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    const func = reflect(() => {
      machine({});
    });

    appsyncTestCase(
      func,
      "{}",
      `${VTL.CircuitBreaker}
#set($v1 = {})
$util.qr($v1.put('stateMachineArn', '${machine.stateMachineArn}'))
{
  "version": "2018-05-29",
  "method": "POST",
  "resourcePath": "/",
  "params": {
    "headers": {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": "AWSStepFunctions.StartExecution"
    },
    "body": $util.toJson($v1)
  }
}`,
      "{}",
      VTL.CircuitBreaker
    );

    const templates = getAppSyncTemplates(func);

    appsyncVelocityJsonTestCase(
      templates[1],
      { arguments: {}, source: {} },
      {
        result: {
          version: "2018-05-29",
          method: "POST",
          resourcePath: "/",
          params: {
            headers: {
              "content-type": "application/x-amz-json-1.0",
              "x-amz-target": "AWSStepFunctions.StartExecution",
            },
            body: {
              stateMachineArn: machine.stateMachineArn,
            },
          },
        },
      }
    );
  });

  test("machine with static parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      () => {}
    );

    const templates = getAppSyncTemplates(
      reflect(() => {
        machine({ input: { id: "1" } });
      })
    );

    appsyncVelocityJsonTestCase(
      templates[1],
      { arguments: {}, source: {} },
      {
        result: {
          version: "2018-05-29",
          method: "POST",
          resourcePath: "/",
          params: {
            headers: {
              "content-type": "application/x-amz-json-1.0",
              "x-amz-target": "AWSStepFunctions.StartExecution",
            },
            body: {
              stateMachineArn: machine.stateMachineArn,
              input: JSON.stringify({ id: "1" }),
            },
          },
        },
      }
    );
  });

  test("machine with dynamic parameters", () => {
    const machine = new StepFunction<{ id: string }, void>(
      stack,
      "machine",
      () => {}
    );

    const templates = getAppSyncTemplates(
      reflect((context) => {
        machine({ input: { id: context.arguments.id } });
      })
    );

    appsyncVelocityJsonTestCase(
      templates[1],
      { arguments: { id: "1" }, source: {} },
      {
        result: {
          version: "2018-05-29",
          method: "POST",
          resourcePath: "/",
          params: {
            headers: {
              "content-type": "application/x-amz-json-1.0",
              "x-amz-target": "AWSStepFunctions.StartExecution",
            },
            body: {
              stateMachineArn: machine.stateMachineArn,
              input: JSON.stringify({ id: "1" }),
            },
          },
        },
      }
    );
  });

  test("machine with name", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    const templates = getAppSyncTemplates(
      reflect((context) => {
        machine({ name: context.arguments.id });
      })
    );

    appsyncVelocityJsonTestCase(
      templates[1],
      { arguments: { id: "1" }, source: {} },
      {
        result: {
          version: "2018-05-29",
          method: "POST",
          resourcePath: "/",
          params: {
            headers: {
              "content-type": "application/x-amz-json-1.0",
              "x-amz-target": "AWSStepFunctions.StartExecution",
            },
            body: {
              stateMachineArn: machine.stateMachineArn,
              name: "1",
            },
          },
        },
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

    const func = reflect(() => {
      const exec = "exec1";
      machine.describeExecution(exec);
    });

    appsyncTestCase(
      func,
      "{}",
      `${VTL.CircuitBreaker}
#set($context.stash.exec = 'exec1')
{
  "version": "2018-05-29",
  "method": "POST",
  "resourcePath": "/",
  "params": {
    "headers": {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": "AWSStepFunctions.DescribeExecution"
    },
    "body": {
      "executionArn": $util.toJson($context.stash.exec)
    }
  }
}`,
      "{}",
      VTL.CircuitBreaker
    );

    const templates = getAppSyncTemplates(func);

    appsyncVelocityJsonTestCase(
      templates[1],
      { arguments: {}, source: {} },
      {
        result: {
          version: "2018-05-29",
          method: "POST",
          resourcePath: "/",
          params: {
            headers: {
              "content-type": "application/x-amz-json-1.0",
              "x-amz-target": "AWSStepFunctions.DescribeExecution",
            },
            body: {
              executionArn: "exec1",
            },
          },
        },
      }
    );
  });

  test("machine describe exec string", () => {
    const machine = new StepFunction(stack, "machine", () => {});

    const func = reflect(() => {
      machine.describeExecution("exec1");
    });

    appsyncTestCase(
      func,
      "{}",
      `${VTL.CircuitBreaker}
{
  "version": "2018-05-29",
  "method": "POST",
  "resourcePath": "/",
  "params": {
    "headers": {
      "content-type": "application/x-amz-json-1.0",
      "x-amz-target": "AWSStepFunctions.DescribeExecution"
    },
    "body": {
      "executionArn": $util.toJson('exec1')
    }
  }
}`,
      "{}",
      VTL.CircuitBreaker
    );

    const templates = getAppSyncTemplates(func);

    appsyncVelocityJsonTestCase(
      templates[1],
      { arguments: {}, source: {} },
      {
        result: {
          version: "2018-05-29",
          method: "POST",
          resourcePath: "/",
          params: {
            headers: {
              "content-type": "application/x-amz-json-1.0",
              "x-amz-target": "AWSStepFunctions.DescribeExecution",
            },
            body: {
              executionArn: "exec1",
            },
          },
        },
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
