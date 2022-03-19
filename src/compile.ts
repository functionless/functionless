import ts from "typescript";
import { PluginConfig, TransformerExtras } from "ts-patch";
import { BinaryOp, CanReference } from "./expression";
import { FunctionlessNode } from "./node";

export default compile;

/**
 * Configuration options for the functionless TS transform.
 */
export interface FunctionlessConfig extends PluginConfig {}

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
        const type = getFunctionlessType(node);
        if (type === "AppsyncResolver") {
          return visitAppsyncResolver(node as ts.NewExpression);
        } else if (type === "StepFunction" || type === "ExpressStepFunction") {
          return visitStepFunction(node as ts.NewExpression);
        } else if (type === "reflect") {
          return toFunction(
            "FunctionDecl",
            (node as ts.CallExpression).arguments[0] as ts.FunctionExpression
          );
        }
        return ts.visitEachChild(node, visitor, ctx);
      }

      function getFunctionlessType(
        node: ts.Node
      ):
        | "AppsyncResolver"
        | "StepFunction"
        | "ExpressStepFunction"
        | "reflect"
        | undefined {
        if (ts.isNewExpression(node)) {
          const exprType = checker.getTypeAtLocation(node.expression);
          const exprDecl = exprType.symbol?.declarations?.[0];
          if (exprDecl && ts.isClassDeclaration(exprDecl)) {
            const member = exprDecl.members.find(
              (member) =>
                member.modifiers?.find(
                  (mod) => mod.kind === ts.SyntaxKind.StaticKeyword
                ) !== undefined &&
                member.name &&
                ts.isIdentifier(member.name) &&
                member.name.text === "FunctionlessType"
            );

            if (
              member &&
              ts.isPropertyDeclaration(member) &&
              member.initializer &&
              ts.isStringLiteral(member.initializer) &&
              (member.initializer.text === "AppsyncResolver" ||
                member.initializer.text === "StepFunction" ||
                member.initializer.text === "ExpressStepFunction")
            ) {
              return member.initializer.text;
            }
            return undefined;
          }
        } else if (ts.isCallExpression(node)) {
          const exprType = checker.getTypeAtLocation(node.expression);
          const exprDecl = exprType.symbol?.declarations?.[0];
          if (exprDecl && ts.isFunctionDeclaration(exprDecl)) {
            if (exprDecl.name?.text === "reflect") {
              return "reflect";
            }
          }
        }
        return undefined;
      }

      function visitStepFunction(call: ts.NewExpression): ts.Node {
        return ts.factory.updateNewExpression(
          call,
          call.expression,
          call.typeArguments,
          call.arguments?.map((arg) =>
            ts.isFunctionExpression(arg) || ts.isArrowFunction(arg)
              ? toFunction("FunctionDecl", arg)
              : arg
          )
        );
      }

      function visitAppsyncResolver(call: ts.NewExpression): ts.Node {
        if (call.arguments?.length === 1) {
          const impl = call.arguments[0];
          if (ts.isFunctionExpression(impl) || ts.isArrowFunction(impl)) {
            return ts.factory.updateNewExpression(
              call,
              call.expression,
              call.typeArguments,
              [toFunction("FunctionDecl", impl)]
            );
          }
        }
        return call;
      }

      function toFunction(
        type: "FunctionDecl" | "FunctionExpr",
        impl: ts.FunctionDeclaration | ts.ArrowFunction | ts.FunctionExpression,
        dropArgs?: number
      ): ts.Expression {
        const params =
          dropArgs === undefined
            ? impl.parameters
            : impl.parameters.slice(dropArgs);

        if (impl.body === undefined) {
          throw new Error(
            `cannot parse declaration-only function: ${impl.getText()}`
          );
        }
        const body = ts.isBlock(impl.body)
          ? toExpr(impl.body)
          : newExpr("BlockStmt", [
              ts.factory.createArrayLiteralExpression([
                newExpr("ReturnStmt", [toExpr(impl.body)]),
              ]),
            ]);

        return newExpr(type, [
          ts.factory.createArrayLiteralExpression(
            params
              .map((param) => param.name.getText())
              .map((arg) =>
                newExpr("ParameterDecl", [ts.factory.createStringLiteral(arg)])
              )
          ),
          body,
        ]);
      }

      function toExpr(node: ts.Node | undefined): ts.Expression {
        if (node === undefined) {
          return newExpr("NullLiteralExpr", []);
        } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
          return toFunction("FunctionExpr", node);
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
            ts.isStringLiteral(node.name) ||
            (ts.isIdentifier(node.name) &&
              (node.name.text === "null" || node.name.text === "undefined"))
              ? string(node.name.text)
              : ts.isComputedPropertyName(node.name)
              ? toExpr(node.name.expression)
              : string(node.name.text),
            toExpr(node.initializer),
          ]);
        } else if (ts.isShorthandPropertyAssignment(node)) {
          return newExpr("PropAssignExpr", [
            newExpr("Identifier", [
              ts.factory.createStringLiteral(node.name.text),
            ]),
            toExpr(node.name),
          ]);
        } else if (ts.isSpreadAssignment(node)) {
          return newExpr("SpreadAssignExpr", [toExpr(node.expression)]);
        } else if (ts.isSpreadElement(node)) {
          return newExpr("SpreadElementExpr", [toExpr(node.expression)]);
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
        } else if (ts.isTemplateExpression(node)) {
          const exprs = [];
          if (node.head.text) {
            exprs.push(string(node.head.text));
          }
          for (const span of node.templateSpans) {
            exprs.push(toExpr(span.expression));
            if (span.literal.text) {
              exprs.push(string(span.literal.text));
            }
          }
          return newExpr("TemplateExpr", [
            ts.factory.createArrayLiteralExpression(exprs),
          ]);
        } else if (ts.isBreakStatement(node)) {
          return newExpr("BreakStmt", []);
        } else if (ts.isTryStatement(node)) {
          return newExpr("TryStmt", [
            toExpr(node.tryBlock),
            node.catchClause
              ? toExpr(node.catchClause)
              : ts.factory.createIdentifier("undefined"),
            node.finallyBlock
              ? toExpr(node.finallyBlock)
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isCatchClause(node)) {
          return newExpr("CatchClause", [
            node.variableDeclaration
              ? toExpr(node.variableDeclaration)
              : ts.factory.createIdentifier("undefined"),
            toExpr(node.block),
          ]);
        } else if (ts.isThrowStatement(node)) {
          return newExpr("ThrowStmt", [toExpr(node.expression)]);
        }

        throw new Error(`unhandled node: ${node.getText()}`);
      }

      function ref(node: ts.Expression) {
        return newExpr("ReferenceExpr", [
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
        return newExpr("StringLiteralExpr", [
          ts.factory.createStringLiteral(literal),
        ]);
      }

      function newExpr(type: FunctionlessNode["kind"], args: ts.Expression[]) {
        return ts.factory.createNewExpression(
          ts.factory.createPropertyAccessExpression(functionless, type),
          undefined,
          args
        );
      }

      function getKind(node: ts.Node): CanReference["kind"] | undefined {
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
