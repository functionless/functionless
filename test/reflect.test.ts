import {
  ArrowFunctionExpr,
  BinaryExpr,
  CallExpr,
  ExprStmt,
  FunctionExpr,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  ParenthesizedExpr,
  reflect,
  ReturnStmt,
  StringLiteralExpr,
  UndefinedLiteralExpr,
} from "../src";
import { assertNodeKind } from "../src/assert";
import { NodeKind } from "../src/node-kind";

test("function", () =>
  expect(reflect(() => {})?.kindName).toEqual("ArrowFunctionExpr"));

test("turns a single line function into a return", () => {
  const fn = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => ""),
    NodeKind.ArrowFunctionExpr
  );

  expect(fn.body.statements[0].kindName).toEqual("ReturnStmt");
});

test("returns a string", () => {
  const fn = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => ""),
    NodeKind.ArrowFunctionExpr
  );
  expect(
    assertNodeKind<ReturnStmt>(fn.body.statements[0], NodeKind.ReturnStmt).expr
      .kindName
  ).toEqual("StringLiteralExpr");
});

test("parenthesis", () => {
  const fn = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      ("");
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind<ExprStmt>(
    fn.body.statements[0],
    NodeKind.ExprStmt
  );
  const parens = assertNodeKind<ParenthesizedExpr>(
    expr.expr,
    NodeKind.ParenthesizedExpr
  );
  assertNodeKind<StringLiteralExpr>(parens.expr, NodeKind.StringLiteralExpr);
});

test("parenthesis are respected", () => {
  const fn = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      2 + (1 + 2);
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind<ExprStmt>(
    fn.body.statements[0],
    NodeKind.ExprStmt
  );
  const bin = assertNodeKind<BinaryExpr>(expr.expr, NodeKind.BinaryExpr);
  assertNodeKind<NumberLiteralExpr>(bin.left, NodeKind.NumberLiteralExpr);
  const parens = assertNodeKind<ParenthesizedExpr>(
    bin.right,
    NodeKind.ParenthesizedExpr
  );
  assertNodeKind<BinaryExpr>(parens.expr, NodeKind.BinaryExpr);
});

test("parenthesis are respected inverted", () => {
  const fn = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      2 + 1 + 2;
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind<ExprStmt>(
    fn.body.statements[0],
    NodeKind.ExprStmt
  );
  const bin = assertNodeKind<BinaryExpr>(expr.expr, NodeKind.BinaryExpr);
  assertNodeKind<NumberLiteralExpr>(bin.right, NodeKind.NumberLiteralExpr);
  assertNodeKind<BinaryExpr>(bin.left, NodeKind.BinaryExpr);
});

test("type casting", () => {
  const fn = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      <any>2;
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind<ExprStmt>(
    fn.body.statements[0],
    NodeKind.ExprStmt
  );
  assertNodeKind<NumberLiteralExpr>(expr.expr, NodeKind.NumberLiteralExpr);
});

test("type casting as", () => {
  const fn = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      2 as any;
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind<ExprStmt>(
    fn.body.statements[0],
    NodeKind.ExprStmt
  );
  assertNodeKind<NumberLiteralExpr>(expr.expr, NodeKind.NumberLiteralExpr);
});

test("any function args", () => {
  const result = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      (<any>"").startsWith("");
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind<ExprStmt>(
    result.body.statements[0],
    NodeKind.ExprStmt
  );
  const call = assertNodeKind<CallExpr>(expr.expr, NodeKind.CallExpr);

  expect(call.args).toHaveLength(1);
});

test("named function args", () => {
  const result = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      "".startsWith("");
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind<ExprStmt>(
    result.body.statements[0],
    NodeKind.ExprStmt
  );
  const call = assertNodeKind<CallExpr>(expr.expr, NodeKind.CallExpr);

  expect(call.args[0]?.expr?.kindName).toEqual("StringLiteralExpr");
});

test("null", () => {
  const result = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => null),
    NodeKind.ArrowFunctionExpr
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    NodeKind.ReturnStmt
  );
  assertNodeKind<NullLiteralExpr>(ret.expr, NodeKind.NullLiteralExpr);
});

test("undefined", () => {
  const result = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => undefined),
    NodeKind.ArrowFunctionExpr
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    NodeKind.ReturnStmt
  );
  assertNodeKind<UndefinedLiteralExpr>(ret.expr, NodeKind.UndefinedLiteralExpr);
});

test("anonymous function expression", () => {
  assertNodeKind<FunctionExpr>(
    reflect(function () {}),
    NodeKind.FunctionExpr
  );
});

test("function expression", () => {
  assertNodeKind<FunctionExpr>(
    reflect(function foo() {}),
    NodeKind.FunctionExpr
  );
});

test("computed object name", () => {
  const result = assertNodeKind<ArrowFunctionExpr>(
    reflect(() => {
      const name = "aName";
      return {
        [name]: "value",
      };
    }),
    NodeKind.ArrowFunctionExpr
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[1],
    NodeKind.ReturnStmt
  );
  const obj = assertNodeKind<ObjectLiteralExpr>(
    ret.expr,
    NodeKind.ObjectLiteralExpr
  );
  obj.properties;
});

test("err", () => {
  const fn = () => {};
  expect(reflect(fn)).toBeUndefined();
});
