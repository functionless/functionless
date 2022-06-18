import { assertNever } from "./assert";
import { FunctionDecl, ParameterDecl } from "./declaration";
import { Err } from "./error";
import {
  Argument,
  ArrayLiteralExpr,
  AwaitExpr,
  BinaryExpr,
  BooleanLiteralExpr,
  CallExpr,
  ComputedPropertyNameExpr,
  ConditionExpr,
  ElementAccessExpr,
  Expr,
  FunctionExpr,
  Identifier,
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
  TypeOfExpr,
  UnaryExpr,
  UndefinedLiteralExpr,
  PromiseArrayExpr,
  PromiseExpr,
} from "./expression";
import {
  isArgument,
  isArrayLiteralExpr,
  isAwaitExpr,
  isBinaryExpr,
  isBlockStmt,
  isBooleanLiteralExpr,
  isBreakStmt,
  isCallExpr,
  isCatchClause,
  isComputedPropertyNameExpr,
  isConditionExpr,
  isContinueStmt,
  isDoStmt,
  isErr,
  isExpr,
  isExprStmt,
  isForInStmt,
  isForOfStmt,
  isFunctionDecl,
  isFunctionExpr,
  isIdentifier,
  isIfStmt,
  isNativeFunctionDecl,
  isNewExpr,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectElementExpr,
  isObjectLiteralExpr,
  isParameterDecl,
  isPromiseArrayExpr,
  isPromiseExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isReferenceExpr,
  isReturnStmt,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStmt,
  isStringLiteralExpr,
  isTemplateExpr,
  isThrowStmt,
  isTryStmt,
  isTypeOfExpr,
  isUnaryExpr,
  isUndefinedLiteralExpr,
  isVariableStmt,
  isWhileStmt,
} from "./guards";
import { FunctionlessNode } from "./node";

import {
  BlockStmt,
  BreakStmt,
  CatchClause,
  ContinueStmt,
  DoStmt,
  ExprStmt,
  FinallyBlock,
  ForInStmt,
  ForOfStmt,
  IfStmt,
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
  if (isArgument(node)) {
    if (!node.expr) {
      return node.clone() as T;
    }
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "an Argument's expr must be an Expr");
    return new Argument(expr, node.name) as T;
  } else if (isArrayLiteralExpr(node)) {
    return new ArrayLiteralExpr(
      node.items.reduce((items: Expr[], item) => {
        let result = visitor(item);
        if (Array.isArray(result)) {
          result = flatten(result);
          ensureItemOf(
            result,
            isExpr,
            "Items of an ArrayLiteralExpr must be Expr nodes"
          );
          return items.concat(result as Expr[]);
        } else {
          return [...items, result] as any;
        }
      }, [])
    ) as T;
  } else if (isBinaryExpr(node)) {
    const left = visitor(node.left);
    const right = visitor(node.right);
    if (isExpr(left) && isExpr(right)) {
      return new BinaryExpr(left, node.op, right) as T;
    } else {
      throw new Error(
        "visitEachChild of BinaryExpr must return an Expr for both the left and right operands"
      );
    }
  } else if (isBlockStmt(node)) {
    return new BlockStmt(
      node.statements.reduce((stmts: Stmt[], stmt) => {
        let result = visitor(stmt);
        if (Array.isArray(result)) {
          result = flatten(result);
          ensureItemOf(
            result,
            isStmt,
            "Statements in BlockStmt must be Stmt nodes"
          );
          return stmts.concat(result);
        } else if (isStmt(result)) {
          return [...stmts, result];
        } else {
          throw new Error(
            "visitEachChild of a BlockStmt's child statements must return a Stmt"
          );
        }
      }, [])
    ) as T;
  } else if (isBooleanLiteralExpr(node)) {
    return new BooleanLiteralExpr(node.value) as T;
  } else if (isBreakStmt(node)) {
    return new BreakStmt() as T;
  } else if (isContinueStmt(node)) {
    return new ContinueStmt() as T;
  } else if (isCallExpr(node) || isNewExpr(node)) {
    const expr = visitor(node.expr);
    ensure(
      expr,
      isExpr,
      `visitEachChild of a ${node.kind}'s expr must return a single Expr`
    );
    const args = node.args.flatMap((arg) => {
      if (!arg.expr) {
        return arg.clone();
      }
      const expr = visitor(arg.expr);
      ensure(
        expr,
        isExpr,
        `visitEachChild of a ${node.kind}'s argument must return a single Expr`
      );
      return new Argument(expr, arg.name);
    });
    return new (isCallExpr(node) ? CallExpr : NewExpr)(expr, args) as T;
  } else if (isCatchClause(node)) {
    const variableDecl = node.variableDecl
      ? visitor(node.variableDecl)
      : undefined;
    if (variableDecl !== undefined && variableDecl) {
      ensure(
        variableDecl,
        isVariableStmt,
        "visitEachChild of a CatchClause's VariableStmt must return another VariableStmt"
      );
    }
    let block = visitor(node.block);
    if (Array.isArray(block)) {
      block = flatten(block);
      ensureItemOf(block, isStmt, "Statements in BlockStmt must be Stmt nodes");
      block = new BlockStmt(block);
    } else {
      ensure(
        block,
        isBlockStmt,
        "visitEachChild of a CatchClause's BlockStmt must return another BlockStmt or an Array of Stmt"
      );
    }

    return new CatchClause(variableDecl, block) as T;
  } else if (isComputedPropertyNameExpr(node)) {
    const expr = visitor(node.expr);
    ensure(
      expr,
      isExpr,
      "a ComputedPropertyNameExpr's expr property must be an Expr"
    );
    return new ComputedPropertyNameExpr(expr) as T;
  } else if (isConditionExpr(node)) {
    const when = visitor(node.when);
    const then = visitor(node.then);
    const _else = visitor(node._else);

    ensure(when, isExpr, "ConditionExpr's when must be an Expr");
    ensure(then, isExpr, "ConditionExpr's then must be an Expr");
    ensure(_else, isExpr, "ConditionExpr's else must be an Expr");

    return new ConditionExpr(when, then, _else) as T;
  } else if (isDoStmt(node)) {
    const block = visitor(node.block);
    ensure(block, isBlockStmt, "a DoStmt's block must be a BlockStmt");
    const condition = visitor(node.condition);
    ensure(condition, isExpr, "a DoStmt's condition must be an Expr");
    return new DoStmt(block, condition) as T;
  } else if (isErr(node)) {
    return new Err(node.error) as T;
  } else if (node.kind == "ElementAccessExpr") {
    const expr = visitor(node.expr);
    const element = visitor(node.element);
    ensure(expr, isExpr, "ElementAccessExpr's expr property must be an Expr");
    ensure(
      element,
      isExpr,
      "ElementAccessExpr's element property must be an Expr"
    );
    return new ElementAccessExpr(expr, element) as T;
  } else if (isExprStmt(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "The Expr in an ExprStmt must be an Expr");
    return new ExprStmt(expr) as T;
  } else if (isForInStmt(node) || isForOfStmt(node)) {
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
      ensureItemOf(body, isStmt, "Statements in BlockStmt must be Stmt nodes");
      body = new BlockStmt(body);
    } else {
      ensure(body, isBlockStmt, `Body in ${node.kind} must be a BlockStmt`);
    }

    return new (isForInStmt(node) ? ForInStmt : ForOfStmt)(
      variableDecl,
      expr,
      body
    ) as T;
  } else if (isFunctionDecl(node) || isFunctionExpr(node)) {
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
    return new (isFunctionDecl(node) ? FunctionDecl : FunctionExpr)(
      parameters,
      body
    ) as T;
  } else if (isIdentifier(node)) {
    return new Identifier(node.name) as T;
  } else if (isIfStmt(node)) {
    const when = visitor(node.when);
    const then = visitor(node.then);
    const _else = node._else ? visitor(node._else) : undefined;

    ensure(when, isExpr, "a IfStmt's when must be an Expr");
    ensure(then, isBlockStmt, "a IfStmt's then must be a BlockStmt");
    if (_else) {
      ensure(
        _else,
        anyOf(isIfStmt, isBlockStmt),
        "a IfStmt's else must be an IfStmt or BlockStmt"
      );
    }

    return new IfStmt(when, then, _else) as T;
  } else if (isNullLiteralExpr(node)) {
    return new NullLiteralExpr() as T;
  } else if (isNumberLiteralExpr(node)) {
    return new NumberLiteralExpr(node.value) as T;
  } else if (isObjectLiteralExpr(node)) {
    return new ObjectLiteralExpr(
      node.properties.reduce((props: ObjectElementExpr[], prop) => {
        let p = visitor(prop);
        if (Array.isArray(p)) {
          p = flatten(p);
          ensureItemOf(
            p,
            isObjectElementExpr,
            "an ObjectLiteralExpr's properties must be ObjectElementExpr nodes"
          );
          return props.concat(p);
        } else {
          ensure(
            p,
            isObjectElementExpr,
            "an ObjectLiteralExpr's properties must be ObjectElementExpr nodes"
          );
          return [...props, p];
        }
      }, [])
    ) as T;
  } else if (isParameterDecl(node)) {
    return new ParameterDecl(node.name) as T;
  } else if (isPropAccessExpr(node)) {
    const expr = visitor(node.expr);
    ensure(
      expr,
      isExpr,
      "a PropAccessExpr's expr property must be an Expr node type"
    );
    return new PropAccessExpr(expr, node.name) as T;
  } else if (isPropAssignExpr(node)) {
    const name = visitor(node.name);
    const expr = visitor(node.expr);
    ensure(
      name,
      anyOf(isIdentifier, isStringLiteralExpr, isComputedPropertyNameExpr),
      "a PropAssignExpr's name property must be an Identifier, StringLiteralExpr or ComputedNameProperty node type"
    );
    ensure(
      expr,
      isExpr,
      "a PropAssignExpr's expr property must be an Expr node type"
    );
    return new PropAssignExpr(name, expr) as T;
  } else if (isReferenceExpr(node)) {
    return new ReferenceExpr(node.name, node.ref) as T;
  } else if (isReturnStmt(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a ReturnStmt's expr must be an Expr node type");
    return new ReturnStmt(expr) as T;
  } else if (isSpreadAssignExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a SpreadAssignExpr's expr must be an Expr node type");
    return new SpreadAssignExpr(expr) as T;
  } else if (isSpreadElementExpr(node)) {
    const expr = visitor(node.expr);
    ensure(
      expr,
      isExpr,
      "a SpreadElementExpr's expr must be an Expr node type"
    );
    return new SpreadElementExpr(expr) as T;
  } else if (isStringLiteralExpr(node)) {
    return new StringLiteralExpr(node.value) as T;
  } else if (isTemplateExpr(node)) {
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
            "a TemplateExpr's expr property must only contain Expr node types"
          );
          return exprs.concat(e);
        } else {
          ensure(
            e,
            isExpr,
            "a TemplateExpr's expr property must only contain Expr node types"
          );
          return [...exprs, e];
        }
      }, [])
    ) as T;
  } else if (isThrowStmt(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a ThrowStmt's expr must be an Expr node type");
    return new ThrowStmt(expr) as T;
  } else if (isTryStmt(node)) {
    const tryBlock = visitor(node.tryBlock);
    ensure(tryBlock, isBlockStmt, "a TryStmt's tryBlock must be a BlockStmt");

    const catchClause = visitor(node.catchClause);
    ensure(
      catchClause,
      isCatchClause,
      "a TryStmt's catchClause must be a CatchClause"
    );

    const finallyBlock = node.finallyBlock
      ? visitor(node.finallyBlock)
      : undefined;
    if (finallyBlock) {
      ensure(
        finallyBlock,
        isBlockStmt,
        "a TryStmt's finallyBlock must be a BlockStmt"
      );
    }
    return new TryStmt(
      tryBlock,
      catchClause,
      finallyBlock as FinallyBlock
    ) as T;
  } else if (isTypeOfExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a TypeOfExpr's expr property must be an Expr");
    return new TypeOfExpr(expr) as T;
  } else if (isUnaryExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a UnaryExpr's expr property must be an Expr");
    return new UnaryExpr(node.op, expr) as T;
  } else if (isUndefinedLiteralExpr(node)) {
    return new UndefinedLiteralExpr() as T;
  } else if (isVariableStmt(node)) {
    const expr = node.expr ? visitor(node.expr) : undefined;
    if (expr) {
      ensure(expr, isExpr, "a VariableStmt's expr property must be an Expr");
    }
    return new VariableStmt(node.name, expr) as T;
  } else if (isWhileStmt(node)) {
    const condition = visitor(node.condition);
    ensure(condition, isExpr, "a WhileStmt's condition must be an Expr");
    const block = visitor(node.block);
    ensure(block, isBlockStmt, "a WhileStmt's block must be a BlockStmt");
    return new WhileStmt(condition, block) as T;
  } else if (isNativeFunctionDecl(node)) {
    throw Error(`${node.kind} are not supported.`);
  } else if (isAwaitExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "an AwaitExpr's expr property must be an Expr");
    return new AwaitExpr(expr) as T;
  } else if (isPromiseExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a PromiseExpr's expr property must be an Expr");
    return new PromiseExpr(expr) as T;
  } else if (isPromiseArrayExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a PromiseArrayExpr's expr property must be an Expr");
    return new PromiseArrayExpr(expr) as T;
  }
  return assertNever(node);
}
