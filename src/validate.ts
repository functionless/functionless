import type * as typescript from "typescript";
import { FunctionlessChecker } from "./checker";

/**
 * Validates a TypeScript SourceFile containing Functionless primitives does not
 * unsupported syntax.
 *
 * @param ts a reference to the TypeScript Server.
 * @param checker the Program's {@link FunctionlessChecker}.
 * @param node the TypeScript AST Node to validate
 * @param logger an optional object with methods for logging info
 * @returns diagnostic errors for the file.
 */
export function validate(
  ts: typeof typescript,
  checker: FunctionlessChecker,
  node: typescript.Node,
  logger?: {
    info(message: string): void;
  }
): typescript.Diagnostic[] {
  logger?.info("Beginning validation of Functionless semantics");

  return (function visit(node: typescript.Node): typescript.Diagnostic[] {
    if (checker.isStepFunction(node)) {
      return validateStepFunctionNode(node);
    } else {
      return validateEachChild(node, visit);
    }
  })(node);

  function validateStepFunctionNode(
    node: typescript.Node
  ): typescript.Diagnostic[] {
    const children = validateEachChild(node, validateStepFunctionNode);
    if (ts.isBinaryExpression(node)) {
      if (
        [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(
          node.operatorToken.kind
        )
      ) {
        return [
          <typescript.Diagnostic>{
            source: "Functionless",
            key: "Functionless",
            category: ts.DiagnosticCategory.Error,
            code: 100,
            file: node.getSourceFile(),
            start: node.pos,
            length: node.end - node.pos,
            messageText: "arithmetic is not supported in a Step Function",
          },
        ].concat(children);
      }
    }
    return children;
  }

  // ts.forEachChild terminates whenever a truth value is returned
  // ts.visitEachChild requires a ts.TransformationContext, so we can't use that
  // this wrapper uses a mutable array to collect the results
  function validateEachChild<T>(
    node: typescript.Node,
    cb: (node: typescript.Node) => T[]
  ): T[] {
    const results: T[] = [];
    ts.forEachChild(node, (child) => {
      results.push(...cb(child));
    });
    return results;
  }
}
