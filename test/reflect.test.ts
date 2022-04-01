import {
  BinaryExpr,
  CallExpr,
  Err,
  ExprStmt,
  FunctionDecl,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  reflect,
  ReturnStmt,
  StringLiteralExpr,
  UndefinedLiteralExpr,
} from "../src";
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

test("parenthesis", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      ("");
    }),
    "FunctionDecl"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<StringLiteralExpr>(expr.expr, "StringLiteralExpr");
});

test("parenthesis are respected", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      2 + (1 + 2);
    }),
    "FunctionDecl"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  const bin = assertNodeKind<BinaryExpr>(expr.expr, "BinaryExpr");
  assertNodeKind<NumberLiteralExpr>(bin.left, "NumberLiteralExpr");
  assertNodeKind<BinaryExpr>(bin.right, "BinaryExpr");
});

test("parenthesis are respected inverted", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      2 + 1 + 2;
    }),
    "FunctionDecl"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  const bin = assertNodeKind<BinaryExpr>(expr.expr, "BinaryExpr");
  assertNodeKind<NumberLiteralExpr>(bin.right, "NumberLiteralExpr");
  assertNodeKind<BinaryExpr>(bin.left, "BinaryExpr");
});

test("type casting", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      <any>2;
    }),
    "FunctionDecl"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<NumberLiteralExpr>(expr.expr, "NumberLiteralExpr");
});

test("type casting as", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      2 as any;
    }),
    "FunctionDecl"
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<NumberLiteralExpr>(expr.expr, "NumberLiteralExpr");
});

test("any function args", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => {
      (<any>"").startsWith("");
    }),
    "FunctionDecl"
  );

  const expr = assertNodeKind<ExprStmt>(result.body.statements[0], "ExprStmt");
  const call = assertNodeKind<CallExpr>(expr.expr, "CallExpr");

  expect(call.args).toHaveLength(1);
  expect(call.getArgument("searchString")).toBeUndefined();
});

test("named function args", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => {
      "".startsWith("");
    }),
    "FunctionDecl"
  );

  const expr = assertNodeKind<ExprStmt>(result.body.statements[0], "ExprStmt");
  const call = assertNodeKind<CallExpr>(expr.expr, "CallExpr");

  expect(call.getArgument("searchString")?.expr.kind).toEqual(
    "StringLiteralExpr"
  );
});

test("null", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => null),
    "FunctionDecl"
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    "ReturnStmt"
  );
  assertNodeKind<NullLiteralExpr>(ret.expr, "NullLiteralExpr");
});

test("undefined", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => undefined),
    "FunctionDecl"
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    "ReturnStmt"
  );
  assertNodeKind<UndefinedLiteralExpr>(ret.expr, "UndefinedLiteralExpr");
});

test("computed object name", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => {
      const name = "aName";
      return {
        [name]: "value",
      };
    }),
    "FunctionDecl"
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[1],
    "ReturnStmt"
  );
  const obj = assertNodeKind<ObjectLiteralExpr>(ret.expr, "ObjectLiteralExpr");
  obj.properties;
});

test("err", () => {
  const fn = () => {};
  const result = assertNodeKind<Err>(reflect(fn), "Err");
  expect(result.error.message).toEqual(
    "Functionless reflection only supports function parameters with bodies, no signature only declarations or references. Found fn."
  );
});
