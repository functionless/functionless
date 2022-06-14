import type * as typescript from "typescript";
import { FunctionlessChecker, isArithmeticToken } from "./checker";
import { ErrorCode, ErrorCodes } from "./error-code";

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
  node: ts.Node,
  logger?: {
    info(message: string): void;
  }
): ts.Diagnostic[] {
  logger?.info("Beginning validation of Functionless semantics");

  return (function visit(node: ts.Node): ts.Diagnostic[] {
    if (checker.isStepFunction(node)) {
      return collectEachChildRecursive(node, validateStepFunctionNode);
    } else if (checker.isApiIntegration(node)) {
      return validateApiRequest(node);
    } else {
      return collectEachChild(node, visit);
    }
  })(node);

  // ts.forEachChild terminates whenever a truth value is returned
  // ts.visitEachChild requires a ts.TransformationContext, so we can't use that
  // this wrapper uses a mutable array to collect the results
  function collectEachChild<T>(node: ts.Node, cb: (node: ts.Node) => T[]): T[] {
    const results: T[] = [];
    ts.forEachChild(node, (child) => {
      results.push(...cb(child));
    });
    return results;
  }

  // apply the callback to all nodes in the tree
  function collectEachChildRecursive<T>(
    node: ts.Node,
    cb: (node: ts.Node) => T[]
  ): T[] {
    return collectEachChild(node, (node) => [
      ...cb(node),
      ...collectEachChildRecursive(node, cb),
    ]);
  }

  function validateStepFunctionNode(node: ts.Node): ts.Diagnostic[] {
    if (
      (ts.isBinaryExpression(node) &&
        isArithmeticToken(node.operatorToken.kind) &&
        !checker.isConstant(node)) ||
      (ts.isPrefixUnaryExpression(node) && !checker.isConstant(node))
    ) {
      return [
        newError(
          node,
          ErrorCodes.Cannot_perform_arithmetic_on_variables_in_Step_Function
        ),
      ];
    }
    return [];
  }

  function validateApiRequest(node: ts.NewExpression): ts.Diagnostic[] {
    const kind = checker.getApiMethodKind(node);
    if (kind === "AwsMethod") {
      // @ts-ignore
      const [props, request, responses, errors] = node.arguments ?? [];

      if (request === undefined) {
        // should be a standard type error - the request is missing
      } else if (
        (ts.isArrowFunction(request) ||
          ts.isFunctionExpression(request) ||
          ts.isFunctionDeclaration(request)) &&
        request.body !== undefined
      ) {
        const numIntegrations = countIntegrationCalls(request);
        if (numIntegrations === 0 || numIntegrations > 1) {
          return [
            newError(
              request,
              ErrorCodes.AwsMethod_request_must_have_exactly_one_integration_call
            ),
          ];
        }
      } else {
        return [
          newError(request, ErrorCodes.Argument_must_be_an_inline_Function),
        ];
      }
    } else if (kind === "MockMethod") {
      // @ts-ignore
      const [props, request, responses] = node.arguments;
    }
    return [];
  }

  function countIntegrationCalls(node: ts.Node): number {
    if (ts.isCallExpression(node)) {
      const kind = checker.getFunctionlessTypeKind(
        checker.getTypeAtLocation(node.expression)
      );
      if (kind) {
        return 1 + descend();
      }
    }
    return descend();

    function descend(): number {
      let count = 0;
      ts.forEachChild(node, (node) => {
        count += countIntegrationCalls(node);
      });
      return count;
    }
  }

  function newError(
    invalidNode: ts.Node,
    error: ErrorCode,
    messageText?: string
  ): ts.Diagnostic {
    const baseUrl = process.env.FUNCTIONLESS_LOCAL
      ? `http://localhost:3000`
      : `https://functionless.org`;

    return {
      source: "Functionless",
      code: error.code,
      messageText: `${messageText ?? error.messageText}

${baseUrl}/docs/error-codes#${error.messageText.replace(/ /g, "-")}"`,
      category: ts.DiagnosticCategory.Error,
      file: invalidNode.getSourceFile(),
      start: invalidNode.pos,
      length: invalidNode.end - invalidNode.pos,
    };
  }
}
