import { FunctionlessChecker } from "./checker";

import type * as typescript from "typescript";

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
  ts: typeof typescript,
  checker: FunctionlessChecker,
  sf: typescript.SourceFile,
  logger?: {
    info(message: string): void;
  }
): typescript.Diagnostic[] {
  logger?.info(`Beginning validation of Functionless semantics`);

  return (function visit(node: typescript.Node): typescript.Diagnostic[] {
    return [
      ...(checker.isStepFunction(node) ? validateStepFunctionNode(node) : []),
      ...(visitEachChild(node, visit) ?? []),
    ];
  })(sf);

  function validateStepFunctionNode(
    node: typescript.Node
  ): typescript.Diagnostic[] {
    const children = visitEachChild(node, validateStepFunctionNode);
    if (
      ts.isBinaryExpression(node) &&
      [ts.SyntaxKind.PlusToken, ts.SyntaxKind.MinusToken].includes(
        node.operatorToken.kind
      )
    ) {
      return [
        <typescript.Diagnostic>{
          category: ts.DiagnosticCategory.Error,
          code: 100,
          file: sf,
          start: node.pos,
          length: node.end - node.pos,
          messageText: `arithmetic is not supported in a Step Function`,
        },
      ].concat(children);
    }
    return children;
  }

  // ts.forEachChild terminates whenever a truth value is returned
  // ts.visitEachChild requires a ts.TransformationContext, so we can't use that
  // this wrapper uses a mutable array to collect the results
  function visitEachChild<T>(
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
