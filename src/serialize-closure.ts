import ts from "typescript";
import { assertNever } from "./assert";
import { VariableDeclKind } from "./declaration";
import {
  isArgument,
  isArrayBinding,
  isArrayLiteralExpr,
  isArrowFunctionExpr,
  isAwaitExpr,
  isBigIntExpr,
  isBinaryExpr,
  isBindingElem,
  isBlockStmt,
  isBooleanLiteralExpr,
  isBreakStmt,
  isCallExpr,
  isCaseClause,
  isCatchClause,
  isClassDecl,
  isClassExpr,
  isClassStaticBlockDecl,
  isComputedPropertyNameExpr,
  isConditionExpr,
  isConstructorDecl,
  isContinueStmt,
  isDebuggerStmt,
  isDefaultClause,
  isDeleteExpr,
  isDoStmt,
  isElementAccessExpr,
  isEmptyStmt,
  isErr,
  isExprStmt,
  isForInStmt,
  isForOfStmt,
  isForStmt,
  isFunctionDecl,
  isFunctionExpr,
  isFunctionLike,
  isGetAccessorDecl,
  isIdentifier,
  isIfStmt,
  isImportKeyword,
  isLabelledStmt,
  isMethodDecl,
  isNewExpr,
  isNoSubstitutionTemplateLiteral,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectBinding,
  isObjectLiteralExpr,
  isOmittedExpr,
  isParameterDecl,
  isParenthesizedExpr,
  isPostfixUnaryExpr,
  isPrivateIdentifier,
  isPropAccessExpr,
  isPropAssignExpr,
  isPropDecl,
  isReferenceExpr,
  isRegexExpr,
  isReturnStmt,
  isSetAccessorDecl,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isSuperKeyword,
  isSwitchStmt,
  isTaggedTemplateExpr,
  isTemplateExpr,
  isTemplateHead,
  isTemplateMiddle,
  isTemplateSpan,
  isTemplateTail,
  isThisExpr,
  isThrowStmt,
  isTryStmt,
  isTypeOfExpr,
  isUnaryExpr,
  isUndefinedLiteralExpr,
  isVariableDecl,
  isVariableDeclList,
  isVariableStmt,
  isVoidExpr,
  isWhileStmt,
  isWithStmt,
  isYieldExpr,
} from "./guards";
import { FunctionlessNode } from "./node";
import { reflect } from "./reflect";
import { AnyFunction } from "./util";

export function serializeClosure(func: AnyFunction): string {
  const requireCache = new Map(
    Object.entries(require.cache).flatMap(([path, module]) =>
      Object.entries(module ?? {}).map(([exportName, exportValue]) => [
        exportValue,
        {
          path,
          exportName,
          exportValue,
          module,
        },
      ])
    )
  );
  let i = 0;
  const uniqueName = () => {
    return `v${i++}`;
  };

  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });

  const statements: ts.Statement[] = [];

  function emit(...statements: ts.Statement[]) {
    statements.push(...statements);
  }

  function emitVarDecl(
    expr: ts.Expression,
    varKind: "const" | "let" | "var" = "const"
  ): ts.Identifier {
    const name = uniqueName();
    emit(
      ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              name,
              undefined,
              undefined,
              expr
            ),
          ],
          varKind === "var"
            ? ts.NodeFlags.None
            : varKind === "const"
            ? ts.NodeFlags.Const
            : ts.NodeFlags.Let
        )
      )
    );
    return ts.factory.createIdentifier(name);
  }

  const valueIds = new Map<any, ts.Expression>();

  emit(expr(assign(prop(id("exports"), "handler"), serialize(func))));

  return printer.printFile(
    ts.factory.createSourceFile(
      statements,
      ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.JavaScriptFile
    )
  );

  function serialize(value: any): ts.Expression {
    let id = valueIds.get(value);
    if (id) {
      return id;
    }
    id = serializeValue(value);
    valueIds.set(value, id);
    return id;
  }

  function serializeValue(value: any): ts.Expression {
    if (value === undefined) {
      return undefined_expr();
    } else if (value === null) {
      return null_expr();
    } else if (value === true) {
      return true_expr();
    } else if (value === false) {
      return false_expr();
    } else if (typeof value === "number") {
      return num(value);
    } else if (typeof value === "bigint") {
      return ts.factory.createBigIntLiteral(value.toString(10));
    } else if (typeof value === "string") {
      return string(value);
    } else if (value instanceof RegExp) {
      return ts.factory.createRegularExpressionLiteral(value.source);
    } else if (value instanceof Date) {
      return ts.factory.createNewExpression(id("Date"), undefined, [
        num(value.getTime()),
      ]);
    } else if (Array.isArray(value)) {
      // TODO: should we check the array's prototype?

      // emit an empty array
      // var vArr = []
      const arr = emitVarDecl(ts.factory.createArrayLiteralExpression([]));

      // cache the empty array now in case any of the items in the array circularly reference the array
      valueIds.set(value, arr);

      // for each item in the array, serialize the value and push it into the array
      // vArr.push(vItem1, vItem2)
      emit(expr(call(prop(arr, "push"), value.map(serialize))));

      return arr;
    } else if (typeof value === "object") {
      // serialize the prototype first
      // there should be no circular references between an object instance and its prototype
      // if we need to handle circular references between an instance and prototype, then we can
      // switch to a strategy of emitting an object and then calling Object.setPrototypeOf
      const prototype = serialize(Object.getPrototypeOf(value));

      // emit an empty object with the correct prototype
      // e.g. `var vObj = Object.create(vPrototype);`
      const obj = emitVarDecl(call(prop(id("Object"), "create"), [prototype]));

      // cache the empty object nwo in case any of the properties in teh array circular reference the object
      valueIds.set(value, obj);

      // for each of the object's own properties, emit a statement that assigns the value of that property
      // vObj.propName = vValue
      Object.getOwnPropertyNames(value).forEach((propName) =>
        emit(expr(assign(prop(obj, propName), serialize(value[propName]))))
      );

      return obj;
    } else if (typeof value === "function") {
      const ast = reflect(func);

      if (ast === undefined) {
        // if this is not compiled by functionless, we can only serialize it if it is exported by a module
        const mod = requireCache.get(func);
        if (mod === undefined) {
          throw new Error(
            `cannot serialize closures that were not compiled with Functionless unless they are exported by a module: ${func}`
          );
        }
        // const vMod = require("module-name");
        const moduleName = emitVarDecl(call(id("require"), [string(mod.path)]));

        // const vFunc = vMod.prop
        return emitVarDecl(prop(moduleName, mod.exportName));
      } else if (isFunctionLike(ast)) {
        return emitVarDecl(serializeAST(ast) as ts.Expression);
      } else {
        throw ast.error;
      }
    }

    throw new Error("not implemented");
  }

  function serializeAST(node: FunctionlessNode): ts.Node {
    if (isReferenceExpr(node)) {
      return serialize(node.ref());
    } else if (isArrowFunctionExpr(node)) {
      return ts.factory.createArrowFunction(
        node.isAsync
          ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
          : undefined,
        undefined,
        node.parameters.map(
          (param) => serializeAST(param) as ts.ParameterDeclaration
        ),
        undefined,
        undefined,
        serializeAST(node.body) as ts.Block
      );
    } else if (isFunctionDecl(node)) {
      return ts.factory.createFunctionDeclaration(
        undefined,
        node.isAsync
          ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
          : undefined,
        node.isAsterisk
          ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
          : undefined,
        node.name,
        undefined,
        node.parameters.map(
          (param) => serializeAST(param) as ts.ParameterDeclaration
        ),
        undefined,
        serializeAST(node.body) as ts.Block
      );
    } else if (isFunctionExpr(node)) {
      return ts.factory.createFunctionExpression(
        node.isAsync
          ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
          : undefined,
        node.isAsterisk
          ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
          : undefined,
        node.name,
        undefined,
        node.parameters.map(
          (param) => serializeAST(param) as ts.ParameterDeclaration
        ),
        undefined,
        serializeAST(node.body) as ts.Block
      );
    } else if (isParameterDecl(node)) {
      return ts.factory.createParameterDeclaration(
        undefined,
        undefined,
        node.isRest
          ? ts.factory.createToken(ts.SyntaxKind.DotDotDotToken)
          : undefined,
        serializeAST(node.name) as ts.BindingName,
        undefined,
        undefined,
        node.initializer
          ? (serializeAST(node.initializer) as ts.Expression)
          : undefined
      );
    } else if (isBlockStmt(node)) {
      return ts.factory.createBlock(
        node.statements.map((stmt) => serializeAST(stmt) as ts.Statement)
      );
    } else if (isThisExpr(node)) {
      return ts.factory.createThis();
    } else if (isSuperKeyword(node)) {
      return ts.factory.createSuper();
    } else if (isIdentifier(node)) {
      return ts.factory.createIdentifier(node.name);
    } else if (isPrivateIdentifier(node)) {
      return ts.factory.createPrivateIdentifier(node.name);
    } else if (isPropAccessExpr(node)) {
      return ts.factory.createPropertyAccessChain(
        serializeAST(node.expr) as ts.Expression,
        node.isOptional
          ? ts.factory.createToken(ts.SyntaxKind.QuestionDotToken)
          : undefined,
        serializeAST(node.name) as ts.MemberName
      );
    } else if (isElementAccessExpr(node)) {
      return ts.factory.createElementAccessChain(
        serializeAST(node.expr) as ts.Expression,
        node.isOptional
          ? ts.factory.createToken(ts.SyntaxKind.QuestionDotToken)
          : undefined,
        serializeAST(node.element) as ts.Expression
      );
    } else if (isCallExpr(node)) {
      return ts.factory.createCallExpression(
        serializeAST(node.expr) as ts.Expression,
        undefined,
        node.args.map((arg) => serializeAST(arg) as ts.Expression)
      );
    } else if (isNewExpr(node)) {
      return ts.factory.createCallExpression(
        serializeAST(node.expr) as ts.Expression,
        undefined,
        node.args.map((arg) => serializeAST(arg) as ts.Expression)
      );
    } else if (isArgument(node)) {
      return serializeAST(node.expr);
    } else if (isUndefinedLiteralExpr(node)) {
      return ts.factory.createIdentifier("undefined");
    } else if (isNullLiteralExpr(node)) {
      return ts.factory.createNull();
    } else if (isBooleanLiteralExpr(node)) {
      return node.value ? ts.factory.createTrue() : ts.factory.createFalse();
    } else if (isNumberLiteralExpr(node)) {
      return ts.factory.createNumericLiteral(node.value);
    } else if (isBigIntExpr(node)) {
      return ts.factory.createBigIntLiteral(node.value.toString(10));
    } else if (isStringLiteralExpr(node)) {
      return string(node.value);
    } else if (isArrayLiteralExpr(node)) {
      return ts.factory.createArrayLiteralExpression(
        node.items.map((item) => serializeAST(item) as ts.Expression),
        undefined
      );
    } else if (isSpreadElementExpr(node)) {
      return ts.factory.createSpreadElement(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isObjectLiteralExpr(node)) {
      return ts.factory.createObjectLiteralExpression(
        node.properties.map(
          (prop) => serializeAST(prop) as ts.ObjectLiteralElementLike
        ),
        undefined
      );
    } else if (isPropAssignExpr(node)) {
      return ts.factory.createPropertyAssignment(
        serializeAST(node.name) as ts.PropertyName,
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isSpreadAssignExpr(node)) {
      return ts.factory.createSpreadElement(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isComputedPropertyNameExpr(node)) {
      return ts.factory.createComputedPropertyName(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isOmittedExpr(node)) {
      return ts.factory.createOmittedExpression();
    } else if (isVariableStmt(node)) {
      return ts.factory.createVariableStatement(
        undefined,
        serializeAST(node.declList) as ts.VariableDeclarationList
      );
    } else if (isVariableDeclList(node)) {
      return ts.factory.createVariableDeclarationList(
        node.decls.map((decl) => serializeAST(decl) as ts.VariableDeclaration),
        node.varKind === VariableDeclKind.Const
          ? ts.NodeFlags.Const
          : node.varKind === VariableDeclKind.Let
          ? ts.NodeFlags.Let
          : ts.NodeFlags.None
      );
    } else if (isVariableDecl(node)) {
      return ts.factory.createVariableDeclaration(
        serializeAST(node.name) as ts.BindingName,
        undefined,
        undefined,
        node.initializer
          ? (serializeAST(node.initializer) as ts.Expression)
          : undefined
      );
    } else if (isBindingElem(node)) {
      return ts.factory.createBindingElement(
        node.rest
          ? ts.factory.createToken(ts.SyntaxKind.DotDotDotToken)
          : undefined,
        node.propertyName
          ? (serializeAST(node.propertyName) as ts.PropertyName)
          : undefined,
        serializeAST(node.name) as ts.BindingName,
        node.initializer
          ? (serializeAST(node.initializer) as ts.Expression)
          : undefined
      );
    } else if (isObjectBinding(node)) {
      return ts.factory.createObjectBindingPattern(
        node.bindings.map(
          (binding) => serializeAST(binding) as ts.BindingElement
        )
      );
    } else if (isArrayBinding(node)) {
      return ts.factory.createArrayBindingPattern(
        node.bindings.map(
          (binding) => serializeAST(binding) as ts.BindingElement
        )
      );
    } else if (isClassDecl(node) || isClassExpr(node)) {
      return (
        isClassDecl(node)
          ? ts.factory.createClassDeclaration
          : ts.factory.createClassExpression
      )(
        undefined,
        undefined,
        node.name,
        undefined,
        node.heritage
          ? [serializeAST(node.heritage) as ts.HeritageClause]
          : undefined,
        node.members.map((member) => serializeAST(member) as ts.ClassElement)
      );
    } else if (isClassStaticBlockDecl(node)) {
      return ts.factory.createClassStaticBlockDeclaration(
        undefined,
        undefined,
        serializeAST(node.block) as ts.Block
      );
    } else if (isConstructorDecl(node)) {
      return ts.factory.createConstructorDeclaration(
        undefined,
        undefined,
        node.parameters.map(
          (param) => serializeAST(param) as ts.ParameterDeclaration
        ),
        serializeAST(node.body) as ts.Block
      );
    } else if (isPropDecl(node)) {
      return ts.factory.createPropertyDeclaration(
        undefined,
        node.isStatic
          ? [ts.factory.createModifier(ts.SyntaxKind.StaticKeyword)]
          : undefined,
        serializeAST(node.name) as ts.PropertyName,
        undefined,
        undefined,
        node.initializer
          ? (serializeAST(node.initializer) as ts.Expression)
          : undefined
      );
    } else if (isMethodDecl(node)) {
      return ts.factory.createMethodDeclaration(
        undefined,
        node.isAsync
          ? [ts.factory.createModifier(ts.SyntaxKind.AsyncKeyword)]
          : undefined,
        node.isAsterisk
          ? ts.factory.createToken(ts.SyntaxKind.AsteriskToken)
          : undefined,
        serializeAST(node.name) as ts.PropertyName,
        undefined,
        undefined,
        node.parameters.map(
          (param) => serializeAST(param) as ts.ParameterDeclaration
        ),
        undefined,
        serializeAST(node.body) as ts.Block
      );
    } else if (isGetAccessorDecl(node)) {
      return ts.factory.createGetAccessorDeclaration(
        undefined,
        undefined,
        serializeAST(node.name) as ts.PropertyName,
        [],
        undefined,
        serializeAST(node.body) as ts.Block
      );
    } else if (isSetAccessorDecl(node)) {
      return ts.factory.createSetAccessorDeclaration(
        undefined,
        undefined,
        serializeAST(node.name) as ts.PropertyName,
        [serializeAST(node.parameter) as ts.ParameterDeclaration],
        serializeAST(node.body) as ts.Block
      );
    } else if (isExprStmt(node)) {
      return ts.factory.createExpressionStatement(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isAwaitExpr(node)) {
      return ts.factory.createAwaitExpression(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isYieldExpr(node)) {
      if (node.delegate) {
        return ts.factory.createYieldExpression(
          ts.factory.createToken(ts.SyntaxKind.AsteriskToken),
          serializeAST(node.expr) as ts.Expression
        );
      } else {
        return ts.factory.createYieldExpression(
          undefined,
          serializeAST(node.expr) as ts.Expression
        );
      }
    } else if (isUnaryExpr(node)) {
      return ts.factory.createPrefixUnaryExpression(
        node.op === "!"
          ? ts.SyntaxKind.ExclamationToken
          : node.op === "+"
          ? ts.SyntaxKind.PlusToken
          : node.op === "++"
          ? ts.SyntaxKind.PlusPlusToken
          : node.op === "-"
          ? ts.SyntaxKind.MinusToken
          : node.op === "--"
          ? ts.SyntaxKind.MinusMinusToken
          : node.op === "~"
          ? ts.SyntaxKind.TildeToken
          : assertNever(node.op),
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isPostfixUnaryExpr(node)) {
      return ts.factory.createPostfixUnaryExpression(
        serializeAST(node.expr) as ts.Expression,
        node.op === "++"
          ? ts.SyntaxKind.PlusPlusToken
          : node.op === "--"
          ? ts.SyntaxKind.MinusMinusToken
          : assertNever(node.op)
      );
    } else if (isBinaryExpr(node)) {
      return ts.factory.createBinaryExpression(
        serializeAST(node.left) as ts.Expression,
        node.op === "!="
          ? ts.SyntaxKind.ExclamationEqualsToken
          : node.op === "!=="
          ? ts.SyntaxKind.ExclamationEqualsEqualsToken
          : node.op === "=="
          ? ts.SyntaxKind.EqualsEqualsToken
          : node.op === "==="
          ? ts.SyntaxKind.EqualsEqualsEqualsToken
          : node.op === "%"
          ? ts.SyntaxKind.PercentToken
          : node.op === "%="
          ? ts.SyntaxKind.PercentEqualsToken
          : node.op === "&&"
          ? ts.SyntaxKind.AmpersandAmpersandToken
          : node.op === "&"
          ? ts.SyntaxKind.AmpersandAmpersandToken
          : node.op === "*"
          ? ts.SyntaxKind.AsteriskToken
          : node.op === "**"
          ? ts.SyntaxKind.AsteriskToken
          : node.op === "&&="
          ? ts.SyntaxKind.AmpersandAmpersandEqualsToken
          : node.op === "&="
          ? ts.SyntaxKind.AmpersandEqualsToken
          : node.op === "**="
          ? ts.SyntaxKind.AsteriskAsteriskEqualsToken
          : node.op === "*="
          ? ts.SyntaxKind.AsteriskEqualsToken
          : node.op === "+"
          ? ts.SyntaxKind.PlusToken
          : node.op === "+="
          ? ts.SyntaxKind.PlusEqualsToken
          : node.op === ","
          ? ts.SyntaxKind.CommaToken
          : node.op === "-"
          ? ts.SyntaxKind.MinusToken
          : node.op === "-="
          ? ts.SyntaxKind.MinusEqualsToken
          : node.op === "/"
          ? ts.SyntaxKind.SlashToken
          : node.op === "/="
          ? ts.SyntaxKind.SlashEqualsToken
          : node.op === "<"
          ? ts.SyntaxKind.LessThanToken
          : node.op === "<="
          ? ts.SyntaxKind.LessThanEqualsToken
          : node.op === "<<"
          ? ts.SyntaxKind.LessThanLessThanToken
          : node.op === "<<="
          ? ts.SyntaxKind.LessThanLessThanEqualsToken
          : node.op === "="
          ? ts.SyntaxKind.EqualsToken
          : node.op === ">"
          ? ts.SyntaxKind.GreaterThanToken
          : node.op === ">>"
          ? ts.SyntaxKind.GreaterThanGreaterThanToken
          : node.op === ">>>"
          ? ts.SyntaxKind.GreaterThanGreaterThanGreaterThanToken
          : node.op === ">="
          ? ts.SyntaxKind.GreaterThanEqualsToken
          : node.op === ">>="
          ? ts.SyntaxKind.GreaterThanGreaterThanEqualsToken
          : node.op === ">>>="
          ? ts.SyntaxKind.GreaterThanGreaterThanGreaterThanEqualsToken
          : node.op === "??"
          ? ts.SyntaxKind.QuestionQuestionToken
          : node.op === "??="
          ? ts.SyntaxKind.QuestionQuestionEqualsToken
          : node.op === "^"
          ? ts.SyntaxKind.CaretToken
          : node.op === "^="
          ? ts.SyntaxKind.CaretEqualsToken
          : node.op === "in"
          ? ts.SyntaxKind.InKeyword
          : node.op === "instanceof"
          ? ts.SyntaxKind.InstanceOfKeyword
          : node.op === "|"
          ? ts.SyntaxKind.BarToken
          : node.op === "||"
          ? ts.SyntaxKind.BarBarToken
          : node.op === "|="
          ? ts.SyntaxKind.BarEqualsToken
          : node.op === "||="
          ? ts.SyntaxKind.BarBarEqualsToken
          : assertNever(node.op),
        serializeAST(node.right) as ts.Expression
      );
    } else if (isConditionExpr(node)) {
      return ts.factory.createConditionalExpression(
        serializeAST(node.when) as ts.Expression,
        undefined,
        serializeAST(node.then) as ts.Expression,
        undefined,
        serializeAST(node._else) as ts.Expression
      );
    } else if (isIfStmt(node)) {
      return ts.factory.createIfStatement(
        serializeAST(node.when) as ts.Expression,
        serializeAST(node.then) as ts.Statement,
        node._else ? (serializeAST(node._else) as ts.Statement) : undefined
      );
    } else if (isSwitchStmt(node)) {
      return ts.factory.createSwitchStatement(
        serializeAST(node.expr) as ts.Expression,
        ts.factory.createCaseBlock(
          node.clauses.map(
            (clause) => serializeAST(clause) as ts.CaseOrDefaultClause
          )
        )
      );
    } else if (isCaseClause(node)) {
      return ts.factory.createCaseClause(
        serializeAST(node.expr) as ts.Expression,
        node.statements.map((stmt) => serializeAST(stmt) as ts.Statement)
      );
    } else if (isDefaultClause(node)) {
      return ts.factory.createDefaultClause(
        node.statements.map((stmt) => serializeAST(stmt) as ts.Statement)
      );
    } else if (isForStmt(node)) {
      return ts.factory.createForStatement(
        node.initializer
          ? (serializeAST(node.initializer) as ts.ForInitializer)
          : undefined,
        node.condition
          ? (serializeAST(node.condition) as ts.Expression)
          : undefined,
        node.incrementor
          ? (serializeAST(node.incrementor) as ts.Expression)
          : undefined,
        serializeAST(node.body) as ts.Statement
      );
    } else if (isForOfStmt(node)) {
      return ts.factory.createForOfStatement(
        node.isAwait
          ? ts.factory.createToken(ts.SyntaxKind.AwaitKeyword)
          : undefined,
        serializeAST(node.initializer) as ts.ForInitializer,
        serializeAST(node.expr) as ts.Expression,
        serializeAST(node.body) as ts.Statement
      );
    } else if (isForInStmt(node)) {
      return ts.factory.createForInStatement(
        serializeAST(node.initializer) as ts.ForInitializer,
        serializeAST(node.expr) as ts.Expression,
        serializeAST(node.body) as ts.Statement
      );
    } else if (isWhileStmt(node)) {
      return ts.factory.createWhileStatement(
        serializeAST(node.condition) as ts.Expression,
        serializeAST(node.block) as ts.Statement
      );
    } else if (isDoStmt(node)) {
      return ts.factory.createDoStatement(
        serializeAST(node.block) as ts.Statement,
        serializeAST(node.condition) as ts.Expression
      );
    } else if (isBreakStmt(node)) {
      return ts.factory.createBreakStatement(
        node.label ? (serializeAST(node.label) as ts.Identifier) : undefined
      );
    } else if (isContinueStmt(node)) {
      return ts.factory.createContinueStatement(
        node.label ? (serializeAST(node.label) as ts.Identifier) : undefined
      );
    } else if (isLabelledStmt(node)) {
      return ts.factory.createLabeledStatement(
        serializeAST(node.label) as ts.Identifier,
        serializeAST(node.stmt) as ts.Statement
      );
    } else if (isTryStmt(node)) {
      return ts.factory.createTryStatement(
        serializeAST(node.tryBlock) as ts.Block,
        node.catchClause
          ? (serializeAST(node.catchClause) as ts.CatchClause)
          : undefined,
        node.finallyBlock
          ? (serializeAST(node.finallyBlock) as ts.Block)
          : undefined
      );
    } else if (isCatchClause(node)) {
      return ts.factory.createCatchClause(
        node.variableDecl
          ? (serializeAST(node.variableDecl) as ts.VariableDeclaration)
          : undefined,
        serializeAST(node.block) as ts.Block
      );
    } else if (isThrowStmt(node)) {
      return ts.factory.createThrowStatement(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isDeleteExpr(node)) {
      return ts.factory.createDeleteExpression(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isParenthesizedExpr(node)) {
      return ts.factory.createParenthesizedExpression(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isRegexExpr(node)) {
      return ts.factory.createRegularExpressionLiteral(node.regex.source);
    } else if (isTemplateExpr(node)) {
      return ts.factory.createTemplateExpression(
        serializeAST(node.head) as ts.TemplateHead,
        node.spans.map((span) => serializeAST(span) as ts.TemplateSpan)
      );
    } else if (isTaggedTemplateExpr(node)) {
      return ts.factory.createTaggedTemplateExpression(
        serializeAST(node.tag) as ts.Expression,
        undefined,
        serializeAST(node.template) as ts.TemplateLiteral
      );
    } else if (isNoSubstitutionTemplateLiteral(node)) {
      return ts.factory.createNoSubstitutionTemplateLiteral(node.text);
    } else if (isTemplateHead(node)) {
      return ts.factory.createTemplateHead(node.text);
    } else if (isTemplateSpan(node)) {
      return ts.factory.createTemplateSpan(
        serializeAST(node.expr) as ts.Expression,
        serializeAST(node.literal) as ts.TemplateMiddle | ts.TemplateTail
      );
    } else if (isTemplateMiddle(node)) {
      return ts.factory.createTemplateMiddle(node.text);
    } else if (isTemplateTail(node)) {
      return ts.factory.createTemplateTail(node.text);
    } else if (isTypeOfExpr(node)) {
      return ts.factory.createTypeOfExpression(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isVoidExpr(node)) {
      return ts.factory.createVoidExpression(
        serializeAST(node.expr) as ts.Expression
      );
    } else if (isDebuggerStmt(node)) {
      return ts.factory.createDebuggerStatement();
    } else if (isEmptyStmt(node)) {
      return ts.factory.createEmptyStatement();
    } else if (isReturnStmt(node)) {
      return ts.factory.createReturnStatement(
        node.expr ? (serializeAST(node.expr) as ts.Expression) : undefined
      );
    } else if (isImportKeyword(node)) {
      return ts.factory.createToken(ts.SyntaxKind.ImportKeyword);
    } else if (isWithStmt(node)) {
      return ts.factory.createWithStatement(
        serializeAST(node.expr) as ts.Expression,
        serializeAST(node.stmt) as ts.Statement
      );
    } else if (isErr(node)) {
      throw node.error;
    } else {
      return assertNever(node);
    }
  }
}

function undefined_expr() {
  return ts.factory.createIdentifier("undefined");
}

function null_expr() {
  return ts.factory.createNull();
}

function true_expr() {
  return ts.factory.createTrue();
}

function false_expr() {
  return ts.factory.createFalse();
}

function id(name: string) {
  return ts.factory.createIdentifier(name);
}

function string(name: string) {
  return ts.factory.createStringLiteral(name);
}

function num(num: number) {
  return ts.factory.createNumericLiteral(num);
}

function prop(expr: ts.Expression, name: string) {
  return ts.factory.createPropertyAccessExpression(expr, name);
}

function assign(left: ts.Expression, right: ts.Expression) {
  return ts.factory.createBinaryExpression(
    left,
    ts.factory.createToken(ts.SyntaxKind.EqualsToken),
    right
  );
}

function call(expr: ts.Expression, args: ts.Expression[]) {
  return ts.factory.createCallExpression(expr, undefined, args);
}

function expr(expr: ts.Expression): ts.Statement {
  return ts.factory.createExpressionStatement(expr);
}
