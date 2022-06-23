import * as typescript from "typescript";
import {
  EventBusMapInterface,
  EventBusWhenInterface,
  EventTransformInterface,
  FunctionInterface,
  FunctionlessChecker,
  isArithmeticToken,
  NewAppsyncFieldInterface,
  NewAppsyncResolverInterface,
  NewStepFunctionInterface,
  RuleInterface,
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
  node: ts.Node,
  logger?: {
    info(message: string): void;
  }
): ts.Diagnostic[] {
  logger?.info("Beginning validation of Functionless semantics");

  function visit(node: typescript.Node): typescript.Diagnostic[] {
    if (checker.isNewStepFunction(node)) {
      return validateNewStepFunctionNode(node);
    } else if (checker.isApiIntegration(node)) {
      return validateApi(node);
    } else if (checker.isNewFunctionlessFunction(node)) {
      return validateFunctionNode(node);
    } else if (checker.isAppsyncResolver(node)) {
      return validateNewAppsyncResolverNode(node);
    } else if (checker.isAppsyncField(node)) {
      return validateNewAppsyncFieldNode(node);
    } else if (checker.isEventBusWhenFunction(node)) {
      return validateEventBusWhen(node);
    } else if (checker.isRuleMapFunction(node)) {
      return validateEventBusMap(node);
    } else if (checker.isNewRule(node)) {
      return validateRule(node);
    } else if (checker.isNewEventTransform(node)) {
      return validateEventTransform(node);
    } else {
      return collectEachChild(node, visit);
    }
  }

  return visit(node);

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

  function validateNodes(nodes: typescript.Node[]) {
    return nodes.flatMap((arg) => collectEachChild(arg, visit));
  }

  function validateNewStepFunctionNode(node: NewStepFunctionInterface) {
    const func =
      node.arguments.length === 4 ? node.arguments[3] : node.arguments[2];

    return [
      // visit all other arguments
      ...validateNodes(node.arguments.filter((arg) => arg !== func)),
      // process the function closure
      ...collectEachChildRecursive(func, validateStepFunctionNode),
    ];
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
    if (ts.isCallExpression(node)) {
      return validatePromiseCalls(node);
    } else return [];
  }

  /**
   * Validates that calls which return promises are immediately awaited and that calls
   * which return arrays fo promises are wrapped in `Promise.all`
   *
   * ```ts
   * const func = new Function(...);
   * new StepFunction(stack, id, async () => {
   *    // invalid
   *    const v = func();
   *    // valid
   *    const v = await func();
   *    // valid
   *    return func();
   *
   *    // invalid
   *    [1,2].map(() => func());
   *    // valid
   *    await Promise.all([1,2].map(() => func()));
   * })
   * ```
   */
  function validatePromiseCalls(node: ts.CallExpression): ts.Diagnostic[] {
    const type = checker.getTypeAtLocation(node);
    const typeSymbol = type.getSymbol();
    if (
      ts.isCallExpression(node) &&
      typeSymbol &&
      checker.isPromiseSymbol(typeSymbol) &&
      !(
        ts.isAwaitExpression(node.parent) ||
        ts.isReturnStatement(node.parent) ||
        ts.isArrowFunction(node.parent)
      )
    ) {
      return [
        newError(
          node,
          ErrorCodes.Integration_must_be_immediately_awaited_or_returned
        ),
      ];
    } else if (
      checker.isPromiseArray(type) &&
      !checker.isPromiseAllCall(node.parent)
    ) {
      return [
        newError(
          node,
          ErrorCodes.Arrays_of_Integration_must_be_immediately_wrapped_in_Promise_all
        ),
      ];
    }
    return [];
  }

  function validateNewAppsyncResolverNode(
    node: NewAppsyncResolverInterface
  ): ts.Diagnostic[] {
    const func = node.arguments[3];
    const [resolver, errors] = validateInlineFunctionArgument(func);
    if (!resolver) {
      return errors;
    }

    return [
      ...validateNodes(node.arguments.filter((n) => n !== resolver)),
      ...collectEachChildRecursive(resolver, validateAppsync),
    ];
  }

  function validateNewAppsyncFieldNode(
    node: NewAppsyncFieldInterface
  ): ts.Diagnostic[] {
    const func = node.arguments[1];
    const [resolver, errors] = validateInlineFunctionArgument(func);
    if (!resolver) {
      return errors;
    }

    return [
      ...validateNodes(node.arguments.filter((n) => n !== resolver)),
      ...collectEachChildRecursive(resolver, validateAppsync),
    ];
  }

  function validateAppsync(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      return validatePromiseCalls(node);
    }

    return [];
  }

  function validateInlineFunctionArgument(
    node: ts.Node
  ):
    | [undefined, ts.Diagnostic[]]
    | [ts.ArrowFunction | ts.FunctionExpression, []] {
    if (!(ts.isArrowFunction(node) || ts.isFunctionExpression(node))) {
      return [
        undefined,
        [newError(node, ErrorCodes.Argument_must_be_an_inline_Function)],
      ];
    }

    return [node, []];
  }

  function validateApi(node: ts.NewExpression): ts.Diagnostic[] {
    const kind = checker.getApiMethodKind(node);
    if (kind === "AwsMethod") {
      // @ts-ignore
      const [props, request, responses, errors] = node.arguments ?? [];

      const diagnostics = [
        ...collectEachChildRecursive(request, validateApiNode),
        ...collectEachChildRecursive(responses, validateApiResponseNode),
      ];

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
            ...diagnostics,
            newError(
              request,
              ErrorCodes.AwsMethod_request_must_have_exactly_one_integration_call
            ),
          ];
        }
      } else {
        return [
          ...diagnostics,
          newError(request, ErrorCodes.Argument_must_be_an_inline_Function),
        ];
      }
      return diagnostics;
    } else if (kind === "MockMethod") {
      // @ts-ignore
      const [props, request, responses] = node.arguments;
    }
    return [];
  }

  function validateApiResponseNode(node: ts.Node): ts.Diagnostic[] {
    if (
      ts.isCallExpression(node) &&
      checker.isIntegrationNode(node.expression)
    ) {
      return [
        newError(
          node,
          ErrorCodes.API_gateway_response_mapping_template_cannot_call_integration
        ),
      ];
    }
    return [];
  }

  function validateApiNode(node: ts.Node): ts.Diagnostic[] {
    if (ts.isComputedPropertyName(node)) {
      return [
        newError(
          node,
          ErrorCodes.API_Gateway_does_not_support_computed_property_names
        ),
      ];
    } else if (ts.isSpreadAssignment(node)) {
      return [
        newError(
          node,
          ErrorCodes.API_Gateway_does_not_support_spread_assignment_expressions
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
      ...validateNodes(node.arguments.filter((arg) => arg !== func)),
      // process the function closure
      ...collectEachChildRecursive(func, validateFunctionClosureNode),
    ];
  }

  function validateFunctionClosureNode(
    node: typescript.Node
  ): typescript.Diagnostic[] {
    if (
      checker.isStepFunction(node) ||
      checker.isTable(node) ||
      checker.isFunctionlessFunction(node) ||
      checker.isEventBus(node)
    ) {
      if (
        typescript.isPropertyAccessExpression(node.parent) &&
        node.parent.name.text === "resource"
      ) {
        return [
          newError(
            node,
            ErrorCodes.Cannot_use_infrastructure_Resource_in_Function_closure
          ),
        ];
      }
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

  function validateEventBusWhen(
    node: EventBusWhenInterface
  ): typescript.Diagnostic[] {
    const func =
      node.arguments.length === 3 ? node.arguments[2] : node.arguments[1];

    return [
      // visit all other arguments
      ...validateNodes(node.arguments.filter((arg) => arg !== func)),
      // process the function closure
      ...collectEachChildRecursive(func, validateRulePredicate),
    ];
  }

  function validateRule(node: RuleInterface): typescript.Diagnostic[] {
    const func = node.arguments[3];

    return [
      // visit all other arguments
      ...validateNodes(node.arguments.filter((arg) => arg !== func)),
      // process the function closure
      ...collectEachChildRecursive(func, validateRulePredicate),
    ];
  }

  function validateRulePredicate(node: ts.Node): ts.Diagnostic[] {
    if (
      ts.isCallExpression(node) &&
      checker.isIntegrationNode(node.expression)
    ) {
      return [
        newError(node, ErrorCodes.EventBus_Rules_do_not_support_Integrations),
      ];
    }

    return [];
  }

  function validateEventTransform(
    node: EventTransformInterface
  ): typescript.Diagnostic[] {
    const func = node.arguments[1];

    return [
      // visit all other arguments
      ...validateNodes(node.arguments.filter((arg) => arg !== func)),
      // process the function closure
      ...collectEachChildRecursive(func, validateMapTransformer),
    ];
  }

  function validateEventBusMap(
    node: EventBusMapInterface
  ): typescript.Diagnostic[] {
    const func = node.arguments[0];

    return [
      // visit all other arguments
      ...validateNodes(node.arguments.filter((arg) => arg !== func)),
      // process the function closure
      ...collectEachChildRecursive(func, validateMapTransformer),
    ];
  }

  function validateMapTransformer(node: ts.Node): ts.Diagnostic[] {
    if (
      ts.isCallExpression(node) &&
      checker.isIntegrationNode(node.expression)
    ) {
      return [
        newError(node, ErrorCodes.EventBus_Rules_do_not_support_Integrations),
      ];
    }

    return [];
  }

  function newError(
    invalidNode: ts.Node,
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

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
