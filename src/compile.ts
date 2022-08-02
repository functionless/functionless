import path from "path";
import minimatch from "minimatch";
import type { PluginConfig, TransformerExtras } from "ts-patch";
import ts from "typescript";
import { assertDefined } from "./assert";
import { makeFunctionlessChecker } from "./checker";
import type { ConstructorDecl, FunctionDecl, MethodDecl } from "./declaration";
import { ErrorCodes, SynthError } from "./error-code";
import type {
  FunctionExpr,
  BinaryOp,
  UnaryOp,
  PostfixUnaryOp,
  ArrowFunctionExpr,
} from "./expression";
import { NodeKind } from "./node-kind";
import { ReflectionSymbolNames } from "./reflect";

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
 * A CRC-32 hash of the word "functionless".
 *
 * Used to give generated functions a predictable name is that is highly-likely
 * to be unique within a module.
 *
 * If we ever have collisions (highly improbable) we can simply change this to
 * a hash with higher entropy such as a SHA256. For now, CRC-32 is chosen for its
 * relatively small size.
 */
const FunctionlessSalt = "8269d1a8";

/**
 * Name of the `register` function that is injected into all compiled source files.
 *
 * ```ts
 * function register_8269d1a8(func, ast) {
 *   func[Symbol.for("functionless:AST")] = ast;
 *   return func;
 * }
 * ```
 *
 * All Function Declarations, Expressions and Arrow Expressions are decorated with
 * the `register` function which attaches its AST as a property.
 */
export const RegisterFunctionName = `register_${FunctionlessSalt}`;

/**
 * Name of the `bind` function that is injected into all compiled source files.
 *
 * ```ts
 * function bind_8269d1a8(func, self, ...args) {
 *   const tmp = func.bind(self, ...args);
 *   if (typeof func === "function") {
 *     func[Symbol.for("functionless:BoundThis")] = self;
 *     func[Symbol.for("functionless:BoundArgs")] = args;
 *     func[Symbol.for("functionless:TargetFunction")] = func;
 *   }
 *   return tmp;
 * }
 * ```
 *
 * All CallExpressions with the shape <expr>.bind(...<args>) are re-written as calls
 * to this special function which intercepts the call.
 * ```ts
 * <expr>.bind(...<args>)
 * // =>
 * bind_8269d1a8(<expr>, ...<args>)
 * ```
 *
 * If `<expr>` is a Function, then the values of BoundThis, BoundArgs and TargetFunction
 * are added to the bound Function.
 *
 * If `<expr>` is not a Function, then the call is proxied without modification.
 */
export const BindFunctionName = `bind_${FunctionlessSalt}`;

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
        func: () => T
      ): T | ts.ArrayLiteralExpression {
        try {
          return func();
        } catch (err) {
          const error =
            err instanceof Error ? err : Error("Unknown compiler error.");
          return newExpr(NodeKind.Err, [
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
        return errorBoundary(() => {
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
            : newExpr(NodeKind.BlockStmt, [
                ts.factory.createArrayLiteralExpression([
                  newExpr(NodeKind.ReturnStmt, [
                    toExpr(impl.body, scope ?? impl),
                  ]),
                ]),
              ]);

          return newExpr(type, [
            ...resolveFunctionName(),
            ts.factory.createArrayLiteralExpression(
              impl.parameters.map((param) =>
                newExpr(NodeKind.ParameterDecl, [
                  toExpr(param.name, scope ?? impl),
                  ...(param.initializer
                    ? [toExpr(param.initializer, scope ?? impl)]
                    : []),
                ])
              )
            ),
            body,
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
        } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
          return toFunction(NodeKind.FunctionExpr, node, scope);
        } else if (ts.isExpressionStatement(node)) {
          return newExpr(NodeKind.ExprStmt, [toExpr(node.expression, scope)]);
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
            [
              toExpr(node.expression, scope),
              ts.factory.createArrayLiteralExpression(
                node.arguments?.map((arg) =>
                  newExpr(NodeKind.Argument, [toExpr(arg, scope)])
                ) ?? []
              ),
              ts.isPropertyAccessExpression(node.parent) &&
              ts.isCallExpression(node) &&
              node.questionDotToken
                ? ts.factory.createTrue()
                : ts.factory.createFalse(),
            ]
          );

          const type = checker.getTypeAtLocation(node);
          const typeSymbol = type.getSymbol();
          return typeSymbol && checker.isPromiseSymbol(typeSymbol)
            ? newExpr(NodeKind.PromiseExpr, [call])
            : checker.isPromiseArray(type)
            ? newExpr(NodeKind.PromiseArrayExpr, [call])
            : call;
        } else if (ts.isBlock(node)) {
          return newExpr(NodeKind.BlockStmt, [
            ts.factory.createArrayLiteralExpression(
              node.statements.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (ts.isIdentifier(node)) {
          if (node.text === "undefined") {
            return newExpr(NodeKind.UndefinedLiteralExpr, []);
          } else if (node.text === "null") {
            return newExpr(NodeKind.NullLiteralExpr, []);
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

          return newExpr(NodeKind.Identifier, [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isPropertyAccessExpression(node)) {
          return newExpr(NodeKind.PropAccessExpr, [
            toExpr(node.expression, scope),
            toExpr(node.name, scope),
            node.questionDotToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ]);
        } else if (ts.isElementAccessExpression(node)) {
          const type = checker.getTypeAtLocation(node.argumentExpression);
          return newExpr(NodeKind.ElementAccessExpr, [
            toExpr(node.expression, scope),
            toExpr(node.argumentExpression, scope),
            type
              ? ts.factory.createStringLiteral(checker.typeToString(type))
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isVariableStatement(node)) {
          return newExpr(NodeKind.VariableStmt, [
            toExpr(node.declarationList, scope),
          ]);
        } else if (ts.isVariableDeclarationList(node)) {
          return newExpr(NodeKind.VariableDeclList, [
            ts.factory.createArrayLiteralExpression(
              node.declarations.map((decl) => toExpr(decl, scope))
            ),
          ]);
        } else if (ts.isVariableDeclaration(node)) {
          return newExpr(NodeKind.VariableDecl, [
            ts.isIdentifier(node.name)
              ? newExpr(NodeKind.Identifier, [
                  ts.factory.createStringLiteral(node.name.text),
                ])
              : toExpr(node.name, scope),
            ...(node.initializer ? [toExpr(node.initializer, scope)] : []),
          ]);
        } else if (ts.isIfStatement(node)) {
          return newExpr(NodeKind.IfStmt, [
            // when
            toExpr(node.expression, scope),
            // then
            toExpr(node.thenStatement, scope),
            // else
            ...(node.elseStatement ? [toExpr(node.elseStatement, scope)] : []),
          ]);
        } else if (ts.isObjectBindingPattern(node)) {
          return newExpr(NodeKind.ObjectBinding, [
            ts.factory.createArrayLiteralExpression(
              node.elements.map((e) => toExpr(e, scope))
            ),
          ]);
        } else if (ts.isArrayBindingPattern(node)) {
          return newExpr(NodeKind.ArrayBinding, [
            ts.factory.createArrayLiteralExpression(
              node.elements.map((e) => toExpr(e, scope))
            ),
          ]);
        } else if (ts.isBindingElement(node)) {
          return newExpr(NodeKind.BindingElem, [
            toExpr(node.name, scope),
            node.dotDotDotToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
            toExpr(node.propertyName, scope),
            toExpr(node.initializer, scope),
          ]);
        } else if (ts.isConditionalExpression(node)) {
          return newExpr(NodeKind.ConditionExpr, [
            // when
            toExpr(node.condition, scope),
            // then
            toExpr(node.whenTrue, scope),
            // else
            toExpr(node.whenFalse, scope),
          ]);
        } else if (ts.isBinaryExpression(node)) {
          return newExpr(NodeKind.BinaryExpr, [
            toExpr(node.left, scope),
            ts.factory.createStringLiteral(
              assertDefined(
                getBinaryOperator(node.operatorToken),
                `Binary operator token cannot be stringified: ${node.operatorToken.kind}`
              )
            ),
            toExpr(node.right, scope),
          ]);
        } else if (ts.isPrefixUnaryExpression(node)) {
          return newExpr(NodeKind.UnaryExpr, [
            ts.factory.createStringLiteral(
              assertDefined(
                getPrefixUnaryOperator(node.operator),
                `Unary operator token cannot be stringified: ${node.operator}`
              )
            ),
            toExpr(node.operand, scope),
          ]);
        } else if (ts.isPostfixUnaryExpression(node)) {
          return newExpr(NodeKind.PostfixUnaryExpr, [
            ts.factory.createStringLiteral(
              assertDefined(
                getPostfixUnaryOperator(node.operator),
                `Unary operator token cannot be stringified: ${node.operator}`
              )
            ),
            toExpr(node.operand, scope),
          ]);
        } else if (ts.isReturnStatement(node)) {
          return newExpr(
            NodeKind.ReturnStmt,
            node.expression
              ? [toExpr(node.expression, scope)]
              : [newExpr(NodeKind.NullLiteralExpr, [])]
          );
        } else if (ts.isObjectLiteralExpression(node)) {
          return newExpr(NodeKind.ObjectLiteralExpr, [
            ts.factory.createArrayLiteralExpression(
              node.properties.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (ts.isPropertyAssignment(node)) {
          return newExpr(NodeKind.PropAssignExpr, [
            ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)
              ? string(node.name.text)
              : toExpr(node.name, scope),
            toExpr(node.initializer, scope),
          ]);
        } else if (ts.isComputedPropertyName(node)) {
          return newExpr(NodeKind.ComputedPropertyNameExpr, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isShorthandPropertyAssignment(node)) {
          return newExpr(NodeKind.PropAssignExpr, [
            newExpr(NodeKind.Identifier, [
              ts.factory.createStringLiteral(node.name.text),
            ]),
            toExpr(node.name, scope),
          ]);
        } else if (ts.isSpreadAssignment(node)) {
          return newExpr(NodeKind.SpreadAssignExpr, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isSpreadElement(node)) {
          return newExpr(NodeKind.SpreadElementExpr, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isArrayLiteralExpression(node)) {
          return newExpr(NodeKind.ArrayLiteralExpr, [
            ts.factory.updateArrayLiteralExpression(
              node,
              node.elements.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (node.kind === ts.SyntaxKind.NullKeyword) {
          return newExpr(NodeKind.NullLiteralExpr, [
            ts.factory.createIdentifier("false"),
          ]);
        } else if (ts.isNumericLiteral(node)) {
          return newExpr(NodeKind.NumberLiteralExpr, [node]);
        } else if (ts.isBigIntLiteral(node)) {
          return newExpr(NodeKind.BigIntExpr, [node]);
        } else if (ts.isRegularExpressionLiteral(node)) {
          return newExpr(NodeKind.RegexExpr, [node]);
        } else if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)
        ) {
          return newExpr(NodeKind.StringLiteralExpr, [node]);
        } else if (ts.isLiteralExpression(node)) {
          // const type = checker.getTypeAtLocation(node);
          // if (type.symbol.escapedName === "boolean") {
          //   return newExpr(NodeKind.BooleanLiteralExpr, [node]);
          // }
        } else if (
          node.kind === ts.SyntaxKind.TrueKeyword ||
          node.kind === ts.SyntaxKind.FalseKeyword
        ) {
          return newExpr(NodeKind.BooleanLiteralExpr, [node as ts.Expression]);
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
            [
              toExpr(decl, scope),
              toExpr(node.expression, scope),
              toExpr(node.statement, scope),
            ]
          );
        } else if (ts.isForStatement(node)) {
          return newExpr(NodeKind.ForStmt, [
            toExpr(node.statement, scope),
            toExpr(node.initializer, scope),
            toExpr(node.condition, scope),
            toExpr(node.incrementor, scope),
          ]);
        } else if (ts.isTemplateExpression(node)) {
          const exprs = [];
          if (node.head.text) {
            exprs.push(string(node.head.text));
          }
          for (const span of node.templateSpans) {
            exprs.push(toExpr(span.expression, scope));
            if (span.literal.text) {
              exprs.push(string(span.literal.text));
            }
          }
          return newExpr(NodeKind.TemplateExpr, [
            ts.factory.createArrayLiteralExpression(exprs),
          ]);
        } else if (ts.isBreakStatement(node)) {
          return newExpr(NodeKind.BreakStmt, []);
        } else if (ts.isContinueStatement(node)) {
          return newExpr(NodeKind.ContinueStmt, []);
        } else if (ts.isTryStatement(node)) {
          return newExpr(NodeKind.TryStmt, [
            toExpr(node.tryBlock, scope),
            node.catchClause
              ? toExpr(node.catchClause, scope)
              : ts.factory.createIdentifier("undefined"),
            node.finallyBlock
              ? toExpr(node.finallyBlock, scope)
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isCatchClause(node)) {
          return newExpr(NodeKind.CatchClause, [
            node.variableDeclaration
              ? toExpr(node.variableDeclaration, scope)
              : ts.factory.createIdentifier("undefined"),
            toExpr(node.block, scope),
          ]);
        } else if (ts.isThrowStatement(node)) {
          return newExpr(NodeKind.ThrowStmt, [toExpr(node.expression, scope)]);
        } else if (ts.isTypeOfExpression(node)) {
          return newExpr(NodeKind.TypeOfExpr, [toExpr(node.expression, scope)]);
        } else if (ts.isWhileStatement(node)) {
          return newExpr(NodeKind.WhileStmt, [
            toExpr(node.expression, scope),
            ts.isBlock(node.statement)
              ? toExpr(node.statement, scope)
              : // re-write a standalone statement as as BlockStmt
                newExpr(NodeKind.BlockStmt, [
                  ts.factory.createArrayLiteralExpression([
                    toExpr(node.statement, scope),
                  ]),
                ]),
          ]);
        } else if (ts.isDoStatement(node)) {
          return newExpr(NodeKind.DoStmt, [
            ts.isBlock(node.statement)
              ? toExpr(node.statement, scope)
              : // re-write a standalone statement as as BlockStmt
                newExpr(NodeKind.BlockStmt, [
                  ts.factory.createArrayLiteralExpression([
                    toExpr(node.statement, scope),
                  ]),
                ]),
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isParenthesizedExpression(node)) {
          return newExpr(NodeKind.ParenthesizedExpr, [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isAsExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (ts.isTypeAssertionExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (ts.isNonNullExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (node.kind === ts.SyntaxKind.ThisKeyword) {
          return newExpr(NodeKind.ThisExpr, [
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
          return newExpr(NodeKind.SuperKeyword, []);
        } else if (ts.isAwaitExpression(node)) {
          return newExpr(NodeKind.AwaitExpr, [toExpr(node.expression, scope)]);
        } else if (ts.isClassDeclaration(node) || ts.isClassExpression(node)) {
          return newExpr(
            ts.isClassDeclaration(node)
              ? NodeKind.ClassDecl
              : NodeKind.ClassExpr,
            [
              // name
              node.name ?? ts.factory.createIdentifier("undefined"),
              // extends
              node.heritageClauses?.flatMap((clause) =>
                clause.token === ts.SyntaxKind.ExtendsKeyword &&
                clause.types[0].expression !== undefined
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
          return newExpr(NodeKind.ClassStaticBlockDecl, [
            toExpr(node.body, scope),
          ]);
        } else if (ts.isConstructorDeclaration(node)) {
          return toFunction(NodeKind.ConstructorDecl, node);
        } else if (ts.isMethodDeclaration(node)) {
          return toFunction(NodeKind.MethodDecl, node);
        } else if (ts.isPropertyDeclaration(node)) {
          return newExpr(NodeKind.PropDecl, [
            toExpr(node.name, scope),
            node.initializer
              ? toExpr(node.initializer, scope)
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isDebuggerStatement(node)) {
          return newExpr(NodeKind.DebuggerStmt, []);
        } else if (ts.isLabeledStatement(node)) {
          return newExpr(NodeKind.LabelledStmt, [
            toExpr(node.statement, scope),
          ]);
        } else if (ts.isSwitchStatement(node)) {
          return newExpr(NodeKind.SwitchStmt, [
            ts.factory.createArrayLiteralExpression(
              node.caseBlock.clauses.map((clause) => toExpr(clause, scope))
            ),
          ]);
        } else if (ts.isCaseClause(node)) {
          return newExpr(NodeKind.CaseClause, [
            toExpr(node.expression, scope),
            ts.factory.createArrayLiteralExpression(
              node.statements.map((stmt) => toExpr(stmt, scope))
            ),
          ]);
        } else if (ts.isDefaultClause(node)) {
          return newExpr(NodeKind.DefaultClause, [
            ts.factory.createArrayLiteralExpression(
              node.statements.map((stmt) => toExpr(stmt, scope))
            ),
          ]);
        } else if (ts.isWithStatement(node)) {
          return newExpr(NodeKind.WithStmt, []);
        } else if (ts.isPrivateIdentifier(node)) {
          return newExpr(NodeKind.PrivateIdentifier, [
            ts.factory.createStringLiteral(node.getText()),
          ]);
        } else if (ts.isVoidExpression(node)) {
          return newExpr(NodeKind.VoidExpr, [toExpr(node.expression, scope)]);
        } else if (ts.isDeleteExpression(node)) {
          return newExpr(NodeKind.DeleteExpr, [toExpr(node.expression, scope)]);
        } else if (ts.isYieldExpression(node)) {
          return newExpr(NodeKind.YieldExpr, [
            toExpr(node.expression, scope),
            node.asteriskToken
              ? ts.factory.createTrue()
              : ts.factory.createFalse(),
          ]);
        } else if (ts.isOmittedExpression(node)) {
          return newExpr(NodeKind.OmittedExpr, []);
        }

        throw new Error(
          `unhandled node: ${node.getText()} ${ts.SyntaxKind[node.kind]}`
        );
      }

      function ref(node: ts.Expression) {
        return newExpr(NodeKind.ReferenceExpr, [
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

      function string(literal: string): ts.Expression {
        return newExpr(NodeKind.StringLiteralExpr, [
          ts.factory.createStringLiteral(literal),
        ]);
      }

      function newExpr(type: NodeKind, args: ts.Expression[]) {
        return ts.factory.createArrayLiteralExpression([
          ts.factory.createNumericLiteral(type),
          ...args,
        ]);
      }
    };
  };
}

function getBinaryOperator(op: ts.BinaryOperatorToken): BinaryOp | undefined {
  return (
    BinaryOperatorRemappings[
      op.kind as keyof typeof BinaryOperatorRemappings
    ] ?? (ts.tokenToString(op.kind) as BinaryOp)
  );
}

function getPrefixUnaryOperator(
  op: ts.PrefixUnaryOperator
): UnaryOp | undefined {
  return ts.tokenToString(op) as UnaryOp | undefined;
}

function getPostfixUnaryOperator(
  op: ts.PostfixUnaryOperator
): PostfixUnaryOp | undefined {
  return ts.tokenToString(op) as PostfixUnaryOp | undefined;
}

const BinaryOperatorRemappings: Record<number, BinaryOp> = {
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: "==",
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "!=",
} as const;

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
