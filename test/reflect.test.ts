import {
  BinaryExpr,
  CallExpr,
  Err,
  ExprStmt,
  FunctionDecl,
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
  expect(reflect(() => {}).kindName).toEqual("FunctionDecl"));

test("turns a single line function into a return", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => ""),
    NodeKind.FunctionDecl
  );

  expect(fn.body.statements[0].kindName).toEqual("ReturnStmt");
});

test("returns a string", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => ""),
    NodeKind.FunctionDecl
  );
  expect(
    assertNodeKind<ReturnStmt>(fn.body.statements[0], NodeKind.ReturnStmt).expr
      .kindName
  ).toEqual("StringLiteralExpr");
});

test("parenthesis", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      ("");
    }),
    NodeKind.FunctionDecl
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
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      2 + (1 + 2);
    }),
    NodeKind.FunctionDecl
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
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      2 + 1 + 2;
    }),
    NodeKind.FunctionDecl
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
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      <any>2;
    }),
    NodeKind.FunctionDecl
  );

  const expr = assertNodeKind<ExprStmt>(
    fn.body.statements[0],
    NodeKind.ExprStmt
  );
  assertNodeKind<NumberLiteralExpr>(expr.expr, NodeKind.NumberLiteralExpr);
});

test("type casting as", () => {
  const fn = assertNodeKind<FunctionDecl>(
    reflect(() => {
      2 as any;
    }),
    NodeKind.FunctionDecl
  );

  const expr = assertNodeKind<ExprStmt>(
    fn.body.statements[0],
    NodeKind.ExprStmt
  );
  assertNodeKind<NumberLiteralExpr>(expr.expr, NodeKind.NumberLiteralExpr);
});

test("any function args", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => {
      (<any>"").startsWith("");
    }),
    NodeKind.FunctionDecl
  );

  const expr = assertNodeKind<ExprStmt>(
    result.body.statements[0],
    NodeKind.ExprStmt
  );
  const call = assertNodeKind<CallExpr>(expr.expr, NodeKind.CallExpr);

  expect(call.args).toHaveLength(1);
});

test("named function args", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => {
      "".startsWith("");
    }),
    NodeKind.FunctionDecl
  );

  const expr = assertNodeKind<ExprStmt>(
    result.body.statements[0],
    NodeKind.ExprStmt
  );
  const call = assertNodeKind<CallExpr>(expr.expr, NodeKind.CallExpr);

  expect(call.args[0]?.expr?.kindName).toEqual("StringLiteralExpr");
});

test("null", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => null),
    NodeKind.FunctionDecl
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    NodeKind.ReturnStmt
  );
  assertNodeKind<NullLiteralExpr>(ret.expr, NodeKind.NullLiteralExpr);
});

test("undefined", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => undefined),
    NodeKind.FunctionDecl
  );

  const ret = assertNodeKind<ReturnStmt>(
    result.body.statements[0],
    NodeKind.ReturnStmt
  );
  assertNodeKind<UndefinedLiteralExpr>(ret.expr, NodeKind.UndefinedLiteralExpr);
});

test("computed object name", () => {
  const result = assertNodeKind<FunctionDecl>(
    reflect(() => {
      const name = "aName";
      return {
        [name]: "value",
      };
    }),
    NodeKind.FunctionDecl
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
  const result = assertNodeKind<Err>(reflect(fn), NodeKind.Err);
  expect(result.error.message).toEqual(
    "Functionless reflection only supports function parameters with bodies, no signature only declarations or references. Found fn."
  );
});
