import {
  BinaryExpr,
  CallExpr,
  ExprStmt,
  isFunctionLike,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  reflect,
  ReturnStmt,
  StringLiteralExpr,
  UndefinedLiteralExpr,
} from "../src";
import { assertNodeKind } from "../src/assert";
import { FunctionLike } from "../src/node";

test("function", () => {
  assertNodeKind(
    reflect(() => {}),
    isFunctionLike
  );
});

test("turns a single line function into a return", () => {
  const fn = assertNodeKind<FunctionLike>(
    reflect(() => ""),
    isFunctionLike
  );

  expect(fn.body.statements[0].kind).toEqual("ReturnStmt");
});

test("returns a string", () => {
  const fn = assertNodeKind<FunctionLike>(
    reflect(() => ""),
    isFunctionLike
  );
  expect(
    assertNodeKind<ReturnStmt>(fn.body.statements[0], "ReturnStmt").expr.kind
  ).toEqual("StringLiteralExpr");
});

test("parenthesis", () => {
  const fn = assertNodeKind<FunctionLike>(
    reflect(() => {
      ("");
    }),
    isFunctionLike
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<StringLiteralExpr>(expr.expr, "StringLiteralExpr");
});

test("parenthesis are respected", () => {
  const fn = assertNodeKind<FunctionLike>(
    reflect(() => {
      2 + (1 + 2);
    }),
    isFunctionLike
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  const bin = assertNodeKind<BinaryExpr>(expr.expr, "BinaryExpr");
  assertNodeKind<NumberLiteralExpr>(bin.left, "NumberLiteralExpr");
  assertNodeKind<BinaryExpr>(bin.right, "BinaryExpr");
});

test("parenthesis are respected inverted", () => {
  const fn = assertNodeKind<FunctionLike>(
    reflect(() => {
      2 + 1 + 2;
    }),
    isFunctionLike
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  const bin = assertNodeKind<BinaryExpr>(expr.expr, "BinaryExpr");
  assertNodeKind<NumberLiteralExpr>(bin.right, "NumberLiteralExpr");
  assertNodeKind<BinaryExpr>(bin.left, "BinaryExpr");
});

test("type casting", () => {
  const fn = assertNodeKind<FunctionLike>(
    reflect(() => {
      <any>2;
    }),
    isFunctionLike
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<NumberLiteralExpr>(expr.expr, "NumberLiteralExpr");
});

test("type casting as", () => {
  const fn = assertNodeKind<FunctionLike>(
    reflect(() => {
      2 as any;
    }),
    isFunctionLike
  );

  const expr = assertNodeKind<ExprStmt>(fn.body.statements[0], "ExprStmt");
  assertNodeKind<NumberLiteralExpr>(expr.expr, "NumberLiteralExpr");
});

test("any function args", () => {
  const result = assertNodeKind<FunctionLike>(
    reflect(() => {
      (<any>"").startsWith("");
    }),
    isFunctionLike
  );

  const expr = assertNodeKind<ExprStmt>(result.body.statements[0], "ExprStmt");
  const call = assertNodeKind<CallExpr>(expr.expr, "CallExpr");

  expect(call.args).toHaveLength(1);
  expect(call.getArgument("searchString")).toBeUndefined();
});

test("named function args", () => {
  const result = assertNodeKind<FunctionLike>(
    reflect(() => {
      "".startsWith("");
    }),
    isFunctionLike
  );

  const expr = assertNodeKind<ExprStmt>(result.body.statements[0], "ExprStmt");
  const call = assertNodeKind<CallExpr>(expr.expr, "CallExpr");

  expect(call.getArgument("searchString")?.expr?.kind).toEqual(
    "StringLiteralExpr"
  );
});

test("null", () => {
  const result = assertNodeKind<FunctionLike>(
    reflect(() => null),
    isFunctionLike
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    "ReturnStmt"
  );
  assertNodeKind<NullLiteralExpr>(ret.expr, "NullLiteralExpr");
});

test("undefined", () => {
  const result = assertNodeKind<FunctionLike>(
    reflect(() => undefined),
    isFunctionLike
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    "ReturnStmt"
  );
  assertNodeKind<UndefinedLiteralExpr>(ret.expr, "UndefinedLiteralExpr");
});

test("computed object name", () => {
  const result = assertNodeKind<FunctionLike>(
    reflect(() => {
      const name = "aName";
      return {
        [name]: "value",
      };
    }),
    isFunctionLike
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[1],
    "ReturnStmt"
  );
  const obj = assertNodeKind<ObjectLiteralExpr>(ret.expr, "ObjectLiteralExpr");
  obj.properties;
});

test("reference a closure", () => {
  const fn = () => {};
  assertNodeKind(reflect(fn), isFunctionLike);
});
