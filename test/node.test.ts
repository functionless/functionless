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

test("node.exit() from catch surrounded by while", () => {
  const catchClause = new CatchClause(
    new VariableDecl(new Identifier("var"), new NullLiteralExpr()),
    new BlockStmt([new ExprStmt(new CallExpr(new Identifier("task"), []))])
  );

  const whileStmt = new WhileStmt(
    new BooleanLiteralExpr(true),
    new BlockStmt([new TryStmt(new BlockStmt([]), catchClause)])
  );

  new FunctionDecl("name", [], new BlockStmt([whileStmt]), false, false);

  const exit = catchClause.exit();

  expect(exit === whileStmt).toBe(true);
});
