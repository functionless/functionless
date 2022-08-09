import "jest";
import {
  BlockStmt,
  BooleanLiteralExpr,
  CallExpr,
  CatchClause,
  ExprStmt,
  FunctionDecl,
  Identifier,
  NullLiteralExpr,
  TryStmt,
  VariableDecl,
  WhileStmt,
} from "../src";
import { emptySpan } from "../src/span";

test("node.exit() from catch surrounded by while", () => {
  const catchClause = new CatchClause(
    emptySpan(),
    new VariableDecl(
      emptySpan(),
      new Identifier(emptySpan(), "var"),
      new NullLiteralExpr(emptySpan())
    ),
    new BlockStmt(emptySpan(), [
      new ExprStmt(
        emptySpan(),
        new CallExpr(emptySpan(), new Identifier(emptySpan(), "task"), [])
      ),
    ])
  );

  const whileStmt = new WhileStmt(
    emptySpan(),
    new BooleanLiteralExpr(emptySpan(), true),
    new BlockStmt(emptySpan(), [
      new TryStmt(emptySpan(), new BlockStmt(emptySpan(), []), catchClause),
    ])
  );

  new FunctionDecl(
    emptySpan(),
    "name",
    [],
    new BlockStmt(emptySpan(), [whileStmt]),
    false,
    false
  );

  const exit = catchClause.exit();

  expect(exit === whileStmt).toBe(true);
});
