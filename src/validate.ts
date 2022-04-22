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
  return (
    ts.forEachChild(sf, function visit(node): ts.Diagnostic[] {
      if (checker.isStepFunction(node)) {
        return validateStepFunctionNode(node);
      }
      return ts.forEachChild(node, visit) ?? [];
    }) ?? []
  );

  function validateStepFunctionNode(node: ts.Node): ts.Diagnostic[] {
    if (
      ts.isExpressionStatement(node) &&
      ts.isBinaryExpression(node.expression) &&
      node.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken
    ) {
      // assignment statement
      // TODO: check if the assignment references an expression in an illegal scope
    }

    return descend();

    function descend() {
      return ts.forEachChild(node, validateStepFunctionNode) ?? [];
    }
  }
}
