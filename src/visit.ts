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
  VariableDecl,
  VariableDeclList,
  GetAccessorDecl,
  SetAccessorDecl,
} from "./declaration";
import { Err } from "./error";
import { ErrorCodes, SynthError } from "./error-code";
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
  DeleteExpr,
  ElementAccessExpr,
  Expr,
  FunctionExpr,
  Identifier,
  NewExpr,
  NullLiteralExpr,
  NumberLiteralExpr,
  ObjectLiteralExpr,
  ParenthesizedExpr,
  PostfixUnaryExpr,
  PrivateIdentifier,
  PromiseArrayExpr,
  PromiseExpr,
  PropAccessExpr,
  PropAssignExpr,
  ReferenceExpr,
  SpreadAssignExpr,
  SpreadElementExpr,
  StringLiteralExpr,
  TaggedTemplateExpr,
  TemplateExpr,
  TypeOfExpr,
  UnaryExpr,
  UndefinedLiteralExpr,
  VoidExpr,
  YieldExpr,
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
  isEmptyStmt,
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
  isWithStmt,
  isForStmt,
  isVariableDeclList,
  isVariableDecl,
  isPrivateIdentifier,
  isYieldExpr,
  isBigIntExpr,
  isRegexExpr,
  isVoidExpr,
  isDeleteExpr,
  isParenthesizedExpr,
  isImportKeyword,
  isGetAccessorDecl,
  isSetAccessorDecl,
  isTaggedTemplateExpr,
  isOmittedExpr,
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
  ForStmt,
  IfStmt,
  LabelledStmt,
  ReturnStmt,
  Stmt,
  SwitchStmt,
  ThrowStmt,
  TryStmt,
  VariableStmt,
  WhileStmt,
  WithStmt,
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
    return new Argument(expr) as T;
  } else if (isArrayLiteralExpr(node)) {
    return new ArrayLiteralExpr(
      node.items.flatMap((item) =>
        ensureSingleOrArray(
          visitor(item),
          isExpr,
          "Items of an ArrayLiteralExpr must be Expr nodes"
        )
      )
    ) as T;
  } else if (isBinaryExpr(node)) {
    const left = visitor(node.left);
    const right = visitor(node.right);
    if (isExpr(left) && isExpr(right)) {
      return new BinaryExpr(left, node.op, right) as T;
    } else {
      throw new SynthError(
        ErrorCodes.Unexpected_Error,
        "visitEachChild of BinaryExpr must return an Expr for both the left and right operands"
      );
    }
  } else if (isBlockStmt(node)) {
    return new BlockStmt(
      node.statements.flatMap((stmt) =>
        ensureSingleOrArray(
          visitor(stmt),
          isStmt,
          "Statements in BlockStmt must be Stmt nodes"
        )
      )
    ) as T;
  } else if (isBigIntExpr(node)) {
    return node.clone() as T;
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
      const expr = visitor(arg.expr!);
      ensure(
        expr,
        isExpr,
        `visitEachChild of a ${node.kind}'s argument must return a single Expr`
      );
      return new Argument(expr);
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
        isVariableDecl,
        "visitEachChild of a CatchClause's VariableDecl must return another VariableDecl"
      );
    }
    const block = visitBlockStmt(node.block, visitor);

    return new CatchClause(variableDecl, block) as T;
  } else if (isClassDecl(node) || isClassExpr(node)) {
    let heritage;

    if (node.heritage) {
      heritage = visitor(node.heritage);
      if (heritage) {
        ensure(
          heritage,
          isExpr,
          `A ${node.kind}'s Heritage Clause must be an Expr`
        );
      }
    }

    const classMembers = node.members.flatMap((classMember) => {
      let updatedMember = visitor(classMember);

      return ensureSingleOrArray(
        updatedMember,
        isClassMember,
        "A ClassDecl's ClassMembers must be ClassMember declarations"
      );
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
    const block = visitBlockStmt(node.block, visitor);
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
  } else if (isForStmt(node)) {
    const body = visitBlockStmt(node.body, visitor);
    const variableDecl = node.initializer
      ? visitor(node.initializer)
      : undefined;
    variableDecl &&
      ensure(
        variableDecl,
        anyOf(isVariableDeclList, isExpr),
        `Initializer in ForStmt must be a VariableList or Expr`
      );
    const condition = node.condition ? visitor(node.condition) : undefined;
    condition &&
      ensure(condition, isExpr, `Condition in ForStmt must be an Expr`);
    const incrementor = node.incrementor
      ? visitor(node.incrementor)
      : undefined;
    incrementor &&
      ensure(incrementor, isExpr, `Incrementor in ForStmt must be an Expr`);

    return new ForStmt(
      body,
      variableDecl as VariableDeclList | Expr,
      condition as Expr,
      incrementor as Expr
    ) as T;
  } else if (isForInStmt(node) || isForOfStmt(node)) {
    const variableDecl = visitor(node.initializer);
    ensure(
      variableDecl,
      anyOf(isVariableDecl, isIdentifier),
      `Initializer in ${node.kind} must be a VariableDecl or Identifier`
    );

    const expr = visitor(node.expr);
    ensure(expr, isExpr, `Expr in ${node.kind} must be an Expr`);

    const body = visitBlockStmt(node.body, visitor);

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
    const parameters = node.parameters.flatMap((parameter) =>
      ensureSingleOrArray(
        visitor(parameter),
        isParameterDecl,
        `a ${node.kind}'s parameters must be ParameterDecl nodes`
      )
    );

    const body = visitBlockStmt(node.body, visitor);

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
  } else if (isPrivateIdentifier(node)) {
    return new PrivateIdentifier(node.name) as T;
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
      node.properties.flatMap((prop) =>
        ensureSingleOrArray(
          visitor(prop),
          isObjectElementExpr,
          "an ObjectLiteralExpr's properties must be ObjectElementExpr nodes"
        )
      )
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
    return new PropAccessExpr(expr, node.name, node.isOptional) as T;
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
    if (initializer) {
      ensure(initializer, isExpr, "A PropDecl's initializer must be an Expr");
    }

    return new PropDecl(name, node.isStatic, initializer) as T;
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
  } else if (isTaggedTemplateExpr(node)) {
    const tag = visitor(node.tag);
    ensure(tag, isExpr, "A TaggedTemplateExpr's tag must be an Expr");

    return new TaggedTemplateExpr(
      tag,
      node.exprs.flatMap((expr) =>
        ensureSingleOrArray(
          visitor(expr),
          isExpr,
          "a TaggedTemplateExpr's expr property must only contain Expr node types"
        )
      )
    ) as T;
  } else if (isTemplateExpr(node)) {
    return new TemplateExpr(
      node.exprs.flatMap((expr) =>
        ensureSingleOrArray(
          visitor(expr),
          isExpr,
          "a TemplateExpr's expr property must only contain Expr node types"
        )
      )
    ) as T;
  } else if (isThisExpr(node)) {
    return node.clone() as T;
  } else if (isThrowStmt(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "a ThrowStmt's expr must be an Expr node type");
    return new ThrowStmt(expr) as T;
  } else if (isTryStmt(node)) {
    const tryBlock = visitBlockStmt(node.tryBlock, visitor);

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
      ? visitBlockStmt(node.finallyBlock, visitor)
      : undefined;

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
    const declList = visitor(node.declList);
    ensure(
      declList,
      isVariableDeclList,
      "a VariableStmt's declList property must be an VariableDeclList"
    );
    return new VariableStmt(declList) as T;
  } else if (isVariableDeclList(node)) {
    const variables = node.decls.map(visitor);
    ensureItemOf(
      variables,
      isVariableDecl,
      "Variables in a VariableDeclList must be of type VariableDecl"
    );
    return new VariableDeclList(variables) as T;
  } else if (isVariableDecl(node)) {
    const expr = node.initializer ? visitor(node.initializer) : undefined;
    if (expr) {
      ensure(expr, isExpr, "a VariableDecl's expr property must be an Expr");
    }
    return new VariableDecl(node.name, expr) as T;
  } else if (isWhileStmt(node)) {
    const condition = visitor(node.condition);
    ensure(condition, isExpr, "a WhileStmt's condition must be an Expr");
    const block = visitBlockStmt(node.block, visitor);
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
    const clauses = node.clauses.flatMap((clause) =>
      ensureSingleOrArray(
        visitor(clause),
        isSwitchClause,
        "must be a CaseClause or DefaultClause"
      )
    );

    const defaultClauses = clauses.filter(isDefaultClause);
    if (defaultClauses.length === 1) {
      if (!isDefaultClause(clauses[clauses.length - 1])) {
        throw new SynthError(
          ErrorCodes.Unexpected_Error,
          `only the last SwitchClause can be a DefaultClause`
        );
      }
    } else if (defaultClauses.length > 1) {
      throw new SynthError(
        ErrorCodes.Unexpected_Error,
        `there must be 0 or 1 DefaultClauses in a single SwitchStmt, but found ${defaultClauses.length}`
      );
    }

    return new SwitchStmt(clauses) as T;
  } else if (isCaseClause(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, `the CaseClause's expr must be an Expr`);
    const stmts = node.statements.flatMap((stmt) =>
      ensureSingleOrArray(
        visitor(stmt),
        isStmt,
        `expected all items in a CaseClause's statements to be Stmt nodes`
      )
    );

    return new CaseClause(expr, stmts) as T;
  } else if (isDefaultClause(node)) {
    const stmts = node.statements.flatMap((stmt) =>
      ensureSingleOrArray(
        visitor(stmt),
        isStmt,
        `expected all items in a DefaultClause's statements to be Stmt nodes`
      )
    );

    return new DefaultClause(stmts) as T;
  } else if (isEmptyStmt(node)) {
    return node.clone() as T;
  } else if (isWithStmt(node)) {
    const expr = visitor(node.expr);
    const stmt = visitor(node.stmt);
    ensure(expr, isExpr, "WithStmt's expr must be an Expr");
    ensure(stmt, isStmt, "WithStmt's stmt must be a Stmt");
    return new WithStmt(expr, stmt) as T;
  } else if (isRegexExpr(node)) {
    return node.clone() as T;
  } else if (isDeleteExpr(node)) {
    const expr = visitor(node.expr);
    ensure(
      expr,
      anyOf(isPropAccessExpr, isElementAccessExpr),
      "DeleteExpr's expr must be PropAccessExpr or ElementAccessExpr"
    );
    return new DeleteExpr(expr) as T;
  } else if (isVoidExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "VoidExpr's expr must be an Expr");
    return new VoidExpr(expr) as T;
  } else if (isYieldExpr(node)) {
    let expr;
    if (node.expr) {
      expr = visitor(node.expr);
      ensure(expr, isExpr, "YieldExpr's expr must be an Expr");
    }
    return new YieldExpr(expr, node.delegate) as T;
  } else if (isParenthesizedExpr(node)) {
    const expr = visitor(node.expr);
    ensure(expr, isExpr, "ParenthesizedExpr's expr must be an Expr");
    return new ParenthesizedExpr(expr) as T;
  } else if (isImportKeyword(node)) {
    return node.clone() as T;
  } else if (isGetAccessorDecl(node)) {
    const name = visitor(node.name);
    const body = visitor(node.body);

    ensure(name, isPropName, `GetAccessorDecl's name must be a PropName`);
    ensure(body, isBlockStmt, "GetAccessorDecl's body must be a BlockStmt");

    return new GetAccessorDecl(name, body) as T;
  } else if (isSetAccessorDecl(node)) {
    const name = visitor(node.name);
    const parameter = visitor(node.parameter);
    const body = visitor(node.body);

    ensure(name, isPropName, `SetAccessorDecl's name must be a PropName`);
    ensure(
      parameter,
      isParameterDecl,
      `SetAccessorDecl's parameter must be a ParameterDecl`
    );
    ensure(body, isBlockStmt, "SetAccessorDecl's body must be a BlockStmt");

    return new SetAccessorDecl(name, parameter, body) as T;
  } else if (isOmittedExpr(node)) {
    return node.clone() as T;
  }
  return assertNever(node);
}

function visitBlockStmt(
  node: BlockStmt,
  visitor: (
    node: FunctionlessNode
  ) => FunctionlessNode | FunctionlessNode[] | undefined
): BlockStmt {
  let block = visitor(node);
  if (Array.isArray(block)) {
    block = flatten(block);
    ensureItemOf(block, isStmt, "Statements in BlockStmt must be Stmt nodes");
    return new BlockStmt(block);
  }
  ensure(block, isBlockStmt, `Body in ${node.kind} must be a BlockStmt`);
  return block;
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
      nestedTasks.push(
        new VariableStmt(
          new VariableDeclList([new VariableDecl(id.clone(), expr)])
        )
      );
      return id;
    }

    const updatedNode = cb(stmt as Stmt, hoist);

    return nestedTasks.length === 0
      ? updatedNode
      : [...nestedTasks, updatedNode];
  });
}

/**
 * Ensures that the {@link val} is either:
 * 1. a "single" instance of {@link T}
 * 2. an "array" of {@link T}
 *
 * @param val value to check
 * @param assertion assertion function to apply to a single instance
 * @param message error message to throw if the assertion is false
 * @returns an array of {@link T} for folding back into a visitEachChild result
 */
function ensureSingleOrArray<T>(
  val: any,
  assertion: (a: any) => a is T,
  message: string
): T[] {
  if (Array.isArray(val)) {
    val = val.flat();
    ensureItemOf(val, assertion, message);
    return val;
  } else {
    ensure(val, assertion, message);
    return [val];
  }
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

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
