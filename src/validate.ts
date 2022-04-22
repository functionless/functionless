import { FunctionlessChecker } from "./checker";

/**
 * Validates a TypeScript SourceFile containing Functionless primitives does not
 * unsupported syntax.
 *
 * @param ts a reference to the TypeScript Server.
 * @param checker the Program's {@link FunctionlessChecker}.
 * @param sf the TypeScript SourceFile.
 * @returns diagnostic errors for the file.
 */
export function validate(
  ts: typeof import("typescript/lib/tsserverlibrary"),
  checker: FunctionlessChecker,
  sf: import("typescript").SourceFile
): ts.Diagnostic[] {
  return (function visit(node: ts.Node): ts.Diagnostic[] {
    return [
      ...(checker.isStepFunction(node) ? validateStepFunctionNode(node) : []),
      ...(ts.forEachChild(node, visit) ?? []),
    ];
  })(sf);

  function validateStepFunctionNode(node: ts.Node): ts.Diagnostic[] {
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      // assignment statement
      // TODO: check if the assignment references an expression in an illegal scope
      const variable = checker.getSymbolAtLocation(node.expression.left);
      const value = checker.getSymbolAtLocation(node.expression.right);
    }

    return descend();

    function descend() {
      return ts.forEachChild(node, validateStepFunctionNode) ?? [];
    }
  }
}
