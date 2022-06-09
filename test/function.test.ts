import { App, aws_lambda, Stack } from "aws-cdk-lib";
import "jest";
import { Function, AppsyncContext, reflect } from "../src";
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
    })
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
    })
  ));

test("call function omitting optional arg", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn2(context.arguments);
    })
  ));

test("call function including optional arg", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn2({ arg: context.arguments.arg, optional: "hello" });
    })
  ));

test("call function including with no parameters", () =>
  appsyncTestCase(
    reflect(() => {
      return fn3();
    })
  ));

test("call function including with void result", () =>
  appsyncTestCase(
    reflect((context: AppsyncContext<{ arg: string }>) => {
      return fn4(context.arguments);
    })
  ));

test("function inline arrow closure", () => {
  new Function(stack, "inline", async (p: string) => p);
});

test("function block closure", () => {
  new Function(stack, "block", async (p: string) => {
    return p;
  });
});
