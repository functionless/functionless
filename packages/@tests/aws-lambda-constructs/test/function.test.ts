import { App, aws_dynamodb, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import {
  AsyncFunctionResponseEvent,
  AsyncResponseFailure,
  AsyncResponseSuccess,
  asyncSynth,
  Function,
} from "@functionless/aws-lambda-constructs";
import { Table } from "@functionless/aws-dynamodb-constructs";
import { EventBus } from "@functionless/aws-events-constructs";

import { appsyncTestCase } from "@functionless/test";
import { AppsyncContext } from "@functionless/aws-appsync-constructs";

interface Item {
  id: string;
  name: number;
}

let app: App;
let stack: Stack;
let lambda: aws_lambda.Function;
let table: Table<any, any, any>;

beforeEach(() => {
  app = new App({ autoSynth: false });
  stack = new Stack(app, "stack");

  lambda = new aws_lambda.Function(stack, "F", {
    code: aws_lambda.Code.fromInline(
      "exports.handler = function() { return null; }"
    ),
    handler: "index.handler",
    runtime: aws_lambda.Runtime.NODEJS_14_X,
  });
  table = new Table(stack, "T", {
    partitionKey: {
      name: "id",
      type: aws_dynamodb.AttributeType.STRING,
    },
  });
});

test("call function", () => {
  const fn1 = Function.fromFunction<{ arg: string }, Item>(lambda);

  appsyncTestCase((context: AppsyncContext<{ arg: string }>) => {
    return fn1(context.arguments);
  });
});

test("call function and conditional return", () => {
  const fn1 = Function.fromFunction<{ arg: string }, Item>(lambda);

  appsyncTestCase(async (context: AppsyncContext<{ arg: string }>) => {
    const result = await fn1(context.arguments);

    if (result.id === "sam") {
      return true;
    } else {
      return false;
    }
  });
});

test("call function omitting optional arg", () => {
  const fn2 = Function.fromFunction<{ arg: string; optional?: string }, Item>(
    lambda
  );
  appsyncTestCase((context: AppsyncContext<{ arg: string }>) => {
    return fn2(context.arguments);
  });
});

test("call function including optional arg", () => {
  const fn2 = Function.fromFunction<{ arg: string; optional?: string }, Item>(
    lambda
  );

  appsyncTestCase((context: AppsyncContext<{ arg: string }>) => {
    return fn2({ arg: context.arguments.arg, optional: "hello" });
  });
});

test("call function including with no parameters", () => {
  const fn3 = Function.fromFunction<undefined, Item>(lambda);

  appsyncTestCase(() => {
    return fn3();
  });
});

test("call function including with void result", () => {
  const fn4 = Function.fromFunction<{ arg: string }, void>(lambda);

  appsyncTestCase((context: AppsyncContext<{ arg: string }>) => {
    return fn4(context.arguments);
  });
});

test("set on success bus", () => {
  const bus = new EventBus<AsyncFunctionResponseEvent<string, void>>(
    stack,
    "bus"
  );
  const func = new Function<string, void>(
    stack,
    "func2",
    {
      onSuccess: bus,
    },
    async () => {}
  );

  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnSuccessProperty>(
      (<aws_lambda.CfnEventInvokeConfig.DestinationConfigProperty>(
        (<aws_lambda.CfnEventInvokeConfig>(
          (<aws_lambda.EventInvokeConfig>(
            func.resource.node.tryFindChild("EventInvokeConfig")
          ))?.node?.tryFindChild("Resource")
        ))?.destinationConfig
      ))?.onSuccess
    )).destination
  ).toEqual(bus.resource.eventBusArn);
});

test("set on failure bus", () => {
  const bus = new EventBus<AsyncFunctionResponseEvent<string, void>>(
    stack,
    "bus2"
  );
  const func = new Function<string, void>(
    stack,
    "func3",
    {
      onFailure: bus,
    },
    async () => {}
  );

  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnFailureProperty>(
      (<aws_lambda.CfnEventInvokeConfig.DestinationConfigProperty>(
        (<aws_lambda.CfnEventInvokeConfig>(
          (<aws_lambda.EventInvokeConfig>(
            func.resource.node.tryFindChild("EventInvokeConfig")
          ))?.node?.tryFindChild("Resource")
        ))?.destinationConfig
      ))?.onFailure
    )).destination
  ).toEqual(bus.resource.eventBusArn);
});

test("set on success function", () => {
  const onSuccessFunction = new Function<
    AsyncResponseSuccess<string, void>,
    void
  >(stack, "func", async () => {});
  const func = new Function<string, void>(
    stack,
    "func2",
    {
      onSuccess: onSuccessFunction,
    },
    async () => {}
  );

  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnSuccessProperty>(
      (<aws_lambda.CfnEventInvokeConfig.DestinationConfigProperty>(
        (<aws_lambda.CfnEventInvokeConfig>(
          (<aws_lambda.EventInvokeConfig>(
            func.resource.node.tryFindChild("EventInvokeConfig")
          ))?.node?.tryFindChild("Resource")
        ))?.destinationConfig
      ))?.onSuccess
    )).destination
  ).toEqual(onSuccessFunction.resource.functionArn);
});

test("set on failure function", () => {
  const onFailureFunction = new Function<AsyncResponseFailure<string>, void>(
    stack,
    "func",
    async () => {}
  );
  const func = new Function<string, void>(
    stack,
    "func3",
    {
      onFailure: onFailureFunction,
    },
    async () => {}
  );

  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnFailureProperty>(
      (<aws_lambda.CfnEventInvokeConfig.DestinationConfigProperty>(
        (<aws_lambda.CfnEventInvokeConfig>(
          (<aws_lambda.EventInvokeConfig>(
            func.resource.node.tryFindChild("EventInvokeConfig")
          ))?.node?.tryFindChild("Resource")
        ))?.destinationConfig
      ))?.onFailure
    )).destination
  ).toEqual(onFailureFunction.resource.functionArn);
});

test("configure async with functions", () => {
  const handleAsyncFunction = new Function<
    AsyncResponseFailure<string> | AsyncResponseSuccess<string, void>,
    void
  >(stack, "func", async () => {});
  const func = new Function<string, void>(stack, "func3", async () => {});

  func.enableAsyncInvoke({
    onFailure: handleAsyncFunction,
    onSuccess: handleAsyncFunction,
  });

  const config = <aws_lambda.CfnEventInvokeConfig.DestinationConfigProperty>(
    (<aws_lambda.CfnEventInvokeConfig>(
      (<aws_lambda.EventInvokeConfig>(
        func.resource.node.tryFindChild("EventInvokeConfig")
      ))?.node?.tryFindChild("Resource")
    ))?.destinationConfig
  );

  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnFailureProperty>config?.onFailure)
      .destination
  ).toEqual(handleAsyncFunction.resource.functionArn);
  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnFailureProperty>config?.onSuccess)
      .destination
  ).toEqual(handleAsyncFunction.resource.functionArn);
});

test("configure async with bus", () => {
  const bus = new EventBus<AsyncFunctionResponseEvent<string, void>>(
    stack,
    "bus2"
  );
  const func = new Function<string, void>(stack, "func3", async () => {});

  func.enableAsyncInvoke({
    onFailure: bus,
    onSuccess: bus,
  });

  const config = <aws_lambda.CfnEventInvokeConfig.DestinationConfigProperty>(
    (<aws_lambda.CfnEventInvokeConfig>(
      (<aws_lambda.EventInvokeConfig>(
        func.resource.node.tryFindChild("EventInvokeConfig")
      ))?.node?.tryFindChild("Resource")
    ))?.destinationConfig
  );

  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnFailureProperty>config?.onFailure)
      .destination
  ).toEqual(bus.resource.eventBusArn);
  expect(
    (<aws_lambda.CfnEventInvokeConfig.OnFailureProperty>config?.onSuccess)
      .destination
  ).toEqual(bus.resource.eventBusArn);
});

test("set on success rule", () => {
  const bus = new EventBus<AsyncFunctionResponseEvent<string, void>>(
    stack,
    "bus3"
  );
  const func = new Function<string, void>(stack, "func3", async () => {});
  const onSuccess = func.onSuccess(bus, "funcSuccess");
  onSuccess.pipe(bus);

  expect(onSuccess.resource._renderEventPattern()).toEqual({
    source: ["lambda"],
    "detail-type": ["Lambda Function Invocation Result - Success"],
    resources: [func.resource.functionArn],
  });
});

test("set on failure rule", () => {
  const bus = new EventBus<AsyncFunctionResponseEvent<string, void>>(
    stack,
    "bus3"
  );
  const func = new Function<string, void>(stack, "func3", async () => {});
  const onFailure = func.onFailure(bus, "funcFailure");
  onFailure.pipe(bus);

  expect(onFailure.resource._renderEventPattern()).toEqual({
    source: ["lambda"],
    "detail-type": ["Lambda Function Invocation Result - Failure"],
    resources: [func.resource.functionArn],
  });
});

test("onFailure().pipe should type check", () => {
  const bus = new EventBus<AsyncFunctionResponseEvent<string, void>>(
    stack,
    "bus3"
  );
  const func = new Function<number, void>(stack, "func3", async () => {});
  // @ts-expect-error
  const onFailure = func.onFailure(bus, "funcFailure");
  // @ts-expect-error
  const onSuccess = func.onSuccess(bus, "funcSuccess");
  // @ts-expect-error
  onFailure.pipe(bus);
  // @ts-expect-error
  onSuccess.pipe(bus);

  expect(onFailure.resource._renderEventPattern()).toEqual({
    source: ["lambda"],
    "detail-type": ["Lambda Function Invocation Result - Failure"],
    resources: [func.resource.functionArn],
  });
});

test("function inline arrow closure", () => {
  new Function(stack, "inline", async (p: string) => p);
});

test("function block closure", () => {
  new Function(stack, "block", async (p: string) => {
    return p;
  });
});

test("function accepts a superset of primitives", () => {
  const func1 = new Function(stack, "superset", async (p: string | number) => {
    return p;
  });

  new Function(
    stack,
    "subset",
    async (p: { sn: string | number; b: boolean; bs: boolean | string }) => {
      await func1("hello");
      await func1(1);
      await func1(p.sn);
      // @ts-expect-error - func1 accepts a string or number
      await func1(p.b);
      if (typeof p.bs === "string") {
        await func1(p.bs);
      }
    }
  );
});

test("function accepts a superset of objects", () => {
  const func1 = new Function(
    stack,
    "superset",
    async (p: { a: string } | { b: string }) => {
      return p;
    }
  );

  new Function(
    stack,
    "subset",
    async (p: {
      a: { a: string };
      b: { b: string };
      ab: { a: string } | { b: string };
      aabb: { a: string; b: string };
      c: { c: string };
      ac: { a: string; c: string };
    }) => {
      await func1(p.a);
      await func1(p.b);
      await func1(p.ab);
      await func1(p.aabb);
      // @ts-expect-error - func1 requires a or b
      await func1(p.c);
      await func1(p.ac);
    }
  );
});

test("function fails to synth when compile promise is not complete", async () => {
  expect(() => {
    new Function(
      stack,
      "superset",
      async (p: { a: string } | { b: string }) => {
        return p;
      }
    );

    app.synth();
  }).toThrow("Function closure serialization was not allowed to complete");
});

test("synth succeeds with async synth", async () => {
  new Function(stack, "superset", async (p: { a: string } | { b: string }) => {
    return p;
  });

  await asyncSynth(app);
  // synth is slow
}, 500000);

// see https://github.com/functionless/functionless/issues/458
test("$AWS.DynamoDB.* with non-ReferenceExpr Table property", () => {
  const obj = { table };
  new Function(
    stack,
    "$AWS.DynamoDB.* with non-ReferenceExpr Table property",
    async () => {
      await obj.table.attributes.put({
        Item: {
          id: {
            S: "key",
          },
          name: {
            S: "name",
          },
        },
      });
    }
  );
});

// see https://github.com/functionless/functionless/issues/458
test("$AWS.DynamoDB.* with PropAccessExpr reference to constructor parameter", () => {
  class Foo {
    constructor(props: { bookingsTable: typeof table }) {
      new Function<any, any>(stack, "Foo", async (event) => {
        await props.bookingsTable.attributes.put({
          Item: { pk: { S: event.reservation.trip_id } },
        });
      });
    }
  }
  new Foo({ bookingsTable: table });
});

test("$AWS.DynamoDB.* with ShorthandPropAssign", () => {
  new Function(
    stack,
    "$AWS.DynamoDB.* with non-ReferenceExpr Table property",
    async () => {
      await table.attributes.put({
        Item: {
          id: {
            S: "key",
          },
          name: {
            S: "name",
          },
        },
      });
    }
  );
});
