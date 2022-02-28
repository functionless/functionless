import "jest";
import { reflect } from "../src";
import { Function } from "../src";
import { returnExpr, testCase } from "./util";

interface Item {
  id: string;
  name: number;
}

const fn1 = new Function<(arg: string) => Item>(null as any);
const fn2 = new Function<(arg: string, optional?: string) => Item>(null as any);

test("call function", () =>
  testCase(
    reflect((arg: string) => {
      return fn1(arg);
    }),
    `#set($v1 = {})
$util.qr($v1.put('arg', $context.arguments.arg))
#set($v2 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $v1})
${returnExpr("$util.toJson($v2)")}`
  ));

test("call function omitting optional arg", () =>
  testCase(
    reflect((arg: string) => {
      return fn2(arg);
    }),
    `#set($v1 = {})
$util.qr($v1.put('arg', $context.arguments.arg))
$util.qr($v1.put('optional', $null))
#set($v2 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $v1})
${returnExpr("$util.toJson($v2)")}`
  ));

test("call function including optional arg", () =>
  testCase(
    reflect((arg: string) => {
      return fn2(arg, "hello");
    }),
    `#set($v1 = {})
$util.qr($v1.put('arg', $context.arguments.arg))
$util.qr($v1.put('optional', 'hello'))
#set($v2 = {\"version\": \"2018-05-29\", \"operation\": \"Invoke\", \"payload\": $v1})
${returnExpr("$util.toJson($v2)")}`
  ));
