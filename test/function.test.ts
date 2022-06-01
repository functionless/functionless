import { App, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import {
  Function,
  AppsyncContext,
  reflect,
  EventBus,
  AsyncFunctionResponseEvent,
} from "../src";
import { VTL } from "../src/vtl";
import { appsyncTestCase } from "./util";

interface Item {
  id: string;
  name: number;
}

let stack: Stack;
let lambda: aws_lambda.Function;

beforeEach(() => {
  const app = new App({ autoSynth: false });
  stack = new Stack(app, "stack");

  lambda = new aws_lambda.Function(stack, "F", {
    code: aws_lambda.Code.fromInline(
      "exports.handler = function() { return null; }"
    ),
    handler: "index.handler",
    runtime: aws_lambda.Runtime.NODEJS_14_X,
  });
});

test("call function", () => {
  const fn1 = Function.fromFunction<{ arg: string }, Item>(lambda);

  return appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn1(context.arguments);
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $context.arguments})
$util.toJson($v1)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  );
});

test("call function and conditional return", () => {
  const fn1 = Function.fromFunction<{ arg: string }, Item>(lambda);

  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      const result = fn1(context.arguments);

      if (result.id === "sam") {
        return true;
      } else {
        return false;
      }
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $context.arguments})
$util.toJson($v1)`,
    // function's response mapping template
    `#set( $context.stash.result = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end
#set($v1 = $context.stash.result.id == 'sam')
#if($v1)
#set($context.stash.return__val = true)
#set($context.stash.return__flag = true)
#return($context.stash.return__val)
#else
#set($context.stash.return__val = false)
#set($context.stash.return__flag = true)
#return($context.stash.return__val)
#end`
  );
});

test("call function omitting optional arg", () => {
  const fn2 = Function.fromFunction<{ arg: string; optional?: string }, Item>(
    lambda
  );
  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn2(context.arguments);
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $context.arguments})
$util.toJson($v1)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  );
});

test("call function including optional arg", () => {
  const fn2 = Function.fromFunction<{ arg: string; optional?: string }, Item>(
    lambda
  );

  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn2({ arg: context.arguments.arg, optional: "hello" });
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
$util.qr($v1.put('arg', $context.arguments.arg))
$util.qr($v1.put('optional', 'hello'))
#set($v2 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $v1})
$util.toJson($v2)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  );
});

test("call function including with no parameters", () => {
  const fn3 = Function.fromFunction<undefined, Item>(lambda);

  return appsyncTestCase(
    reflect(() => {
      return fn3();
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $null})
$util.toJson($v1)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  );
});

test("call function including with void result", () => {
  const fn4 = Function.fromFunction<{ arg: string }, void>(lambda);

  return appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn4(context.arguments);
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $context.arguments})
$util.toJson($v1)`,
    // function's response mapping template
    `#set( $context.stash.return__flag = true )
#set( $context.stash.return__val = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end`
  );
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
  ).toEqual(bus.bus.eventBusArn);
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
  ).toEqual(bus.bus.eventBusArn);
});

test("set on success rule", () => {
  const bus = new EventBus<AsyncFunctionResponseEvent<string, void>>(
    stack,
    "bus3"
  );
  const func = new Function<string, void>(stack, "func3", async () => {});
  const onSuccess = func.onSuccess(bus, "funcSuccess");
  onSuccess.pipe(bus);

  expect(onSuccess.rule._renderEventPattern()).toEqual({
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
  const onFailure = func.onFailure(bus, "funcSuccess");
  onFailure.pipe(bus);

  expect(onFailure.rule._renderEventPattern()).toEqual({
    source: ["lambda"],
    "detail-type": ["Lambda Function Invocation Result - Failure"],
    resources: [func.resource.functionArn],
  });
});
