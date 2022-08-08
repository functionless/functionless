import { aws_events, Stack } from "aws-cdk-lib";
import {
  EventBus,
  reflect,
  ReflectionSymbols,
  validateFunctionLike,
} from "../src";
import { assertNodeKind } from "../src/assert";
import { NodeKind } from "../src/node-kind";

test("function", () =>
  expect(reflect(() => {})?.kindName).toEqual("ArrowFunctionExpr"));

test("turns a single line function into a return", () => {
  const fn = assertNodeKind(
    reflect(() => ""),
    NodeKind.ArrowFunctionExpr
  );

  expect(fn.body.statements[0]?.kindName).toEqual("ReturnStmt");
});

test("returns a string", () => {
  const fn = assertNodeKind(
    reflect(() => ""),
    NodeKind.ArrowFunctionExpr
  );
  expect(
    assertNodeKind(fn.body.statements[0], NodeKind.ReturnStmt).expr.kindName
  ).toEqual("StringLiteralExpr");
});

test("parenthesis", () => {
  const fn = assertNodeKind(
    reflect(() => {
      ("");
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind(fn.body.statements[0], NodeKind.ExprStmt);
  const parens = assertNodeKind(expr.expr, NodeKind.ParenthesizedExpr);
  assertNodeKind(parens.expr, NodeKind.StringLiteralExpr);
});

test("parenthesis are respected", () => {
  const fn = assertNodeKind(
    reflect(() => {
      2 + (1 + 2);
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind(fn.body.statements[0], NodeKind.ExprStmt);
  const bin = assertNodeKind(expr.expr, NodeKind.BinaryExpr);
  assertNodeKind(bin.left, NodeKind.NumberLiteralExpr);
  const parens = assertNodeKind(bin.right, NodeKind.ParenthesizedExpr);
  assertNodeKind(parens.expr, NodeKind.BinaryExpr);
});

test("parenthesis are respected inverted", () => {
  const fn = assertNodeKind(
    reflect(() => {
      2 + 1 + 2;
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind(fn.body.statements[0], NodeKind.ExprStmt);
  const bin = assertNodeKind(expr.expr, NodeKind.BinaryExpr);
  assertNodeKind(bin.right, NodeKind.NumberLiteralExpr);
  assertNodeKind(bin.left, NodeKind.BinaryExpr);
});

test("type casting", () => {
  const fn = assertNodeKind(
    reflect(() => {
      <any>2;
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind(fn.body.statements[0], NodeKind.ExprStmt);
  assertNodeKind(expr.expr, NodeKind.NumberLiteralExpr);
});

test("type casting as", () => {
  const fn = assertNodeKind(
    reflect(() => {
      2 as any;
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind(fn.body.statements[0], NodeKind.ExprStmt);
  assertNodeKind(expr.expr, NodeKind.NumberLiteralExpr);
});

test("any function args", () => {
  const result = assertNodeKind(
    reflect(() => {
      (<any>"").startsWith("");
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind(result.body.statements[0], NodeKind.ExprStmt);
  const call = assertNodeKind(expr.expr, NodeKind.CallExpr);

  expect(call.args).toHaveLength(1);
});

test("named function args", () => {
  const result = assertNodeKind(
    reflect(() => {
      "".startsWith("");
    }),
    NodeKind.ArrowFunctionExpr
  );

  const expr = assertNodeKind(result.body.statements[0], NodeKind.ExprStmt);
  const call = assertNodeKind(expr.expr, NodeKind.CallExpr);

  expect(call.args[0]?.expr?.kindName).toEqual("StringLiteralExpr");
});

test("null", () => {
  const result = assertNodeKind(
    reflect(() => null),
    NodeKind.ArrowFunctionExpr
  );

  const ret = assertNodeKind(result.body.statements[0], NodeKind.ReturnStmt);
  assertNodeKind(ret.expr, NodeKind.NullLiteralExpr);
});

test("undefined", () => {
  const result = assertNodeKind(
    reflect(() => undefined),
    NodeKind.ArrowFunctionExpr
  );

  const ret = assertNodeKind(result.body.statements[0], NodeKind.ReturnStmt);
  assertNodeKind(ret.expr, NodeKind.UndefinedLiteralExpr);
});

test("anonymous function expression", () => {
  assertNodeKind(
    reflect(function () {}),
    NodeKind.FunctionExpr
  );
});

test("function expression", () => {
  assertNodeKind(
    reflect(function foo() {}),
    NodeKind.FunctionExpr
  );
});

test("computed object name", () => {
  const result = assertNodeKind(
    reflect(() => {
      const name = "aName";
      return {
        [name]: "value",
      };
    }),
    NodeKind.ArrowFunctionExpr
  );

  const ret = assertNodeKind(result.body.statements[1], NodeKind.ReturnStmt);
  const obj = assertNodeKind(ret.expr, NodeKind.ObjectLiteralExpr);
  obj.properties;
});

test("ObjectBinding with out-of-bound reference", () => {
  const stack = new Stack();
  new aws_events.EventBus(stack, "busbus");

  const customDeleteBus = new EventBus<any>(stack, "deleteBus");
  const b = { bus: customDeleteBus };

  const ast = reflect(() => {
    // @ts-ignore
    const { bus } = b;
    // @ts-ignore
    const { bus: bus2 } = b;
    // @ts-ignore
    const { bus: bus3 = bus } = b;
  });

  const func = assertNodeKind(ast, NodeKind.ArrowFunctionExpr);
  const [binding1, binding2, binding3] = func.body.statements.map((stmt) => {
    const varStmt = assertNodeKind(stmt, NodeKind.VariableStmt);
    const varDecl = assertNodeKind(
      varStmt.declList.decls[0]?.name,
      NodeKind.ObjectBinding
    );
    assertNodeKind(
      varStmt.declList.decls[0]?.initializer,
      NodeKind.ReferenceExpr
    );
    return varDecl.bindings[0];
  });

  assertNodeKind(binding1?.name, NodeKind.Identifier);
  assertNodeKind(binding2?.name, NodeKind.Identifier);
  assertNodeKind(binding2?.propertyName, NodeKind.Identifier);
  assertNodeKind(binding3?.name, NodeKind.Identifier);
  assertNodeKind(binding3?.propertyName, NodeKind.Identifier);
  assertNodeKind(binding3?.initializer, NodeKind.Identifier);
});

test("ArrayBinding with out-of-bound reference", () => {
  const stack = new Stack();
  new aws_events.EventBus(stack, "busbus");

  const customDeleteBus = new EventBus<any>(stack, "deleteBus");
  const b = [customDeleteBus];

  const ast = reflect(() => {
    // @ts-ignore
    const [bus] = b;
    // @ts-ignore
    const [bus2 = bus] = b;
  });

  const func = assertNodeKind(ast, NodeKind.ArrowFunctionExpr);
  const [binding1, binding2] = func.body.statements.map((stmt) => {
    const varStmt = assertNodeKind(stmt, NodeKind.VariableStmt);
    const varDecl = assertNodeKind(
      varStmt.declList.decls[0]?.name,
      NodeKind.ArrayBinding
    );
    assertNodeKind(
      varStmt.declList.decls[0]?.initializer,
      NodeKind.ReferenceExpr
    );

    return assertNodeKind(varDecl.bindings[0], NodeKind.BindingElem);
  });

  assertNodeKind(binding1?.name, NodeKind.Identifier);
  assertNodeKind(binding2?.name, NodeKind.Identifier);
  assertNodeKind(binding2?.initializer, NodeKind.Identifier);
});

test("reflect on a bound function declaration", () => {
  function foo() {
    return "hello";
  }
  const a = foo.bind({});

  const ast = reflect(a);
  assertNodeKind(ast, NodeKind.FunctionDecl);
});

test("validateFunctionLikeNode throws when function not registered", () => {
  function foo() {}
  delete (foo as any)[ReflectionSymbols.AST];

  expect(() => validateFunctionLike(foo, "here")).toThrow();
});
