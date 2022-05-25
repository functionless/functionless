import * as ts from "typescript";
import * as tsserver from "typescript/lib/tsserverlibrary";
import { AppsyncResolver } from "./appsync";
import { EventBus, EventBusRule } from "./event-bridge";
import { EventBusTransform } from "./event-bridge/transform";
import { Function } from "./function";
import { ExpressStepFunction, StepFunction } from "./step-function";

/**
 * Various types that could be in a call argument position of a function parameter.
 */
export type TsFunctionParameter =
  | ts.FunctionExpression
  | ts.ArrowFunction
  | ts.Identifier
  | ts.PropertyAccessExpression
  | ts.ElementAccessExpression
  | ts.CallExpression;

export type EventBusRuleInterface = ts.NewExpression & {
  arguments: [any, any, any, TsFunctionParameter];
};

export type EventBusTransformInterface = ts.NewExpression & {
  arguments: [TsFunctionParameter, any];
};

export type EventBusWhenInterface = ts.CallExpression & {
  arguments: [any, any, TsFunctionParameter];
};

export type EventBusMapInterface = ts.CallExpression & {
  arguments: [TsFunctionParameter];
};

export type FunctionInterface = ts.NewExpression & {
  arguments:
    | [
        // scope
        ts.Expression,
        // id
        ts.Expression,
        // props
        ts.Expression,
        // closure
        TsFunctionParameter
      ]
    | [
        // scope
        ts.Expression,
        // id
        ts.Expression,
        // closure
        TsFunctionParameter
      ];
};

export type ApiIntegrationsStaticMethodInterface = ts.CallExpression & {
  arguments: [ts.ObjectLiteralExpression];
};

export type FunctionlessChecker = ReturnType<typeof makeFunctionlessChecker>;

export function makeFunctionlessChecker(
  checker: ts.TypeChecker | tsserver.TypeChecker
) {
  return {
    ...checker,
    isConstant,
    isAppsyncResolver,
    isEventBusRuleMapFunction,
    isEventBusWhenFunction,
    isFunctionlessType,
    isNewEventBusRule,
    isNewEventBusTransform,
    isReflectFunction,
    isStepFunction,
    isNewFunctionlessFunction,
    isApiIntegrationsStaticMethod,
    isCDKConstruct,
    getFunctionlessTypeKind,
  };

  /**
   * Matches the patterns:
   *   * new EventBusRule()
   */
  function isNewEventBusRule(node: ts.Node): node is EventBusRuleInterface {
    return ts.isNewExpression(node) && isEventBusRule(node.expression);
  }

  /**
   * Matches the patterns:
   *   * new EventBusTransform()
   */
  function isNewEventBusTransform(
    node: ts.Node
  ): node is EventBusTransformInterface {
    return ts.isNewExpression(node) && isEventBusTransform(node.expression);
  }

  /**
   * Matches the patterns:
   *   * IEventBus.when
   *   * IEventBusRule.when
   */
  function isEventBusWhenFunction(
    node: ts.Node
  ): node is EventBusWhenInterface {
    return (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "when" &&
      (isEventBus(node.expression.expression) ||
        isEventBusRule(node.expression.expression))
    );
  }

  /**
   * Matches the patterns:
   *   * IEventBusRule.map()
   */
  function isEventBusRuleMapFunction(
    node: ts.Node
  ): node is EventBusMapInterface {
    return (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "map" &&
      isEventBusRule(node.expression.expression)
    );
  }

  /**
   * Checks to see if a node is of type EventBus.
   * The node could be any kind of node that returns an event bus rule.
   *
   * Matches the patterns:
   *   * IEventBus
   */
  function isEventBus(node: ts.Node) {
    return isFunctionlessClassOfKind(node, EventBus.FunctionlessType);
  }

  /**
   * Checks to see if a node is of type {@link EventBusRule}.
   * The node could be any kind of node that returns an event bus rule.
   *
   * Matches the patterns:
   *   * IEventBusRule
   */
  function isEventBusRule(node: ts.Node) {
    return isFunctionlessClassOfKind(node, EventBusRule.FunctionlessType);
  }

  /**
   * Checks to see if a node is of type {@link EventBusTransform}.
   * The node could be any kind of node that returns an event bus rule.
   *
   * Matches the patterns:
   *   * IEventBusTransform
   */
  function isEventBusTransform(node: ts.Node) {
    return isFunctionlessClassOfKind(node, EventBusTransform.FunctionlessType);
  }

  function isAppsyncResolver(node: ts.Node): node is ts.NewExpression & {
    arguments: [TsFunctionParameter, ...ts.Expression[]];
  } {
    if (ts.isNewExpression(node)) {
      return isFunctionlessClassOfKind(
        node.expression,
        AppsyncResolver.FunctionlessType
      );
    }
    return false;
  }

  function isReflectFunction(node: ts.Node): node is ts.CallExpression & {
    arguments: [TsFunctionParameter, ...ts.Expression[]];
  } {
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

  function isStepFunction(node: ts.Node): node is ts.NewExpression & {
    arguments: [TsFunctionParameter, ...ts.Expression[]];
  } {
    if (ts.isNewExpression(node)) {
      return (
        isFunctionlessClassOfKind(node, StepFunction.FunctionlessType) ||
        isFunctionlessClassOfKind(node, ExpressStepFunction.FunctionlessType)
      );
    }
    return false;
  }

  function isNewFunctionlessFunction(node: ts.Node): node is FunctionInterface {
    return (
      ts.isNewExpression(node) &&
      isFunctionlessClassOfKind(node.expression, Function.FunctionlessType) &&
      // only take the form with the arrow function at the end.
      (node.arguments?.length === 3
        ? ts.isArrowFunction(node.arguments[2])
        : node.arguments?.length === 4
        ? ts.isArrowFunction(node.arguments[3])
        : false)
    );
  }

  function isApiIntegrationsStaticMethod(
    node: ts.Node
  ): node is ApiIntegrationsStaticMethodInterface {
    const x =
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      (node.expression.name.text === "mock" ||
        node.expression.name.text == "aws") &&
      ts.isIdentifier(node.expression.expression) &&
      // TODO: is this enough? should we grab the type and make sure it
      // has FunctionlessKind?
      node.expression.expression.text === "ApiIntegrations";
    return x;
  }

  /**
   * Heuristically evaluate the fqn of a symbol to be in a module and of a type name.
   *
   * /somePath/node_modules/{module}/somePath.{typeName}
   *
   * isInstanceOf(typeSymbol, "constructs", "Construct")
   * ex: /home/sussmans/functionless/node_modules/constructs/lib/index.js
   */
  function isInstanceOf(symbol: ts.Symbol, module: string, typeName: string) {
    const find = /.*\/node_modules\/([^\/]*)\/.*\.(.*)$/g.exec(
      checker.getFullyQualifiedName(symbol)
    );

    const [_, mod, type] = find ?? [];

    return mod === module && type === typeName;
  }

  function isCDKConstruct(type: ts.Type): boolean {
    const typeSymbol = type.getSymbol();

    return (
      ((typeSymbol && isInstanceOf(typeSymbol, "constructs", "Construct")) ||
        type.getBaseTypes()?.some((t) => isCDKConstruct(t))) ??
      false
    );
  }

  /**
   * Checks if the type contains one of
   * a static property FunctionlessType with the value of {@param kind}
   * a property signature functionlessKind with literal type with the value of {@param kind}
   * a readonly property functionlessKind with literal type with the value of {@param kind}
   */
  function isFunctionlessType(
    type: ts.Type | undefined,
    kind: string
  ): boolean {
    return !!type && getFunctionlessTypeKind(type) === kind;
  }

  function isFunctionlessClassOfKind(node: ts.Node, kind: string) {
    const type = checker.getTypeAtLocation(node);
    return isFunctionlessType(type, kind);
  }

  function getFunctionlessTypeKind(type: ts.Type): string | undefined {
    const functionlessType = type.getProperty("FunctionlessType");
    const functionlessKind = type.getProperty("functionlessKind");
    const prop = functionlessType ?? functionlessKind;

    if (prop && prop.valueDeclaration) {
      if (
        ts.isPropertyDeclaration(prop.valueDeclaration) &&
        prop.valueDeclaration.initializer &&
        ts.isStringLiteral(prop.valueDeclaration.initializer)
      ) {
        return prop.valueDeclaration.initializer.text;
      } else if (ts.isPropertySignature(prop.valueDeclaration)) {
        const type = checker.getTypeAtLocation(prop.valueDeclaration);
        if (type.isStringLiteral()) {
          return type.value;
        }
      }
    }
    return undefined;
  }

  /**
   * Check if a TS node is a constant value that can be evaluated at compile time.
   */
  function isConstant(node: ts.Node): boolean {
    if (
      ts.isStringLiteral(node) ||
      ts.isNumericLiteral(node) ||
      node.kind === ts.SyntaxKind.TrueKeyword ||
      node.kind === ts.SyntaxKind.FalseKeyword ||
      node.kind === ts.SyntaxKind.NullKeyword ||
      node.kind === ts.SyntaxKind.UndefinedKeyword
    ) {
      return true;
    } else if (ts.isIdentifier(node)) {
      const sym = checker
        .getSymbolsInScope(
          node,
          // eslint-disable-next-line no-bitwise
          ts.SymbolFlags.BlockScopedVariable |
            ts.SymbolFlags.FunctionScopedVariable
        )
        .find((sym) => sym.name === node.text);
      if (sym?.valueDeclaration) {
        return isConstant(sym.valueDeclaration);
      }
    } else if (ts.isVariableDeclaration(node) && node.initializer) {
      return isConstant(node.initializer);
    } else if (ts.isPropertyAccessExpression(node)) {
      return isConstant(node.expression);
    } else if (ts.isElementAccessExpression(node)) {
      return isConstant(node.argumentExpression) && isConstant(node.expression);
    } else if (ts.isArrayLiteralExpression(node)) {
      return (
        node.elements.length === 0 ||
        node.elements.find((e) => !isConstant(e)) === undefined
      );
    } else if (ts.isSpreadElement(node)) {
      return isConstant(node.expression);
    } else if (ts.isObjectLiteralExpression(node)) {
      return (
        node.properties.length === 0 ||
        node.properties.find((e) => !isConstant(e)) === undefined
      );
    } else if (ts.isPropertyAssignment(node)) {
      return isConstant(node.initializer);
    } else if (ts.isSpreadAssignment(node)) {
      return isConstant(node.expression);
    } else if (
      ts.isBinaryExpression(node) &&
      isArithmeticToken(node.operatorToken.kind)
    ) {
      return isConstant(node.left) && isConstant(node.right);
    } else if (
      ts.isPrefixUnaryExpression(node) &&
      node.operator === ts.SyntaxKind.MinusToken
    ) {
      return isConstant(node.operand);
    }
    return false;
  }
}

const ArithmeticOperators = [
  ts.SyntaxKind.PlusToken,
  ts.SyntaxKind.MinusToken,
  ts.SyntaxKind.AsteriskEqualsToken,
  ts.SyntaxKind.SlashToken,
] as const;

export type ArithmeticToken = typeof ArithmeticOperators[number];

/**
 * Check if a {@link token} is an {@link ArithmeticToken}: `+`, `-`, `*` or `/`.
 */
export function isArithmeticToken(
  token: ts.SyntaxKind
): token is ArithmeticToken {
  return ArithmeticOperators.includes(token as ArithmeticToken);
}
