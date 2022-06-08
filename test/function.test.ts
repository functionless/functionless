import { App, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import { Function, AppsyncContext, reflect } from "../src";
import { VTL } from "../src/vtl";
import { appsyncTestCase } from "./util";

interface Item {
  id: string;
  name: number;
}

const app = new App({ autoSynth: false });
const stack = new Stack(app, "stack");

const lambda = new aws_lambda.Function(stack, "F", {
  code: aws_lambda.Code.fromInline(
    "exports.handler = function() { return null; }"
  ),
  handler: "index.handler",
  runtime: aws_lambda.Runtime.NODEJS_14_X,
});

const fn1 = Function.fromFunction<{ arg: string }, Item>(lambda);
const fn2 = Function.fromFunction<{ arg: string; optional?: string }, Item>(
  lambda
);
const fn3 = Function.fromFunction<undefined, Item>(lambda);
const fn4 = Function.fromFunction<{ arg: string }, void>(lambda);

test("call function", () =>
  appsyncTestCase(
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
  ));

test("call function and conditional return", () =>
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
  ));

test("call function omitting optional arg", () =>
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
  ));

test("call function including optional arg", () =>
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
  ));

test("call function including with no parameters", () =>
  appsyncTestCase(
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
  ));

test("call function including with void result", () =>
  appsyncTestCase(
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
  ));

test("function inline arrow closure", () => {
  new Function(stack, "inline", async (p: string) => p);
});

test("function block closure", () => {
  new Function(stack, "block", async (p: string) => {
    return p;
  });
});
