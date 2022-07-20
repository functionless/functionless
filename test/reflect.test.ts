import {
  BinaryExpr,
  CallExpr,
  ExprStmt,
  FunctionDecl,
  FunctionExpr,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  reflect,
  ReturnStmt,
  StringLiteralExpr,
  UndefinedLiteralExpr,
} from "../src";
import { assertNodeKind } from "../src/assert";

test("function", () => {
  assertNodeKind<FunctionExpr>(
    reflect(() => {}),
    "FunctionExpr"
  );
});

test("function decl", () => {
  assertNodeKind<FunctionDecl>(reflect(foo), "FunctionDecl");
  function foo() {}
});

test("turns a single line function into a return", () => {
  const fn = assertNodeKind<FunctionExpr>(
    reflect(() => ""),
    "FunctionExpr"
  );

  expect(fn.body.statements[0].kind).toEqual("ReturnStmt");
});

test("returns a string", () => {
  const fn = assertNodeKind<FunctionExpr>(
    reflect(() => ""),
    "FunctionExpr"
  );
  expect(
    assertNodeKind<ReturnStmt>(fn.body.statements[0], "ReturnStmt").expr.kind
  ).toEqual("StringLiteralExpr");
});

test("parenthesis", () => {
  const fn = assertNodeKind<FunctionExpr>(
    reflect(() => {
      ("");
    }),
    "FunctionExpr"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<StringLiteralExpr>(expr.expr, "StringLiteralExpr");
});

test("parenthesis are respected", () => {
  const fn = assertNodeKind<FunctionExpr>(
    reflect(() => {
      2 + (1 + 2);
    }),
    "FunctionExpr"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  const bin = assertNodeKind<BinaryExpr>(expr.expr, "BinaryExpr");
  assertNodeKind<NumberLiteralExpr>(bin.left, "NumberLiteralExpr");
  assertNodeKind<BinaryExpr>(bin.right, "BinaryExpr");
});

test("parenthesis are respected inverted", () => {
  const fn = assertNodeKind<FunctionExpr>(
    reflect(() => {
      2 + 1 + 2;
    }),
    "FunctionExpr"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  const bin = assertNodeKind<BinaryExpr>(expr.expr, "BinaryExpr");
  assertNodeKind<NumberLiteralExpr>(bin.right, "NumberLiteralExpr");
  assertNodeKind<BinaryExpr>(bin.left, "BinaryExpr");
});

test("type casting", () => {
  const fn = assertNodeKind<FunctionExpr>(
    reflect(() => {
      <any>2;
    }),
    "FunctionExpr"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<NumberLiteralExpr>(expr.expr, "NumberLiteralExpr");
});

test("type casting as", () => {
  const fn = assertNodeKind<FunctionExpr>(
    reflect(() => {
      2 as any;
    }),
    "FunctionExpr"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<NumberLiteralExpr>(expr.expr, "NumberLiteralExpr");
});

test("any function args", () => {
  const result = assertNodeKind<FunctionExpr>(
    reflect(() => {
      (<any>"").startsWith("");
    }),
    "FunctionExpr"
  );

  const expr = assertNodeKind<ExprStmt>(result.body.statements[0], "ExprStmt");
  const call = assertNodeKind<CallExpr>(expr.expr, "CallExpr");

  expect(call.args).toHaveLength(1);
  expect(call.getArgument("searchString")).toBeUndefined();
});

test("named function args", () => {
  const result = assertNodeKind<FunctionExpr>(
    reflect(() => {
      "".startsWith("");
    }),
    "FunctionExpr"
  );

  const expr = assertNodeKind<ExprStmt>(result.body.statements[0], "ExprStmt");
  const call = assertNodeKind<CallExpr>(expr.expr, "CallExpr");

  expect(call.getArgument("searchString")?.expr?.kind).toEqual(
    "StringLiteralExpr"
  );
});

test("null", () => {
  const result = assertNodeKind<FunctionExpr>(
    reflect(() => null),
    "FunctionExpr"
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    "ReturnStmt"
  );
  assertNodeKind<NullLiteralExpr>(ret.expr, "NullLiteralExpr");
});

test("undefined", () => {
  const result = assertNodeKind<FunctionExpr>(
    reflect(() => undefined),
    "FunctionExpr"
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    "ReturnStmt"
  );
  assertNodeKind<UndefinedLiteralExpr>(ret.expr, "UndefinedLiteralExpr");
});

test("computed object name", () => {
  const result = assertNodeKind<FunctionExpr>(
    reflect(() => {
      const name = "aName";
      return {
        [name]: "value",
      };
    }),
    "FunctionExpr"
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[1],
    "ReturnStmt"
  );
  const obj = assertNodeKind<ObjectLiteralExpr>(ret.expr, "ObjectLiteralExpr");
  obj.properties;
});
