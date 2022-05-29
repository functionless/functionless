import * as ts from "typescript";
import * as tsserver from "typescript/lib/tsserverlibrary";
import { AppsyncResolver } from "./appsync";
import { EventBus, Rule } from "./event-bridge";
import { EventTransform } from "./event-bridge/transform";
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

export type FunctionlessChecker = ReturnType<typeof makeFunctionlessChecker>;

export function makeFunctionlessChecker(
  checker: ts.TypeChecker | tsserver.TypeChecker
) {
  return {
    ...checker,
    isAppsyncResolver,
    isEventBusRuleMapFunction,
    isEventBusWhenFunction,
    isFunctionlessType,
    isNewEventBusRule,
    isNewEventBusTransform,
    isReflectFunction,
    isStepFunction,
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
    return isFunctionlessClassOfKind(node, Rule.FunctionlessType);
  }

  /**
   * Checks to see if a node is of type {@link EventBusTransform}.
   * The node could be any kind of node that returns an event bus rule.
   *
   * Matches the patterns:
   *   * IEventBusTransform
   */
  function isEventBusTransform(node: ts.Node) {
    return isFunctionlessClassOfKind(node, EventTransform.FunctionlessType);
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
}
