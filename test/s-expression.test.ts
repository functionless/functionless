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
  if (isNode(self) && isNode(other)) {
    if (self.kind === other.kind) {
      return Array.from(self._arguments).every((thisArg, i) =>
        equals(thisArg, other._arguments[i])
      );
    } else {
      return false;
    }
  } else if (Array.isArray(self) && Array.isArray(other)) {
    return self.every((a, i) => equals(a, other[i]));
  } else {
    return self === other;
  }
}
