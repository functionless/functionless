import "jest";
import { parseSExpr, reflect } from "../src";

test("s-expression isomorphism", () => {
  function foo(...args: any[]) {
    return args;
  }
  const ast = reflect(function bar(a: string, { b: c }: any) {
    return foo([a, c]);
  });

  expect(parseSExpr(ast?.toSExpr()!)).toEqual(ast);
});
