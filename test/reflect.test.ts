import { CallExpr, FunctionDecl, reflect, ReturnStmt } from "../src";
import { assertNodeKind } from "../src/assert";

test("function", () => expect(reflect(() => {}).kind).toEqual("FunctionDecl"));

test("turns a single line function into a return", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => ""),
    "FunctionDecl"
  );

  expect(fn.body.statements[0].kind).toEqual("ReturnStmt");
});

test("returns a string", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => ""),
    "FunctionDecl"
  );
  expect(
    assertNodeKind<ReturnStmt>(fn.body.statements[0], "ReturnStmt").expr.kind
  ).toEqual("StringLiteralExpr");
});

// TODO: Support parenthesis
test("parenthesis", () => {
  expect(() =>
    assertNodeKind<FunctionDecl>(
      reflect(() => {
        ("");
      }),
      "FunctionDecl"
    )
  ).toThrow();
});

// TODO: support any function and parenthesis
test.skip("any function args", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => {
      (<any>"").startsWith("");
    }),
    "FunctionDecl"
  );

  const call = assertNodeKind<CallExpr>(result.body.statements[0], "CallExpr");

  expect(Object.keys(call.args)).toHaveLength(1);
});
