import { assertNever } from "./assert";
import {
  ArrayBinding,
  BindingElem,
  ClassDecl,
  ClassStaticBlockDecl,
  MethodDecl,
  PropDecl,
  FunctionDecl,
  ObjectBinding,
  ParameterDecl,
  ConstructorDecl,
} from "./declaration";
import { Err } from "./error";
import {
  Argument,
  ArrayLiteralExpr,
  ArrowFunctionExpr,
  AwaitExpr,
  BinaryExpr,
  BooleanLiteralExpr,
  CallExpr,
  ClassExpr,
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
  PostfixUnaryExpr,
  PromiseArrayExpr,
  PromiseExpr,
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
} from "./expression";
import {
  isArgument,
  isArrayLiteralExpr,
  isArrowFunctionExpr,
  isAwaitExpr,
  isBinaryExpr,
  isBindingElem,
  isBindingPattern,
  isBlockStmt,
  isBooleanLiteralExpr,
  isBreakStmt,
  isCallExpr,
  isCaseClause,
  isCatchClause,
  isClassDecl,
  isClassExpr,
  isClassMember,
  isClassStaticBlockDecl,
  isComputedPropertyNameExpr,
  isConditionExpr,
  isConstructorDecl,
  isContinueStmt,
  isDebuggerStmt,
  isDefaultClause,
  isDoStmt,
  isElementAccessExpr,
  isErr,
  isExpr,
  isExprStmt,
  isForInStmt,
  isForOfStmt,
  isFunctionDecl,
  isFunctionExpr,
  isIdentifier,
  isIfStmt,
  isLabelledStmt,
  isMethodDecl,
  isNewExpr,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectBinding,
  isObjectElementExpr,
  isObjectLiteralExpr,
  isParameterDecl,
  isPostfixUnaryExpr,
  isPromiseArrayExpr,
  isPromiseExpr,
  isPropAccessExpr,
  isPropAssignExpr,
  isPropDecl,
  isPropName,
  isReferenceExpr,
  isReturnStmt,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStmt,
  isStringLiteralExpr,
  isSuperKeyword,
  isSwitchClause,
  isSwitchStmt,
  isTemplateExpr,
  isThisExpr,
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
  CaseClause,
  CatchClause,
  ContinueStmt,
  DefaultClause,
  DoStmt,
  ExprStmt,
  FinallyBlock,
  ForInStmt,
  ForOfStmt,
  IfStmt,
  LabelledStmt,
  ReturnStmt,
  Stmt,
  SwitchStmt,
  ThrowStmt,
  TryStmt,
  VariableStmt,
  WhileStmt,
} from "./statement";
import {
  anyOf,
  DeterministicNameGenerator,
  ensure,
  ensureItemOf,
  flatten,
} from "./util";

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
    return (
      isCallExpr(node) ? new CallExpr(expr, args) : new NewExpr(expr, args)
    ) as T;
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
  } else if (isClassDecl(node) || isClassExpr(node)) {
    const heritage = node.heritage ? visitor(node.heritage) : undefined;

    ensure(
      heritage,
      isExpr,
      `A ${node.kind}'s Heritage Clause must be an Expr`
    );

    const classMembers = node.members.flatMap((classMember) => {
      let updatedMember = visitor(classMember);

      if (Array.isArray(updatedMember)) {
        updatedMember = flatten(updatedMember);
        ensureItemOf(
          updatedMember,
          isClassMember,
          "A ClassDecl's ClassMembers must be ClassMember declarations"
        );
        return updatedMember;
      } else {
        ensure(
          updatedMember,
          isClassMember,
          "A ClassDecl's ClassMembers must be ClassMember declarations"
        );
        return [updatedMember];
      }
    });

    if (isClassDecl(node)) {
      return new ClassDecl(node.name, heritage, classMembers) as T;
    } else {
      return new ClassExpr(node.name, heritage, classMembers) as T;
    }
  } else if (isClassStaticBlockDecl(node)) {
    const block = visitor(node);
    ensure(
      block,
      isBlockStmt,
      "A ClassStaticBlockDecl's block must be a BlockStmt"
    );
    return new ClassStaticBlockDecl(block) as T;
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
  } else if (isDebuggerStmt(node)) {
    return node.clone() as T;
  } else if (isDoStmt(node)) {
    const block = visitor(node.block);
    ensure(block, isBlockStmt, "a DoStmt's block must be a BlockStmt");
    const condition = visitor(node.condition);
    ensure(condition, isExpr, "a DoStmt's condition must be an Expr");
    return new DoStmt(block, condition) as T;
  } else if (isErr(node)) {
    return new Err(node.error) as T;
  } else if (isElementAccessExpr(node)) {
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

    return (
      isForInStmt(node)
        ? new ForInStmt(variableDecl, expr, body)
        : new ForOfStmt(variableDecl, expr, body)
    ) as T;
  } else if (
    isFunctionDecl(node) ||
    isArrowFunctionExpr(node) ||
    isFunctionExpr(node) ||
    isMethodDecl(node) ||
    isConstructorDecl(node)
  ) {
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
    return (
      isFunctionDecl(node)
        ? new FunctionDecl(node.name, parameters, body)
        : isArrowFunctionExpr(node)
        ? new ArrowFunctionExpr(parameters, body)
        : isFunctionExpr(node)
        ? new FunctionExpr(node.name, parameters, body)
        : isMethodDecl(node)
        ? new MethodDecl(node.name, parameters, body)
        : new ConstructorDecl(parameters, body)
    ) as T;
  } else if (isIdentifier(node)) {
    return new Identifier(node.name) as T;
  } else if (isIfStmt(node)) {
    const when = visitor(node.when);
    const then = visitor(node.then);
    const _else = node._else ? visitor(node._else) : undefined;

    ensure(when, isExpr, "a IfStmt's when must be an Expr");
    ensure(then, isStmt, "a IfStmt's then must be a Stmt");
    if (_else) {
      ensure(_else, isStmt, "a IfStmt's else must be a Stmt");
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
  } else if (isPropDecl(node)) {
    const name = visitor(node.name);
    const initializer = node.initializer
      ? visitor(node.initializer)
      : undefined;
    ensure(
      name,
      isPropName,
      "a PropDecl's name must be an Identifier, StringLiteralExpr or ComputedPropNameExpr"
    );
    ensure(initializer, isExpr, "A PropDecl's initializer must be an Expr");

    return new PropDecl(name, initializer) as T;
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
  } else if (isSuperKeyword(node)) {
    return node.clone() as T;
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
  } else if (isThisExpr(node)) {
    return node.clone() as T;
  } else if (isThrowStmt(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a ThrowStmt's expr must be an Expr node type");
    return new ThrowStmt(expr) as T;
  } else if (isTryStmt(node)) {
    const tryBlock = visitor(node.tryBlock);
    ensure(tryBlock, isBlockStmt, "a TryStmt's tryBlock must be a BlockStmt");

    const catchClause = node.catchClause
      ? visitor(node.catchClause)
      : undefined;
    if (catchClause) {
      ensure(
        catchClause,
        isCatchClause,
        "a TryStmt's catchClause must be a CatchClause"
      );
    }

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
  } else if (isPostfixUnaryExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a UnaryPostfixExpr's expr property must be an Expr");
    return new PostfixUnaryExpr(node.op, expr) as T;
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
  } else if (isBindingElem(node)) {
    const name = visitor(node.name);
    ensure(
      name,
      anyOf(isIdentifier, isBindingPattern),
      "A BindingElm's name property must be an Identifier or a Binding Pattern"
    );
    const property = node.propertyName ? visitor(node.propertyName) : undefined;
    property &&
      ensure(
        property,
        anyOf(isComputedPropertyNameExpr, isIdentifier, isStringLiteralExpr),
        "A BindingElm's propertyName property must be an Identifier, Computed, String, or undefined"
      );
    const initializer = node.initializer
      ? visitor(node.initializer)
      : undefined;
    initializer &&
      ensure(
        initializer,
        isExpr,
        "A BindingElm's initializer property must be an Expr or undefined"
      );
    return new BindingElem(
      name,
      node.rest,
      property as BindingElem["propertyName"],
      initializer as BindingElem["initializer"]
    ) as T;
  } else if (isBindingPattern(node)) {
    const bindings = node.bindings.map((b) => {
      const binding = b ? visitor(b) : undefined;
      binding &&
        ensure(
          binding,
          isBindingElem,
          "Bindings property on BindingPatterns must be a BindingElm or undefined"
        );
      return binding;
    });

    if (isObjectBinding(node)) {
      return new ObjectBinding(bindings as ObjectBinding["bindings"]) as T;
    } else {
      return new ArrayBinding(bindings as ArrayBinding["bindings"]) as T;
    }
  } else if (isLabelledStmt(node)) {
    const stmt = visitor(node.stmt);
    ensure(stmt, isStmt, "LabelledStmt's stmt must be a Stmt");
    return new LabelledStmt(node.label, stmt) as T;
  } else if (isSwitchStmt(node)) {
    const clauses = node.clauses.flatMap((clause) => {
      const updatedClause = visitor(clause);
      if (Array.isArray(updatedClause)) {
        ensureItemOf(
          updatedClause,
          isSwitchClause,
          "must be a CaseClause or DefaultClause"
        );
        return updatedClause;
      } else {
        ensure(
          updatedClause,
          isSwitchClause,
          "must be a CaseClause or DefaultClause"
        );
        return [updatedClause];
      }
    });

    const defaultClauses = clauses.filter(isDefaultClause);
    if (defaultClauses.length === 1) {
      if (!isDefaultClause(clauses[clauses.length - 1])) {
        throw new Error(`only the last SwitchClause can be a DefaultClause`);
      }
    } else if (defaultClauses.length > 1) {
      throw new Error(
        `there must be 0 or 1 DefaultClauses in a single SwitchStmt, but found ${defaultClauses.length}`
      );
    }

    return new SwitchStmt(clauses) as T;
  } else if (isCaseClause(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, `the CaseClause's expr must be an Expr`);
    const stmts = node.statements.flatMap((stmt) => {
      const updatedStmt = visitor(stmt);
      if (Array.isArray(updatedStmt)) {
        ensureItemOf(
          updatedStmt,
          isStmt,
          `expected all items in a CaseClause's statements to be Stmt nodes`
        );
        return updatedStmt;
      } else {
        ensure(
          updatedStmt,
          isStmt,
          `expected all items in a CaseClause's statements to be Stmt nodes`
        );
        return [updatedStmt];
      }
    });

    return new CaseClause(expr, stmts) as T;
  } else if (isDefaultClause(node)) {
    const stmts = node.statements.flatMap((stmt) => {
      const updatedStmt = visitor(stmt);
      if (Array.isArray(updatedStmt)) {
        ensureItemOf(
          updatedStmt,
          isStmt,
          `expected all items in a DefaultClause's statements to be Stmt nodes`
        );
        return updatedStmt;
      } else {
        ensure(
          updatedStmt,
          isStmt,
          `expected all items in a DefaultClause's statements to be Stmt nodes`
        );
        return [updatedStmt];
      }
    });

    return new DefaultClause(stmts) as T;
  }
  return assertNever(node);
}

/**
 * Like {@link visitEachChild} but it only visits the statements of a block.
 *
 * Provides the hoist function that allows hoisting expressions into variable statements above the current statement.
 */
export function visitBlock(
  block: BlockStmt,
  cb: (stmt: Stmt, hoist: (expr: Expr) => Expr) => Stmt,
  nameGenerator: DeterministicNameGenerator
): BlockStmt {
  return visitEachChild(block, (stmt) => {
    const nestedTasks: FunctionlessNode[] = [];
    function hoist(expr: Expr): Identifier {
      const id = new Identifier(nameGenerator.generateOrGet(expr));
      nestedTasks.push(new VariableStmt(id.name, expr));
      return id;
    }

    const updatedNode = cb(stmt as Stmt, hoist);

    return nestedTasks.length === 0
      ? updatedNode
      : [...nestedTasks, updatedNode];
  });
}

/**
 * Starting at the root, explore the children without processing until one or more start nodes are found.
 *
 * For each Start nodes, apply {@link visitEachChild} to it with the given callback.
 */
export function visitSpecificChildren<T extends FunctionlessNode>(
  root: T,
  starts: Expr[],
  cb: (
    node: FunctionlessNode
  ) => FunctionlessNode | FunctionlessNode[] | undefined
): T {
  return visitEachChild(root, function dive(expr: FunctionlessNode):
    | FunctionlessNode
    | FunctionlessNode[]
    | undefined {
    return starts.includes(expr as Expr)
      ? visitEachChild(expr, cb)
      : visitEachChild(expr, dive);
  });
}

/**
 * Rename all {@link PropAssignExpr} expressions within the {@link obj} where the
 * name is statically known and matches a property in the {@link rename} map.
 */
export function renameObjectProperties(
  obj: ObjectLiteralExpr,
  rename: Record<string, string>
) {
  const newObj = visitEachChild(obj, (node) => {
    if (isPropAssignExpr(node)) {
      const propName = node.tryGetName();
      if (propName !== undefined && propName in rename) {
        const substituteName = rename[propName];

        return new PropAssignExpr(
          new Identifier(substituteName),
          node.expr.clone()
        );
      }
    }
    return node;
  });
  newObj.parent = obj.parent;
  return newObj;
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
