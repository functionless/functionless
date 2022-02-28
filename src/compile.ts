import ts from "typescript";
import { PluginConfig, TransformerExtras } from "ts-patch";
import { BinaryOp } from "./expression";
import { AnyTable } from "./table";
import { AnyLambda } from "./function";
import { FunctionlessNode } from "./node";
export default compile;

/**
 * Configuration options for the functionless TS transform.
 */
export interface FunctionlessConfig extends PluginConfig {}

/**
 * TypeScript Transformer which transforms functionless functions, such as `appsyncFunction`,
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
  const checker = program.getTypeChecker();
  return (ctx) => {
    const functionless = ts.factory.createUniqueName("functionless");
    return (sf) => {
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

      return ts.factory.updateSourceFile(
        sf,
        [
          functionlessImport,
          ...sf.statements.map((stmt) => visitor(stmt) as ts.Statement),
        ],
        sf.isDeclarationFile,
        sf.referencedFiles,
        sf.typeReferenceDirectives,
        sf.hasNoDefaultLib,
        sf.libReferenceDirectives
      );

      function visitor(node: ts.Node): ts.Node {
        if (isAppsyncFunction(node)) {
          return visitAppsyncFunction(node);
        } else if (isReflectFunction(node)) {
          return toExpr(node.arguments[0]);
        }
        return ts.visitEachChild(node, visitor, ctx);
      }

      function isReflectFunction(node: ts.Node): node is ts.CallExpression {
        if (ts.isCallExpression(node)) {
          const exprType = checker.getTypeAtLocation(node.expression);
          const exprDecl = exprType.symbol?.declarations?.[0];
          if (exprDecl && ts.isFunctionDeclaration(exprDecl)) {
            if (exprDecl.name?.text === "reflect") {
              return true;
            }
          }
        }
        return false;
      }

      function isAppsyncFunction(node: ts.Node): node is ts.NewExpression {
        if (ts.isNewExpression(node)) {
          const exprType = checker.getTypeAtLocation(node.expression);
          const exprDecl = exprType.symbol?.declarations?.[0];
          if (exprDecl && ts.isClassDeclaration(exprDecl)) {
            if (exprDecl.name?.text === "AppsyncFunction") {
              return true;
            }
          }
        }
        return false;
      }

      function visitAppsyncFunction(call: ts.NewExpression): ts.Node {
        if (call.arguments?.length === 1) {
          const impl = call.arguments[0];
          if (ts.isFunctionExpression(impl) || ts.isArrowFunction(impl)) {
            return ts.factory.updateNewExpression(
              call,
              call.expression,
              call.typeArguments,
              [
                newExpr("FunctionDecl", [
                  ts.factory.createArrayLiteralExpression(
                    impl.parameters
                      .slice(1) // the first argument is always $context
                      .map((param) => param.name.getText())
                      .map((arg) =>
                        newExpr("ParameterDecl", [
                          ts.factory.createStringLiteral(arg),
                        ])
                      )
                  ),
                  toExpr(impl.body),
                ]),
              ]
            );
          }
        }
        return call;
      }

      function toExpr(node: ts.Node): ts.Expression {
        if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
          return newExpr("FunctionExpr", [
            ts.factory.createArrayLiteralExpression(
              node.parameters
                .map((param) => param.name.getText())
                .map((arg) =>
                  newExpr("ParameterDecl", [
                    ts.factory.createStringLiteral(arg),
                  ])
                )
            ),
            toExpr(node.body),
          ]);
        } else if (ts.isExpressionStatement(node)) {
          return newExpr("ExprStmt", [toExpr(node.expression)]);
        } else if (ts.isCallExpression(node)) {
          const exprType = checker.getTypeAtLocation(node.expression);
          const functionBrand = exprType.getProperty("__functionBrand");
          let signature: ts.Signature | undefined;
          if (functionBrand !== undefined) {
            const functionType = checker.getTypeOfSymbolAtLocation(
              functionBrand,
              node.expression
            );
            const signatures = checker.getSignaturesOfType(
              functionType,
              ts.SignatureKind.Call
            );

            if (signatures.length === 1) {
              signature = signatures[0];
            } else {
              throw new Error(
                `Lambda Functions with multiple signatures are not currently supported.`
              );
            }
          } else {
            signature = checker.getResolvedSignature(node);
          }
          if (signature) {
            return newExpr("CallExpr", [
              toExpr(node.expression),
              ts.factory.createObjectLiteralExpression(
                signature.parameters.map((parameter, i) =>
                  ts.factory.createPropertyAssignment(
                    parameter.name,
                    toExpr(node.arguments[i])
                  )
                )
              ),
            ]);
          }
        } else if (ts.isBlock(node)) {
          return newExpr("BlockStmt", [
            ts.factory.createArrayLiteralExpression(
              node.statements.map(toExpr)
            ),
          ]);
        } else if (ts.isIdentifier(node)) {
          if (node.text === "undefined" || node.text === "null") {
            return newExpr("NullLiteralExpr", []);
          }
          const kind = getKind(node);
          if (kind !== undefined) {
            // if this is a reference to a Table or Lambda, retain it
            return ref(node);
          }

          return newExpr("Identifier", [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isPropertyAccessExpression(node)) {
          const kind = getKind(node);
          if (kind !== undefined) {
            // if this is a reference to a Table or Lambda, retain it
            return ref(node);
          }
          return newExpr("PropAccessExpr", [
            toExpr(node.expression),
            ts.factory.createStringLiteral(node.name.text),
          ]);
        } else if (ts.isElementAccessExpression(node)) {
          return newExpr("ElementAccessExpr", [
            toExpr(node.expression),
            toExpr(node.argumentExpression),
          ]);
        } else if (
          ts.isVariableStatement(node) &&
          node.declarationList.declarations.length === 1
        ) {
          return toExpr(node.declarationList.declarations[0]);
        } else if (ts.isVariableDeclaration(node)) {
          return newExpr("VariableStmt", [
            ts.factory.createStringLiteral(node.name.getText()),
            ...(node.initializer ? [toExpr(node.initializer)] : []),
          ]);
        } else if (ts.isIfStatement(node)) {
          return newExpr("IfStmt", [
            // when
            toExpr(node.expression),
            // then
            toExpr(node.thenStatement),
            // else
            ...(node.elseStatement ? [toExpr(node.elseStatement)] : []),
          ]);
        } else if (ts.isConditionalExpression(node)) {
          return newExpr("ConditionExpr", [
            // when
            toExpr(node.condition),
            // then
            toExpr(node.whenTrue),
            // else
            toExpr(node.whenFalse),
          ]);
        } else if (ts.isBinaryExpression(node)) {
          const op = getOperator(node.operatorToken);
          if (op === undefined) {
            throw new Error(
              `invalid Binary Operator: ${node.operatorToken.getText()}`
            );
          }
          return newExpr("BinaryExpr", [
            toExpr(node.left),
            ts.factory.createStringLiteral(op),
            toExpr(node.right),
          ]);
        } else if (ts.isPrefixUnaryExpression(node)) {
          if (node.operator !== ts.SyntaxKind.ExclamationToken) {
            throw new Error(
              `invalid Unary Operator: ${ts.tokenToString(node.operator)}`
            );
          }
          return newExpr("UnaryExpr", [toExpr(node.operand)]);
        } else if (ts.isReturnStatement(node)) {
          return newExpr(
            "ReturnStmt",
            node.expression
              ? [toExpr(node.expression)]
              : [ts.factory.createNull()]
          );
        } else if (ts.isObjectLiteralExpression(node)) {
          return newExpr("ObjectLiteralExpr", [
            ts.factory.createArrayLiteralExpression(
              node.properties.map(toExpr)
            ),
          ]);
        } else if (ts.isPropertyAssignment(node)) {
          return newExpr("PropAssignExpr", [
            ts.factory.createStringLiteral(node.name.getText()),
            toExpr(node.initializer),
          ]);
        } else if (ts.isShorthandPropertyAssignment(node)) {
          return newExpr("PropAssignExpr", [
            ts.factory.createStringLiteral(node.name.getText()),
            toExpr(node.name),
          ]);
        } else if (ts.isSpreadAssignment(node)) {
          return newExpr("SpreadAssignExpr", [toExpr(node.expression)]);
        } else if (ts.isArrayLiteralExpression(node)) {
          return newExpr("ArrayLiteralExpr", [
            ts.factory.updateArrayLiteralExpression(
              node,
              node.elements.map(toExpr)
            ),
          ]);
        } else if (node.kind === ts.SyntaxKind.NullKeyword) {
          return newExpr("NullLiteralExpr", []);
        } else if (ts.isNumericLiteral(node)) {
          return newExpr("NumberLiteralExpr", [node]);
        } else if (ts.isStringLiteral(node)) {
          return newExpr("StringLiteralExpr", [node]);
        } else if (ts.isLiteralExpression(node)) {
          // const type = checker.getTypeAtLocation(node);
          // if (type.symbol.escapedName === "boolean") {
          //   return newExpr("BooleanLiteralExpr", [node]);
          // }
        } else if (
          node.kind === ts.SyntaxKind.TrueKeyword ||
          node.kind === ts.SyntaxKind.FalseKeyword
        ) {
          return newExpr("BooleanLiteralExpr", [node as ts.Expression]);
        } else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
          if (ts.isVariableDeclarationList(node.initializer)) {
            if (node.initializer.declarations.length === 1) {
              const varDecl = node.initializer.declarations[0];
              if (ts.isIdentifier(varDecl.name)) {
                // for (const i in list)
                return newExpr(
                  ts.isForOfStatement(node) ? "ForOfStmt" : "ForInStmt",
                  [
                    toExpr(varDecl),
                    toExpr(node.expression),
                    toExpr(node.statement),
                  ]
                );
              } else if (ts.isArrayBindingPattern(varDecl.name)) {
                // for (const [a, b] in list)
              }
            }
          }
        }

        throw new Error(`unhandled node: ${node.getText()}`);
      }

      function ref(node: ts.Expression) {
        return newExpr("ReferenceExpr", [
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

      function newExpr(type: FunctionlessNode["kind"], args: ts.Expression[]) {
        return ts.factory.createNewExpression(
          ts.factory.createPropertyAccessExpression(functionless, type),
          undefined,
          args
        );
      }

      function getKind(
        node: ts.Node
      ): (AnyLambda | AnyTable)["kind"] | undefined {
        const exprType = checker.getTypeAtLocation(node);
        const exprKind = exprType.getProperty("kind");
        if (exprKind) {
          const exprKindType = checker.getTypeOfSymbolAtLocation(
            exprKind,
            node
          );
          if (exprKindType.isStringLiteral()) {
            return exprKindType.value as any;
          }
        }
        return undefined;
      }
    };
  };
}

function getOperator(op: ts.BinaryOperatorToken): BinaryOp | undefined {
  return OperatorMappings[op.kind as keyof typeof OperatorMappings];
}

const OperatorMappings = {
  [ts.SyntaxKind.EqualsToken]: "=",
  [ts.SyntaxKind.PlusToken]: "+",
  [ts.SyntaxKind.MinusToken]: "-",
  [ts.SyntaxKind.AmpersandAmpersandToken]: "&&",
  [ts.SyntaxKind.BarBarToken]: "||",
  [ts.SyntaxKind.EqualsEqualsToken]: "==",
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: "==",
  [ts.SyntaxKind.LessThanEqualsToken]: "<=",
  [ts.SyntaxKind.LessThanToken]: "<",
  [ts.SyntaxKind.GreaterThanEqualsToken]: ">=",
  [ts.SyntaxKind.GreaterThanToken]: ">",
} as const;
