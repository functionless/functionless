import ts from "typescript";
import { assertNever } from "./assert";
import {
  isArrayLiteralExpr,
  isArrowFunctionExpr,
  isBigIntExpr,
  isBlockStmt,
  isBooleanLiteralExpr,
  isCallExpr,
  isElementAccessExpr,
  isFunctionDecl,
  isFunctionExpr,
  isFunctionLike,
  isIdentifier,
  isNewExpr,
  isNullLiteralExpr,
  isNumberLiteralExpr,
  isObjectLiteralExpr,
  isOmittedExpr,
  isParameterDecl,
  isPropAccessExpr,
  isPropAssignExpr,
  isSpreadAssignExpr,
  isSpreadElementExpr,
  isStringLiteralExpr,
  isUndefinedLiteralExpr,
  isVariableDecl,
  isVariableDeclList,
  isVariableStmt,
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
  ): string {
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
    return name;
  }

  const valueIds = new Map<any, string>();

  emit(expr(assign(prop(id("exports"), "handler"), id(serialize(func)))));

  return printer.printFile(
    ts.factory.createSourceFile(
      statements,
      ts.factory.createToken(ts.SyntaxKind.EndOfFileToken),
      ts.NodeFlags.JavaScriptFile
    )
  );

  function serialize(value: any): string {
    let id = valueIds.get(value);
    if (id) {
      return id;
    }
    id = serializeValue(value);
    valueIds.set(value, id);
    return id;
  }

  function serializeValue(value: any) {
    if (value === undefined) {
    } else if (value === null) {
    } else if (typeof value === "object") {
      // serialize the prototype first
      // there should be no circular references between an object instance and its prototype
      // if we need to handle circular references between an instance and prototype, then we can
      // switch to a strategy of emitting an object and then calling Object.setPrototypeOf
      const prototype = serialize(Object.getPrototypeOf(value));

      // emit an empty object with the correct prototype
      // e.g. `var vObj = Object.create(vPrototype);`
      const obj = emitVarDecl(
        call(prop(id("Object"), "create"), [id(prototype)])
      );

      /**
       * Cache the emitted value so that any circular object references serialize without issue.
       *
       * e.g.
       *
       * The following objects circularly reference each other:
       * ```ts
       * const a = {};
       * const b = { a };
       * a.b = b;
       * ```
       *
       * Serializing `b` will emit the following code:
       * ```ts
       * const b = {};
       * const a = {};
       * a.b = b;
       * b.a = a;
       * ```
       */
      valueIds.set(value, obj);

      // for each of the object's own properties, emit a statement that assigns the value of that property
      // vObj.propName = vValue
      Object.getOwnPropertyNames(value).forEach((propName) =>
        emit(
          expr(assign(prop(id(obj), propName), id(serialize(value[propName]))))
        )
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
        return emitVarDecl(prop(id(moduleName), mod.exportName));
      } else if (isFunctionLike(ast)) {
        return emitVarDecl(serializeAST(ast) as ts.Expression);
      } else {
        throw ast.error;
      }
    }

    throw new Error("not implemented");
  }

  function serializeAST(node: FunctionlessNode): ts.Node {
    if (isArrowFunctionExpr(node)) {
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
    } else if (isIdentifier(node)) {
      return ts.factory.createIdentifier(node.name);
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
    } else if (isOmittedExpr(node)) {
      return ts.factory.createOmittedExpression();
    } else if (isVariableStmt(node)) {
      return ts.factory.createVariableStatement(
        undefined,
        serializeAST(node.declList) as ts.VariableDeclarationList
      );
    } else if (isVariableDeclList(node)) {
      return ts.factory.createVariableDeclarationList(
        node.decls.map((decl) => serializeAST(decl) as ts.VariableDeclaration)
      );
    } else {
      return assertNever(node);
    }

    throw new Error("not yet implemented");
  }
}

function id(name: string) {
  return ts.factory.createIdentifier(name);
}

function string(name: string) {
  return ts.factory.createStringLiteral(name);
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
