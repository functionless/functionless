import { FunctionDecl } from "../src";
import { VTL } from "../src/vtl";

// generates boilerplate for the circuit-breaker logic for implementing early return
export function returnExpr(varName: string) {
  return `#set($context.stash.return__val = ${varName})
#set($context.stash.return__flag = true)
#return($context.stash.return__val)`;
}

export function testCase(decl: FunctionDecl, expected: string) {
  const vtl = new VTL();
  vtl.eval(decl.body);
  const actual = vtl.toVTL();
  expect(actual).toEqual(expected);
}
