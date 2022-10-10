/* eslint-disable no-bitwise */
import path from "path";
import {
  ArrowFunctionExpr,
  BinaryOp,
  BindFunctionName,
  ConstructorDecl,
  FunctionDecl,
  FunctionExpr,
  MethodDecl,
  NodeKind,
  PostfixUnaryOp,
  ReflectionSymbolNames,
  RegisterFunctionName,
  UnaryOp,
  VariableDeclKind,
} from "@functionless/ast";
import { ErrorCodes, SynthError } from "@functionless/error-code";
import { assertDefined } from "@functionless/util";
import minimatch from "minimatch";
import type { PluginConfig, TransformerExtras } from "ts-patch";
import ts from "typescript";
import { makeFunctionlessChecker } from "./checker";

export default compile;

/**
 * Configuration options for the functionless TS transform.
 */
export interface FunctionlessConfig extends PluginConfig {
  /**
   * Glob to exclude
   */
  exclude?: string[];
}

/**
 * TypeScript Transformer which transforms functionless functions, such as `AppsyncResolver`,
 * into an AST that can be interpreted at CDK synth time to produce VTL templates and AppSync
 * Resolver configurations.
 *
 * @param program the TypeScript {@link ts.Program}
 * @param config the {@link FunctionlessConfig}.
 * @param _extras
 * @returns the transformer
 */
export function compile(
  program: ts.Program,
  _config?: FunctionlessConfig,
  _extras?: TransformerExtras
): ts.TransformerFactory<ts.SourceFile> {
  const excludeMatchers = _config?.exclude
    ? _config.exclude.map((pattern) => minimatch.makeRe(path.resolve(pattern)))
    : [];
  const checker = makeFunctionlessChecker(program.getTypeChecker());

  return (ctx) => {
    const functionless = ts.factory.createUniqueName("functionless");
    return (sf) => {
      // Do not transform any of the files matched by "exclude"
      if (excludeMatchers.some((matcher) => matcher.test(sf.fileName))) {
        return sf;
      }

      const functionlessContext = {
        requireFunctionless: false,
        get functionless() {
          this.requireFunctionless = true;
          return functionless;
        },
      };

      const functionlessImport = ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamespaceImport(functionless)
        ),
        ts.factory.createStringLiteral("functionless")
      );

      const registerName = ts.factory.createIdentifier(RegisterFunctionName);
      const bindName = ts.factory.createIdentifier(BindFunctionName);
      const globals: (ts.FunctionDeclaration | ts.Statement)[] = [
        createRegisterFunctionDeclaration(registerName),
        createBindFunctionDeclaration(bindName),
      ];

      const statements = globals.concat(
        sf.statements.map(
          (stmt) => visitor(stmt) as ts.Statement | ts.FunctionDeclaration
        )
      );

      return ts.factory.updateSourceFile(
        sf,
        [
          // only require functionless if it is used.
          ...(functionlessContext.requireFunctionless
            ? [functionlessImport]
            : []),
          ...statements,
        ],
        sf.isDeclarationFile,
        sf.referencedFiles,
        sf.typeReferenceDirectives,
        sf.hasNoDefaultLib,
        sf.libReferenceDirectives
      );

      function visitor(node: ts.Node): ts.Node | ts.Node[] {
        if (ts.isFunctionExpression(node)) {
          return register(
            ts.visitEachChild(node, visitor, ctx),
            toFunction(NodeKind.FunctionExpr, node, node)
          );
        } else if (ts.isArrowFunction(node)) {
          return register(
            ts.visitEachChild(node, visitor, ctx),
            toFunction(NodeKind.ArrowFunctionExpr, node, node)
          );
        } else if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.name) &&
          node.expression.name.text === "bind"
        ) {
          // potentially a func.bind(self, ..args) call
          // wrap in the generated bind function wrapper
          return ts.factory.createCallExpression(bindName, undefined, [
            node.expression.expression,
            ...node.arguments,
          ]);
        } else if (ts.isBlock(node)) {
          return ts.factory.updateBlock(node, [
            ...node.statements.flatMap((stmt) => {
              if (ts.isFunctionDeclaration(stmt) && stmt.name && stmt.body) {
                // hoist statements to register each function declaration within the block
                return [
                  ts.factory.createExpressionStatement(
                    register(
                      stmt.name,
                      toFunction(NodeKind.FunctionDecl, stmt, stmt)
                    )
                  ),
                ];
              } else {
                return [];
              }
            }),
            ...node.statements.map((stmt) =>
              ts.visitEachChild(stmt, visitor, ctx)
            ),
          ]);
        }
        // nothing special about this node, continue walking
        return ts.visitEachChild(node, visitor, ctx);
      }

      function register(func: ts.Expression, ast: ts.Expression) {
        return ts.factory.createCallExpression(registerName, undefined, [
          func,
          ts.factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            undefined,
            ast
          ),
        ]);
      }

      /**
       * Catches any errors and wraps them in a {@link Err} node.
       */
      function errorBoundary<T extends ts.Node>(
        span: ts.Node,
        func: () => T
      ): T | ts.ArrayLiteralExpression {
        try {
          return func();
        } catch (err) {
          const error =
            err instanceof Error ? err : Error("Unknown compiler error.");
          return newExpr(NodeKind.Err, span, [
            ts.factory.createNewExpression(
              ts.factory.createIdentifier(error.name),
              undefined,
              [ts.factory.createStringLiteral(error.message)]
            ),
          ]);
        }
      }

      function toFunction(
        type:
          | FunctionDecl["kind"]
          | ArrowFunctionExpr["kind"]
          | FunctionExpr["kind"]
          | ConstructorDecl["kind"]
          | MethodDecl["kind"],
        impl: ts.Node,
        /**
         * Scope used to determine the accessability of identifiers.
         * Functionless considers identifiers in a closure and all nested closures to be in scope.
         *
         * ```ts
         * const a;
         * new Function(async () => {
         *    const b;
         *    return [1].map((item) => {
         *       a // out of scope
         *       b // in scope
         *       item // in scope
         *    })
         * })
         * ```
         *
         * @default - This function `impl`
         */
        scope?: ts.Node
      ): ts.Expression {
        return errorBoundary(impl, () => {
          if (
            (!ts.isFunctionDeclaration(impl) &&
              !ts.isArrowFunction(impl) &&
              !ts.isFunctionExpression(impl) &&
              !ts.isConstructorDeclaration(impl) &&
              !ts.isMethodDeclaration(impl)) ||
            impl.body === undefined
          ) {
            throw new Error(
              `Functionless reflection only supports function declarations with bodies, no signature only declarations or references. Found ${impl.getText()}.`
            );
          }

          const body = ts.isBlock(impl.body)
            ? toExpr(impl.body, scope ?? impl)
            : newExpr(NodeKind.BlockStmt, impl.body, [
                ts.factory.createArrayLiteralExpression([
                  newExpr(NodeKind.ReturnStmt, impl.body, [
                    toExpr(impl.body, scope ?? impl),
                  ]),
                ]),
              ]);

          const isAsync =
            ts.isFunctionDeclaration(impl) ||
            ts.isFunctionExpression(impl) ||
            ts.isArrowFunction(impl) ||
            ts.isMethodDeclaration(impl)
              ? [
                  impl.modifiers?.find(
                    (mod) => mod.kind === ts.SyntaxKind.AsyncKeyword
                  )
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse(),
                ]
              : [];

          const isAsterisk =
            ts.isFunctionDeclaration(impl) ||
            ts.isFunctionExpression(impl) ||
            ts.isMethodDeclaration(impl)
              ? [
                  impl.asteriskToken
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse(),
                ]
              : [];

          return newExpr(type, impl, [
            ...resolveFunctionName(),
            ts.factory.createArrayLiteralExpression(
              impl.parameters.map((param) =>
                newExpr(NodeKind.ParameterDecl, param, [
                  toExpr(param.name, scope ?? impl),
                  param.initializer
                    ? toExpr(param.initializer, scope ?? impl)
                    : ts.factory.createIdentifier("undefined"),
                  param.dotDotDotToken
                    ? ts.factory.createTrue()
                    : ts.factory.createFalse(),
                ])
              )
            ),
            body,
            // isAsync for Functions, Arrows and Methods
            ...isAsync,
            // isAsterisk for Functions and Methods
            ...isAsterisk,
          ]);
        });

        function resolveFunctionName(): [ts.Expression] | [] {
          if (type === NodeKind.MethodDecl) {
            // methods can be any valid PropertyName expression
            return [toExpr((<ts.MethodDeclaration>impl).name!, scope ?? impl)];
          } else if (
            type === NodeKind.FunctionDecl ||
            type === NodeKind.FunctionExpr
          ) {
            if (
              (ts.isFunctionDeclaration(impl) ||
                ts.isFunctionExpression(impl)) &&
              impl.name
            ) {
              return [ts.factory.createStringLiteral(impl.name.text)];
            } else {
              return [ts.factory.createIdentifier("undefined")];
            }
          }
          return [];
        }
      }

      function toExpr(
        node: ts.Node | undefined,
        scope: ts.Node
      ): ts.Expression {
        if (node === undefined) {
          return ts.factory.createIdentifier("undefined");
        } else if (ts.isArrowFunction(node)) {
          return toFunction(NodeKind.ArrowFunctionExpr, node, scope);
        } else if (ts.isFunctionExpression(node)) {
          return toFunction(NodeKind.FunctionExpr, node, scope);
        } else if (ts.isExpressionStatement(node)) {
          return newExpr(NodeKind.ExprStmt, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
          if (ts.isNewExpression(node)) {
            const newType = checker.getTypeAtLocation(node);
            // cannot create new resources in native runtime code.
            const functionlessKind = checker.getFunctionlessTypeKind(newType);
            if (functionlessKind) {
              throw new SynthError(
                ErrorCodes.Unsupported_initialization_of_resources,
                `Cannot initialize new resources in a runtime function, found ${functionlessKind}.`
              );
            } else if (checker.isCDKConstruct(newType)) {
              throw new SynthError(
                ErrorCodes.Unsupported_initialization_of_resources,
                `Cannot initialize new CDK resources in a runtime function, found ${
                  newType.getSymbol()?.name
                }.`
              );
            }
          }

          const call = newExpr(
            ts.isCallExpression(node) ? NodeKind.CallExpr : NodeKind.NewExpr,
            node,
            [
              toExpr(node.expression, scope),
              ts.factory.createArrayLiteralExpression(
                node.arguments?.map((arg) =>
                  newExpr(NodeKind.Argument, arg, [toExpr(arg, scope)])
                ) ?? []
              ),
              ts.isPropertyAccessExpression(node.parent) &&
              ts.isCallExpression(node) &&
              node.questionDotToken
                ? ts.factory.createTrue()
                : ts.factory.createFalse(),
            ]
          );

          return call;
        } else if (ts.isBlock(node)) {
          return newExpr(NodeKind.BlockStmt, node, [
            ts.factory.createArrayLiteralExpression(
              node.statements.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (ts.isIdentifier(node)) {
          if (node.text === "undefined") {
            return newExpr(NodeKind.UndefinedLiteralExpr, node, []);
          } else if (node.text === "null") {
            return newExpr(NodeKind.NullLiteralExpr, node, []);
          }

          /**
           * If the identifier is not within the closure, we attempt to enclose the reference in its own closure.
           * const val = "hello";
           * reflect(() => return { value: val }; );
           *
           * result
           *
           * return { value: () => val };
           */
          if (checker.isIdentifierOutOfScope(node, scope)) {
            return ref(node);
          }

          return newExpr(NodeKind.Identifier, node, [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isPropertyAccessExpression(node)) {
          return newExpr(NodeKind.PropAccessExpr, node, [
            toExpr(node.expression, scope),
            toExpr(node.name, scope),
            node.questionDotToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ]);
        } else if (ts.isPropertyAccessChain(node)) {
          return newExpr(NodeKind.PropAccessExpr, node, [
            toExpr(node.expression, scope),
            toExpr(node.name, scope),
            node.questionDotToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ]);
        } else if (ts.isElementAccessChain(node)) {
          return newExpr(NodeKind.ElementAccessExpr, node, [
            toExpr(node.expression, scope),
            toExpr(node.argumentExpression, scope),
            node.questionDotToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ]);
        } else if (ts.isElementAccessExpression(node)) {
          return newExpr(NodeKind.ElementAccessExpr, node, [
            toExpr(node.expression, scope),
            toExpr(node.argumentExpression, scope),
            node.questionDotToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ]);
        } else if (ts.isVariableStatement(node)) {
          return newExpr(NodeKind.VariableStmt, node, [
            toExpr(node.declarationList, scope),
          ]);
        } else if (ts.isVariableDeclarationList(node)) {
          return newExpr(NodeKind.VariableDeclList, node, [
            ts.factory.createArrayLiteralExpression(
              node.declarations.map((decl) => toExpr(decl, scope))
            ),
            ts.factory.createNumericLiteral(
              (node.flags & ts.NodeFlags.Const) !== 0
                ? VariableDeclKind.Const
                : (node.flags & ts.NodeFlags.Let) !== 0
                ? VariableDeclKind.Let
                : VariableDeclKind.Var
            ),
          ]);
        } else if (ts.isVariableDeclaration(node)) {
          return newExpr(NodeKind.VariableDecl, node, [
            ts.isIdentifier(node.name)
              ? newExpr(NodeKind.Identifier, node.name, [
                  ts.factory.createStringLiteral(node.name.text),
                ])
              : toExpr(node.name, scope),
            node.initializer
              ? toExpr(node.initializer, scope)
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isIfStatement(node)) {
          return newExpr(NodeKind.IfStmt, node, [
            // when
            toExpr(node.expression, scope),
            // then
            toExpr(node.thenStatement, scope),
            // else
            ...(node.elseStatement ? [toExpr(node.elseStatement, scope)] : []),
          ]);
        } else if (ts.isObjectBindingPattern(node)) {
          return newExpr(NodeKind.ObjectBinding, node, [
            ts.factory.createArrayLiteralExpression(
              node.elements.map((e) => toExpr(e, scope))
            ),
          ]);
        } else if (ts.isArrayBindingPattern(node)) {
          return newExpr(NodeKind.ArrayBinding, node, [
            ts.factory.createArrayLiteralExpression(
              node.elements.map((e) => toExpr(e, scope))
            ),
          ]);
        } else if (ts.isBindingElement(node)) {
          return newExpr(NodeKind.BindingElem, node, [
            toExpr(node.name, scope),
            node.dotDotDotToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
            toExpr(node.propertyName, scope),
            toExpr(node.initializer, scope),
          ]);
        } else if (ts.isConditionalExpression(node)) {
          return newExpr(NodeKind.ConditionExpr, node, [
            // when
            toExpr(node.condition, scope),
            // then
            toExpr(node.whenTrue, scope),
            // else
            toExpr(node.whenFalse, scope),
          ]);
        } else if (ts.isBinaryExpression(node)) {
          return newExpr(NodeKind.BinaryExpr, node, [
            toExpr(node.left, scope),
            ts.factory.createStringLiteral(
              assertDefined(
                ts.tokenToString(node.operatorToken.kind) as BinaryOp,
                `Binary operator token cannot be stringified: ${node.operatorToken.kind}`
              )
            ),
            toExpr(node.right, scope),
          ]);
        } else if (ts.isPrefixUnaryExpression(node)) {
          return newExpr(NodeKind.UnaryExpr, node, [
            ts.factory.createStringLiteral(
              assertDefined(
                ts.tokenToString(node.operator) as UnaryOp,
                `Unary operator token cannot be stringified: ${node.operator}`
              )
            ),
            toExpr(node.operand, scope),
          ]);
        } else if (ts.isPostfixUnaryExpression(node)) {
          return newExpr(NodeKind.PostfixUnaryExpr, node, [
            ts.factory.createStringLiteral(
              assertDefined(
                ts.tokenToString(node.operator) as PostfixUnaryOp,
                `Unary operator token cannot be stringified: ${node.operator}`
              )
            ),
            toExpr(node.operand, scope),
          ]);
        } else if (ts.isReturnStatement(node)) {
          return newExpr(
            NodeKind.ReturnStmt,
            node,
            node.expression ? [toExpr(node.expression, scope)] : []
          );
        } else if (ts.isObjectLiteralExpression(node)) {
          return newExpr(NodeKind.ObjectLiteralExpr, node, [
            ts.factory.createArrayLiteralExpression(
              node.properties.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (ts.isPropertyAssignment(node)) {
          return newExpr(NodeKind.PropAssignExpr, node, [
            ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)
              ? newExpr(NodeKind.StringLiteralExpr, node.name, [
                  ts.factory.createStringLiteral(node.name.text),
                ])
              : toExpr(node.name, scope),
            toExpr(node.initializer, scope),
          ]);
        } else if (ts.isComputedPropertyName(node)) {
          return newExpr(NodeKind.ComputedPropertyNameExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isShorthandPropertyAssignment(node)) {
          return newExpr(NodeKind.PropAssignExpr, node, [
            newExpr(NodeKind.Identifier, node.name, [
              ts.factory.createStringLiteral(node.name.text),
            ]),
            toExpr(node.name, scope),
          ]);
        } else if (ts.isSpreadAssignment(node)) {
          return newExpr(NodeKind.SpreadAssignExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isSpreadElement(node)) {
          return newExpr(NodeKind.SpreadElementExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isArrayLiteralExpression(node)) {
          return newExpr(NodeKind.ArrayLiteralExpr, node, [
            ts.factory.updateArrayLiteralExpression(
              node,
              node.elements.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (node.kind === ts.SyntaxKind.NullKeyword) {
          return newExpr(NodeKind.NullLiteralExpr, node, [
            ts.factory.createIdentifier("false"),
          ]);
        } else if (ts.isNumericLiteral(node)) {
          return newExpr(NodeKind.NumberLiteralExpr, node, [node]);
        } else if (ts.isBigIntLiteral(node)) {
          return newExpr(NodeKind.BigIntExpr, node, [node]);
        } else if (ts.isRegularExpressionLiteral(node)) {
          return newExpr(NodeKind.RegexExpr, node, [node]);
        } else if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)
        ) {
          return newExpr(NodeKind.StringLiteralExpr, node, [node]);
        } else if (ts.isLiteralExpression(node)) {
          // const type = checker.getTypeAtLocation(node);
          // if (type.symbol.escapedName === "boolean") {
          //   return newExpr(NodeKind.BooleanLiteralExpr, [node]);
          // }
        } else if (
          node.kind === ts.SyntaxKind.TrueKeyword ||
          node.kind === ts.SyntaxKind.FalseKeyword
        ) {
          return newExpr(NodeKind.BooleanLiteralExpr, node, [
            node as ts.Expression,
          ]);
        } else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
          const decl =
            ts.isVariableDeclarationList(node.initializer) &&
            node.initializer.declarations.length === 1
              ? node.initializer.declarations[0]
              : ts.isIdentifier(node.initializer)
              ? node.initializer
              : undefined;
          if (!decl) {
            throw new SynthError(
              ErrorCodes.Unexpected_Error,
              "For in/of loops initializers should be an identifier or variable declaration."
            );
          }

          return newExpr(
            ts.isForOfStatement(node) ? NodeKind.ForOfStmt : NodeKind.ForInStmt,
            node,
            [
              toExpr(decl, scope),
              toExpr(node.expression, scope),
              toExpr(node.statement, scope),
              ...(ts.isForOfStatement(node)
                ? [
                    node.awaitModifier
                      ? ts.factory.createTrue()
                      : ts.factory.createFalse(),
                  ]
                : []),
            ]
          );
        } else if (ts.isForStatement(node)) {
          return newExpr(NodeKind.ForStmt, node, [
            toExpr(node.statement, scope),
            toExpr(node.initializer, scope),
            toExpr(node.condition, scope),
            toExpr(node.incrementor, scope),
          ]);
        } else if (ts.isTemplateExpression(node)) {
          return newExpr(NodeKind.TemplateExpr, node, [
            // head
            toExpr(node.head, scope),
            // spans
            ts.factory.createArrayLiteralExpression(
              node.templateSpans.map((span) => toExpr(span, scope))
            ),
          ]);
        } else if (ts.isTaggedTemplateExpression(node)) {
          return newExpr(NodeKind.TaggedTemplateExpr, node, [
            toExpr(node.tag, scope),
            toExpr(node.template, scope),
          ]);
        } else if (ts.isNoSubstitutionTemplateLiteral(node)) {
          return newExpr(NodeKind.NoSubstitutionTemplateLiteral, node, [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isTemplateSpan(node)) {
          return newExpr(NodeKind.TemplateSpan, node, [
            toExpr(node.expression, scope),
            toExpr(node.literal, scope),
          ]);
        } else if (ts.isTemplateHead(node)) {
          return newExpr(NodeKind.TemplateHead, node, [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isTemplateMiddle(node)) {
          return newExpr(NodeKind.TemplateMiddle, node, [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isTemplateTail(node)) {
          return newExpr(NodeKind.TemplateTail, node, [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isBreakStatement(node)) {
          return newExpr(NodeKind.BreakStmt, node, [
            ...(node.label ? [toExpr(node.label, scope)] : []),
          ]);
        } else if (ts.isContinueStatement(node)) {
          return newExpr(NodeKind.ContinueStmt, node, [
            ...(node.label ? [toExpr(node.label, scope)] : []),
          ]);
        } else if (ts.isTryStatement(node)) {
          return newExpr(NodeKind.TryStmt, node, [
            toExpr(node.tryBlock, scope),
            node.catchClause
              ? toExpr(node.catchClause, scope)
              : ts.factory.createIdentifier("undefined"),
            node.finallyBlock
              ? toExpr(node.finallyBlock, scope)
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isCatchClause(node)) {
          return newExpr(NodeKind.CatchClause, node, [
            node.variableDeclaration
              ? toExpr(node.variableDeclaration, scope)
              : ts.factory.createIdentifier("undefined"),
            toExpr(node.block, scope),
          ]);
        } else if (ts.isThrowStatement(node)) {
          return newExpr(NodeKind.ThrowStmt, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isTypeOfExpression(node)) {
          return newExpr(NodeKind.TypeOfExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isWhileStatement(node)) {
          return newExpr(NodeKind.WhileStmt, node, [
            toExpr(node.expression, scope),
            ts.isBlock(node.statement)
              ? toExpr(node.statement, scope)
              : // re-write a standalone statement as as BlockStmt
                newExpr(NodeKind.BlockStmt, node.statement, [
                  ts.factory.createArrayLiteralExpression([
                    toExpr(node.statement, scope),
                  ]),
                ]),
          ]);
        } else if (ts.isDoStatement(node)) {
          return newExpr(NodeKind.DoStmt, node, [
            ts.isBlock(node.statement)
              ? toExpr(node.statement, scope)
              : // re-write a standalone statement as as BlockStmt
                newExpr(NodeKind.BlockStmt, node.statement, [
                  ts.factory.createArrayLiteralExpression([
                    toExpr(node.statement, scope),
                  ]),
                ]),
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isParenthesizedExpression(node)) {
          return newExpr(NodeKind.ParenthesizedExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isAsExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (ts.isTypeAssertionExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (ts.isNonNullExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (node.kind === ts.SyntaxKind.ThisKeyword) {
          return newExpr(NodeKind.ThisExpr, node, [
            ts.factory.createArrowFunction(
              undefined,
              undefined,
              [],
              undefined,
              undefined,
              ts.factory.createIdentifier("this")
            ),
          ]);
        } else if (
          ts.isToken(node) &&
          node.kind === ts.SyntaxKind.SuperKeyword
        ) {
          return newExpr(NodeKind.SuperKeyword, node, []);
        } else if (ts.isAwaitExpression(node)) {
          return newExpr(NodeKind.AwaitExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
          return newExpr(
            ts.isClassDeclaration(node)
              ? NodeKind.ClassDecl
              : NodeKind.ClassExpr,
            node,
            [
              // name
              toExpr(node.name, scope) ??
                ts.factory.createIdentifier("undefined"),
              // extends
              node.heritageClauses?.flatMap((clause) =>
                clause.token === ts.SyntaxKind.ExtendsKeyword &&
                clause.types[0]?.expression !== undefined
                  ? [toExpr(clause.types[0].expression, scope)]
                  : []
              )[0] ?? ts.factory.createIdentifier("undefined"),
              // members
              ts.factory.createArrayLiteralExpression(
                node.members.map((member) => toExpr(member, scope))
              ),
            ]
          );
        } else if (ts.isClassStaticBlockDeclaration(node)) {
          return newExpr(NodeKind.ClassStaticBlockDecl, node, [
            toExpr(node.body, scope),
          ]);
        } else if (ts.isConstructorDeclaration(node)) {
          return toFunction(NodeKind.ConstructorDecl, node);
        } else if (ts.isMethodDeclaration(node)) {
          return toFunction(NodeKind.MethodDecl, node);
        } else if (ts.isPropertyDeclaration(node)) {
          return newExpr(NodeKind.PropDecl, node, [
            toExpr(node.name, scope),
            node.initializer
              ? toExpr(node.initializer, scope)
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isDebuggerStatement(node)) {
          return newExpr(NodeKind.DebuggerStmt, node, []);
        } else if (ts.isLabeledStatement(node)) {
          return newExpr(NodeKind.LabelledStmt, node, [
            toExpr(node.label, scope),
            toExpr(node.statement, scope),
          ]);
        } else if (ts.isSwitchStatement(node)) {
          return newExpr(NodeKind.SwitchStmt, node, [
            toExpr(node.expression, scope),
            ts.factory.createArrayLiteralExpression(
              node.caseBlock.clauses.map((clause) => toExpr(clause, scope))
            ),
          ]);
        } else if (ts.isCaseClause(node)) {
          return newExpr(NodeKind.CaseClause, node, [
            toExpr(node.expression, scope),
            ts.factory.createArrayLiteralExpression(
              node.statements.map((stmt) => toExpr(stmt, scope))
            ),
          ]);
        } else if (ts.isDefaultClause(node)) {
          return newExpr(NodeKind.DefaultClause, node, [
            ts.factory.createArrayLiteralExpression(
              node.statements.map((stmt) => toExpr(stmt, scope))
            ),
          ]);
        } else if (ts.isWithStatement(node)) {
          return newExpr(NodeKind.WithStmt, node, []);
        } else if (ts.isPrivateIdentifier(node)) {
          return newExpr(NodeKind.PrivateIdentifier, node, [
            ts.factory.createStringLiteral(node.getText()),
          ]);
        } else if (ts.isVoidExpression(node)) {
          return newExpr(NodeKind.VoidExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isDeleteExpression(node)) {
          return newExpr(NodeKind.DeleteExpr, node, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isYieldExpression(node)) {
          return newExpr(NodeKind.YieldExpr, node, [
            toExpr(node.expression, scope),
            node.asteriskToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ]);
        } else if (ts.isOmittedExpression(node)) {
          return newExpr(NodeKind.OmittedExpr, node, []);
        }

        throw new Error(
          `unhandled node: ${node.getText()} ${ts.SyntaxKind[node.kind]}`
        );
      }

      function ref(node: ts.Expression) {
        return newExpr(NodeKind.ReferenceExpr, node, [
          ts.factory.createStringLiteral(exprToString(node)),
          ts.factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            undefined,
            node
          ),
        ]);
      }

      function exprToString(node: ts.Expression): string {
        if (ts.isIdentifier(node)) {
          return node.text;
        } else if (ts.isPropertyAccessExpression(node)) {
          return `${exprToString(node.expression)}.${exprToString(node.name)}`;
        } else if (ts.isElementAccessExpression(node)) {
          return `${exprToString(node.expression)}[${exprToString(
            node.argumentExpression
          )}]`;
        } else {
          return "";
        }
      }

      function newExpr(type: NodeKind, span: ts.Node, args: ts.Expression[]) {
        return ts.factory.createArrayLiteralExpression([
          ts.factory.createNumericLiteral(type),
          ts.factory.createArrayLiteralExpression([
            ts.factory.createNumericLiteral(span.getStart()),
            ts.factory.createNumericLiteral(span.getEnd()),
          ]),
          ...args,
        ]);
      }
    };
  };
}

function param(name: string, spread: boolean = false) {
  return ts.factory.createParameterDeclaration(
    undefined,
    undefined,
    spread ? ts.factory.createToken(ts.SyntaxKind.DotDotDotToken) : undefined,
    name
  );
}

function setSymbol(varName: string, symName: string, valueName: string) {
  return ts.factory.createExpressionStatement(
    // func[Symbol.for("functionless:ast")] = ast;
    ts.factory.createBinaryExpression(
      ts.factory.createElementAccessExpression(
        ts.factory.createIdentifier(varName),
        ts.factory.createCallExpression(
          ts.factory.createPropertyAccessExpression(
            ts.factory.createIdentifier("Symbol"),
            "for"
          ),
          undefined,
          [ts.factory.createStringLiteral(symName)]
        )
      ),
      ts.factory.createToken(ts.SyntaxKind.EqualsToken),
      ts.factory.createIdentifier(valueName)
    )
  );
}

function ret(name: string) {
  return ts.factory.createReturnStatement(ts.factory.createIdentifier(name));
}

function createRegisterFunctionDeclaration(registerName: ts.Identifier) {
  // function register(func, ast) {
  //   func[Symbol.for("functionless:ast")] = ast;
  //   return func;
  // }
  return ts.factory.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    registerName,
    undefined,
    [param("func"), param("ast")],
    undefined,
    ts.factory.createBlock([
      // func[Symbol.for("functionless:ast")] = ast;
      setSymbol("func", ReflectionSymbolNames.AST, "ast"),

      // return func;
      ret("func"),
    ])
  );
}

function createBindFunctionDeclaration(bindName: ts.Identifier) {
  // function bind(func, self, ...args) {
  //   const f = func.bind(self, ...args);
  //   f[Symbol.for("functionless:BoundThis")] = self;
  //   f[Symbol.for("functionless:BoundArgs")] = args;
  //   f[Symbol.for("functionless:TargetFunction")] = func;
  //   return func.bind(self, ...args);
  //}
  return ts.factory.createFunctionDeclaration(
    undefined,
    undefined,
    undefined,
    bindName,
    undefined,
    [param("func"), param("self"), param("args", true)],
    undefined,
    ts.factory.createBlock([
      // const tmp = func.bind(self, ...args)
      ts.factory.createVariableStatement(
        undefined,
        ts.factory.createVariableDeclarationList(
          [
            ts.factory.createVariableDeclaration(
              "tmp",
              undefined,
              undefined,
              ts.factory.createCallExpression(
                ts.factory.createPropertyAccessExpression(
                  ts.factory.createIdentifier("func"),
                  "bind"
                ),
                undefined,
                [
                  ts.factory.createIdentifier("self"),
                  ts.factory.createSpreadElement(
                    ts.factory.createIdentifier("args")
                  ),
                ]
              )
            ),
          ],
          ts.NodeFlags.Const
        )
      ),
      // if (typeof func === "string")
      ts.factory.createIfStatement(
        ts.factory.createBinaryExpression(
          ts.factory.createTypeOfExpression(
            ts.factory.createIdentifier("func")
          ),
          ts.factory.createToken(ts.SyntaxKind.EqualsEqualsEqualsToken),
          ts.factory.createStringLiteral("function")
        ),
        ts.factory.createBlock([
          // func[Symbol.for("functionless:BoundThis")] = ast;
          setSymbol("tmp", ReflectionSymbolNames.BoundThis, "self"),
          setSymbol("tmp", ReflectionSymbolNames.BoundArgs, "args"),
          setSymbol("tmp", ReflectionSymbolNames.TargetFunction, "func"),
        ])
      ),

      // return tmp;
      ts.factory.createReturnStatement(ts.factory.createIdentifier("tmp")),
    ])
  );
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
