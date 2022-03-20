import { App, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import { AppsyncContext, reflect } from "../src";
import { Function } from "../src";
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

const fn1 = new Function<(arg: string) => Item>(lambda);
const fn2 = new Function<(arg: string, optional?: string) => Item>(lambda);

test("call function", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn1(context.arguments.arg);
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
$util.qr($v1.put('arg', $context.arguments.arg))
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

test("call function and conditional return", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      const result = fn1(context.arguments.arg);

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
#set($v1 = {})
$util.qr($v1.put('arg', $context.arguments.arg))
#set($v2 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $v1})
$util.toJson($v2)`,
    // function's response mapping template
    `#set( $context.stash.result = $context.result )
{}`,
    // response mapping template
    `#if($context.stash.return__flag)
  #return($context.stash.return__val)
#end
#if($context.stash.result.id == 'sam')
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
      return fn2(context.arguments.arg);
    }),
    // pipeline's request mapping template
    "{}",
    // function's request mapping template
    `${VTL.CircuitBreaker}
#set($v1 = {})
$util.qr($v1.put('arg', $context.arguments.arg))
$util.qr($v1.put('optional', $null))
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

test("call function including optional arg", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn2(context.arguments.arg, "hello");
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
