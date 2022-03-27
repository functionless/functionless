import { assertNever } from "./assert";
import { FunctionDecl, isParameterDecl, ParameterDecl } from "./declaration";
import {
  ArrayLiteralExpr,
  BinaryExpr,
  BooleanLiteralExpr,
  CallExpr,
  ConditionExpr,
  ElementAccessExpr,
  Expr,
  FunctionExpr,
  Identifier,
  isExpr,
  isObjectElementExpr,
  NewExpr,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectElementExpr,
  ObjectLiteralExpr,
  PropAccessExpr,
  PropAssignExpr,
  ReferenceExpr,
  SpreadAssignExpr,
  SpreadElementExpr,
  StringLiteralExpr,
  TemplateExpr,
  UnaryExpr,
} from "./expression";
import { FunctionlessNode } from "./node";

import {
  BlockStmt,
  BreakStmt,
  CatchClause,
  DoStmt,
  ExprStmt,
  ForInStmt,
  ForOfStmt,
  IfStmt,
  isBlockStmt,
  isCatchClause,
  isIfStmt,
  isStmt,
  isVariableStmt,
  ReturnStmt,
  Stmt,
  ThrowStmt,
  TryStmt,
  VariableStmt,
  WhileStmt,
} from "./statement";
import { anyOf, ensure, ensureItemOf, flatten } from "./util";

/**
 * Visits each child of a Node using the supplied visitor, possibly returning a new Node of the same kind in its place.
 *
 * @param node The Node whose children will be visited.
 * @param visitor The callback used to visit each child.
 * @param context A lexical environment context for the visitor.
 */
export function visitEachChild<T extends FunctionlessNode>(
  node: T,
  visitor: (
    node: FunctionlessNode
  ) => FunctionlessNode | FunctionlessNode[] | undefined
): T {
  if (node.kind === "ArrayLiteralExpr") {
    return new ArrayLiteralExpr(
      node.items.reduce((items: Expr[], item) => {
        let result = visitor(item);
        if (Array.isArray(result)) {
          result = flatten(result);
          ensureItemOf(
            result,
            isExpr,
            `Items of an ArrayLiteralExpr must be Expr nodes`
          );
          return items.concat(result as Expr[]);
        } else {
          return [...items, result] as any;
        }
      }, [])
    ) as T;
  } else if (node.kind === "BinaryExpr") {
    const left = visitor(node.left);
    const right = visitor(node.right);
    if (isExpr(left) && isExpr(right)) {
      return new BinaryExpr(left, node.op, right) as T;
    } else {
      throw new Error(
        `visitEachChild of BinaryExpr must return an Expr for both the left and right operands`
      );
    }
  } else if (node.kind === "BlockStmt") {
    return new BlockStmt(
      node.statements.reduce((stmts: Stmt[], stmt) => {
        let result = visitor(stmt);
        if (Array.isArray(result)) {
          result = flatten(result);
          ensureItemOf(
            result,
            isStmt,
            `Statements in BlockStmt must be Stmt nodes`
          );
          return stmts.concat(result);
        } else if (isStmt(result)) {
          return [...stmts, result];
        } else {
          throw new Error(
            `visitEachChild of a BlockStmt's child statements must return a Stmt`
          );
        }
      }, [])
    ) as T;
  } else if (node.kind === "BooleanLiteralExpr") {
    return new BooleanLiteralExpr(node.value) as T;
  } else if (node.kind === "BreakStmt") {
    return new BreakStmt() as T;
  } else if (node.kind === "CallExpr" || node.kind === "NewExpr") {
    const expr = visitor(node.expr);
    ensure(
      expr,
      isExpr,
      `visitEachChild of a ${node.kind}'s expr must return a single Expr`
    );
    const args = Object.entries(node.args).reduce((args, [argName, argVal]) => {
      const transformedVal = visitor(argVal);
      ensure(
        transformedVal,
        isExpr,
        `visitEachChild of a ${node.kind}'s argument must return a single Expr`
      );
      return {
        ...args,
        [argName]: transformedVal,
      };
    }, {});
    return new (node.kind === "CallExpr" ? CallExpr : NewExpr)(expr, args) as T;
  } else if (node.kind === "CatchClause") {
    const variableDecl = node.variableDecl
      ? visitor(node.variableDecl)
      : undefined;
    if (variableDecl !== undefined && variableDecl) {
      ensure(
        variableDecl,
        isVariableStmt,
        `visitEachChild of a CatchClause's VariableStmt must return another VariableStmt`
      );
    }
    let block = visitor(node.block);
    if (Array.isArray(block)) {
      block = flatten(block);
      ensureItemOf(block, isStmt, `Statements in BlockStmt must be Stmt nodes`);
      block = new BlockStmt(block);
    } else {
      ensure(
        block,
        isBlockStmt,
        `visitEachChild of a CatchClause's BlockStmt must return another BlockStmt or an Array of Stmt`
      );
    }

    return new CatchClause(variableDecl, block) as T;
  } else if (node.kind === "ConditionExpr") {
    const when = visitor(node.when);
    const then = visitor(node.then);
    const _else = visitor(node._else);

    ensure(when, isExpr, `ConditionExpr's when must be an Expr`);
    ensure(then, isExpr, `ConditionExpr's then must be an Expr`);
    ensure(_else, isExpr, `ConditionExpr's else must be an Expr`);

    return new ConditionExpr(when, then, _else) as T;
  } else if (node.kind === "DoStmt") {
    const block = visitor(node.block);
    ensure(block, isBlockStmt, `a DoStmt's block must be a BlockStmt`);
    const condition = visitor(node.condition);
    ensure(condition, isExpr, `a DoStmt's condition must be an Expr`);
    return new DoStmt(block, condition) as T;
  } else if (node.kind == "ElementAccessExpr") {
    const expr = visitor(node.expr);
    const element = visitor(node.element);
    ensure(expr, isExpr, `ElementAccessExpr's expr property must be an Expr`);
    ensure(
      element,
      isExpr,
      `ElementAccessExpr's element property must be an Expr`
    );
    return new ElementAccessExpr(expr, element) as T;
  } else if (node.kind === "ExprStmt") {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, `The Expr in an ExprStmt must be an Expr`);
    return new ExprStmt(expr) as T;
  } else if (node.kind === "ForInStmt" || node.kind === "ForOfStmt") {
    const variableDecl = visitor(node.variableDecl);
    ensure(
      variableDecl,
      isVariableStmt,
      `VariableDecl in ${node.kind} must be a VariableDecl`
    );

    const expr = visitor(node.expr);
    ensure(expr, isExpr, `Expr in ${node.kind} must be an Expr`);

    let body = visitor(node.body);
    if (Array.isArray(body)) {
      body = flatten(body);
      ensureItemOf(body, isStmt, `Statements in BlockStmt must be Stmt nodes`);
      body = new BlockStmt(body);
    } else {
      ensure(body, isBlockStmt, `Body in ${node.kind} must be a BlockStmt`);
    }

    return new (node.kind === "ForInStmt" ? ForInStmt : ForOfStmt)(
      variableDecl,
      expr,
      body
    ) as T;
  } else if (node.kind === "FunctionDecl" || node.kind === "FunctionExpr") {
    const parameters = node.parameters.reduce(
      (params: ParameterDecl[], parameter) => {
        let p = visitor(parameter);
        if (Array.isArray(p)) {
          p = flatten(p);
          ensureItemOf(
            p,
            isParameterDecl,
            `a ${node.kind}'s parameters must be ParameterDecl nodes`
          );
          return params.concat(p);
        } else {
          ensure(
            p,
            isParameterDecl,
            `a ${node.kind}'s parameters must be ParameterDecl nodes`
          );
          return [...params, p];
        }
      },
      []
    );

    const body = visitor(node.body);
    ensure(body, isBlockStmt, `a ${node.kind}'s body must be a BlockStmt`);
    return new (node.kind === "FunctionDecl" ? FunctionDecl : FunctionExpr)(
      parameters,
      body
    ) as T;
  } else if (node.kind === "Identifier") {
    return new Identifier(node.name) as T;
  } else if (node.kind === "IfStmt") {
    const when = visitor(node.when);
    const then = visitor(node.then);
    const _else = node._else ? visitor(node._else) : undefined;

    ensure(when, isExpr, `a IfStmt's when must be an Expr`);
    ensure(then, isBlockStmt, `a IfStmt's then must be a BlockStmt`);
    if (_else) {
      ensure(
        _else,
        anyOf(isIfStmt, isBlockStmt),
        `a IfStmt's else must be an IfStmt or BlockStmt`
      );
    }

    return new IfStmt(when, then, _else) as T;
  } else if (node.kind === "NullLiteralExpr") {
    return new NullLiteralExpr() as T;
  } else if (node.kind === "NumberLiteralExpr") {
    return new NumberLiteralExpr(node.value) as T;
  } else if (node.kind === "ObjectLiteralExpr") {
    return new ObjectLiteralExpr(
      node.properties.reduce((props: ObjectElementExpr[], prop) => {
        let p = visitor(prop);
        if (Array.isArray(p)) {
          p = flatten(p);
          ensureItemOf(
            p,
            isObjectElementExpr,
            `an ObjectLiteralExpr's properties must be ObjectElementExpr nodes`
          );
          return props.concat(p);
        } else {
          ensure(
            p,
            isObjectElementExpr,
            `an ObjectLiteralExpr's properties must be ObjectElementExpr nodes`
          );
          return [...props, p];
        }
      }, [])
    ) as T;
  } else if (node.kind === "ParameterDecl") {
    return new ParameterDecl(node.name) as T;
  } else if (node.kind === "PropAccessExpr") {
    const expr = visitor(node.expr);
    ensure(
      expr,
      isExpr,
      "a PropAccessExpr's expr property must be an Expr node type"
    );
    return new PropAccessExpr(expr, node.name) as T;
  } else if (node.kind === "PropAssignExpr") {
    const name = visitor(node.name);
    const expr = visitor(node.expr);
    ensure(
      name,
      isExpr,
      "a PropAssignExpr's name property must be an Expr node type"
    );
    ensure(
      expr,
      isExpr,
      "a PropAssignExpr's expr property must be an Expr node type"
    );
    return new PropAssignExpr(name, expr) as T;
  } else if (node.kind === "ReferenceExpr") {
    return new ReferenceExpr(node.name, node.ref) as T;
  } else if (node.kind === "ReturnStmt") {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, `a ReturnStmt's expr must be an Expr node type`);
    return new ReturnStmt(expr) as T;
  } else if (node.kind === "SpreadAssignExpr") {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, `a SpreadAssignExpr's expr must be an Expr node type`);
    return new SpreadAssignExpr(expr) as T;
  } else if (node.kind === "SpreadElementExpr") {
    const expr = visitor(node.expr);
    ensure(
      expr,
      isExpr,
      `a SpreadElementExpr's expr must be an Expr node type`
    );
    return new SpreadElementExpr(expr) as T;
  } else if (node.kind === "StringLiteralExpr") {
    return new StringLiteralExpr(node.value) as T;
  } else if (node.kind === "TemplateExpr") {
    return new TemplateExpr(
      node.exprs.reduce((exprs: Expr[], expr) => {
        let e = visitor(expr);
        if (e === undefined) {
          return exprs;
        } else if (Array.isArray(e)) {
          e = flatten(e);
          ensureItemOf(
            e,
            isExpr,
            `a TemplateExpr's expr property must only contain Expr node types`
          );
          return exprs.concat(e);
        } else {
          ensure(
            e,
            isExpr,
            `a TemplateExpr's expr property must only contain Expr node types`
          );
          return [...exprs, e];
        }
      }, [])
    ) as T;
  } else if (node.kind === "ThrowStmt") {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, `a ThrowStmt's expr must be an Expr node type`);
    return new ThrowStmt(expr) as T;
  } else if (node.kind === "TryStmt") {
    const tryBlock = visitor(node.tryBlock);
    ensure(tryBlock, isBlockStmt, `a TryStmt's tryBlock must be a BlockStmt`);

    const catchClause = visitor(node.catchClause);
    ensure(
      catchClause,
      isCatchClause,
      `a TryStmt's catchClause must be a CatchClause`
    );

    const finallyBlock = node.finallyBlock
      ? visitor(node.finallyBlock)
      : undefined;
    if (finallyBlock) {
      ensure(
        finallyBlock,
        isBlockStmt,
        `a TryStmt's finallyBlock must be a BlockStmt`
      );
    }
    return new TryStmt(tryBlock, catchClause, finallyBlock) as T;
  } else if (node.kind === "UnaryExpr") {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, `a UnaryExpr's expr must be an Expr`);
    return new UnaryExpr(node.op, expr) as T;
  } else if (node.kind === "VariableStmt") {
    const expr = node.expr ? visitor(node.expr) : undefined;
    if (expr) {
      ensure(expr, isExpr, `a VariableStmt's expr must be an Expr`);
    }
    return new VariableStmt(node.name, expr) as T;
  } else if (node.kind === "WhileStmt") {
    const condition = visitor(node.condition);
    ensure(condition, isExpr, `a WhileStmt's condition must be an Expr`);
    const block = visitor(node.block);
    ensure(block, isBlockStmt, `a WhileStmt's block must be a BlockStmt`);
    return new WhileStmt(condition, block) as T;
  }
  return assertNever(node);
}
