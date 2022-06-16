import * as typescript from "typescript";
import {
  FunctionInterface,
  FunctionlessChecker,
  isArithmeticToken,
} from "./checker";
import { ErrorCode, ErrorCodes, formatErrorMessage } from "./error-code";

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

  function visit(node: typescript.Node): typescript.Diagnostic[] {
    if (checker.isNewStepFunction(node)) {
      return validateEachChildRecursive(node, validateStepFunctionNode);
    } else if (checker.isNewFunctionlessFunction(node)) {
      return validateFunctionNode(node);
    } else {
      return validateEachChild(node, visit);
    }
  }

  return visit(node);

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

  // apply the callback to all nodes in the tree
  function validateEachChildRecursive<T>(
    node: typescript.Node,
    cb: (node: typescript.Node) => T[]
  ): T[] {
    return validateEachChild(node, (node) => [
      ...cb(node),
      ...validateEachChildRecursive(node, cb),
    ]);
  }

  function validateStepFunctionNode(
    node: typescript.Node
  ): typescript.Diagnostic[] {
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

  function validateFunctionNode(node: FunctionInterface) {
    const func =
      node.arguments.length === 4 ? node.arguments[3] : node.arguments[2];

    return [
      // visit all other arguments
      ...node.arguments
        .filter((arg) => arg !== func)
        .flatMap((arg) => validateEachChildRecursive(arg, visit)),
      // process the function closure
      ...validateEachChildRecursive(func, validateFunctionClosureNode),
    ];
  }

  function validateFunctionClosureNode(
    node: typescript.Node
  ): typescript.Diagnostic[] {
    if (
      checker.isStepFunction(node) ||
      checker.isTable(node) ||
      checker.isFunctionlessFunction(node)
    ) {
      if (
        typescript.isPropertyAccessExpression(node.parent) &&
        node.parent.name.text === "resource"
      ) {
        return [
          newError(node, ErrorCodes.Cannot_Use_Infra_Resource_In_Function),
        ];
      }
    } else if (checker.isEventBus(node)) {
      if (
        typescript.isPropertyAccessExpression(node.parent) &&
        node.parent.name.text === "bus"
      ) {
        return [
          newError(node, ErrorCodes.Cannot_Use_Infra_Resource_In_Function),
        ];
      }
    }
    return [];
  }

  function newError(
    invalidNode: typescript.Node,
    error: ErrorCode,
    messageText?: string
  ): ts.Diagnostic {
    return {
      source: "Functionless",
      code: error.code,
      messageText: formatErrorMessage(error, messageText),
      category: ts.DiagnosticCategory.Error,
      file: invalidNode.getSourceFile(),
      start: invalidNode.pos,
      length: invalidNode.end - invalidNode.pos,
    };
  }
}
