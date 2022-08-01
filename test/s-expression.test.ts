import "jest";
import { isNode, parseSExpr, reflect } from "../src";

test("s-expression isomorphism", () => {
  function foo(...args: any[]) {
    return args;
  }
  const ast = reflect(function bar(a: string, { b: c }: any) {
    return foo([a, c]);
  });

  expect(equals(parseSExpr(ast?.toSExpr()!), ast)).toEqual(true);
});

function equals(self: any, other: any): boolean {
  if (!(isNode(self) && isNode(other))) {
    return false;
  } else if (self.kind !== other.kind) {
    return false;
  } else {
    return Array.from(self._arguments).every((thisArg, i) =>
      equals(thisArg, other._arguments[i])
    );
  }

  function equals(thisArg: any, otherArg: any): boolean {
    if (isNode(thisArg) && isNode(otherArg)) {
      return equals(thisArg, otherArg);
    } else if (Array.isArray(thisArg) && Array.isArray(otherArg)) {
      return thisArg.every((a, i) => equals(a, otherArg[i]));
    }
    return thisArg === otherArg;
  }
}
