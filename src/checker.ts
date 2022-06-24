import * as ts from "typescript";
import * as tsserver from "typescript/lib/tsserverlibrary";
import { ApiMethod, ApiMethodKind, isApiMethodKind } from "./api";
import { AppsyncField, AppsyncResolver } from "./appsync";
import { EventBus, Rule } from "./event-bridge";
import { EventTransform } from "./event-bridge/transform";
import { Function } from "./function";
import { ExpressStepFunction, StepFunction } from "./step-function";
import { Table } from "./table";

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

export type RuleInterface = ts.NewExpression & {
  arguments: [any, any, any, TsFunctionParameter];
};

export type EventTransformInterface = ts.NewExpression & {
  arguments: [TsFunctionParameter, any];
};

export type EventBusWhenInterface = ts.CallExpression & {
  arguments: [any, TsFunctionParameter] | [any, any, TsFunctionParameter];
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

export type NewStepFunctionInterface = ts.NewExpression & {
  arguments:
    | [ts.Expression, ts.Expression, TsFunctionParameter]
    | [ts.Expression, ts.Expression, ts.Expression, TsFunctionParameter];
};

export type NewAppsyncResolverInterface = ts.NewExpression & {
  arguments: [
    ts.Expression,
    ts.Expression,
    ts.Expression,
    // the inline function
    TsFunctionParameter
  ];
};

export type NewAppsyncFieldInterface = ts.NewExpression & {
  arguments: [
    ts.Expression,
    // the inline function
    TsFunctionParameter
  ];
};

export type FunctionlessChecker = ReturnType<typeof makeFunctionlessChecker>;

export function makeFunctionlessChecker(
  checker: ts.TypeChecker | tsserver.TypeChecker
) {
  return {
    ...checker,
    getApiMethodKind,
    getFunctionlessTypeKind,
    isApiIntegration,
    isAppsyncField,
    isAppsyncResolver,
    isCDKConstruct,
    isConstant,
    isEventBus,
    isEventBusWhenFunction,
    isFunctionlessFunction,
    isFunctionlessType,
    isIntegrationNode,
    isNewEventTransform,
    isNewFunctionlessFunction,
    isNewRule,
    isNewStepFunction,
    isPromiseArray,
    isPromiseAllCall,
    isPromiseSymbol,
    isReflectFunction,
    isRuleMapFunction,
    isStepFunction,
    isTable,
  };

  /**
   * Matches the patterns:
   *   * new Rule()
   */
  function isNewRule(node: ts.Node): node is RuleInterface {
    return ts.isNewExpression(node) && isRule(node.expression);
  }

  /**
   * Matches the patterns:
   *   * new EventTransform()
   */
  function isNewEventTransform(node: ts.Node): node is EventTransformInterface {
    return ts.isNewExpression(node) && isEventTransform(node.expression);
  }

  /**
   * Matches the patterns:
   *   * IEventBus.when
   *   * IRule.when
   */
  function isEventBusWhenFunction(
    node: ts.Node
  ): node is EventBusWhenInterface {
    return (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "when" &&
      (isEventBus(node.expression.expression) ||
        isRule(node.expression.expression))
    );
  }

  /**
   * Matches the patterns:
   *   * IRule.map()
   */
  function isRuleMapFunction(node: ts.Node): node is EventBusMapInterface {
    return (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "map" &&
      isRule(node.expression.expression)
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
   * Checks to see if a node is of type {@link Rule}.
   * The node could be any kind of node that returns an event bus rule.
   *
   * Matches the patterns:
   *   * IRule
   */
  function isRule(node: ts.Node) {
    return isFunctionlessClassOfKind(node, Rule.FunctionlessType);
  }

  /**
   * Checks to see if a node is of type {@link EventTransform}.
   * The node could be any kind of node that returns an event bus rule.
   *
   * Matches the patterns:
   *   * IEventTransform
   */
  function isEventTransform(node: ts.Node) {
    return isFunctionlessClassOfKind(node, EventTransform.FunctionlessType);
  }

  function isAppsyncResolver(
    node: ts.Node
  ): node is NewAppsyncResolverInterface {
    if (ts.isNewExpression(node)) {
      return isFunctionlessClassOfKind(
        node.expression,
        AppsyncResolver.FunctionlessType
      );
    }
    return false;
  }

  function isAppsyncField(node: ts.Node): node is NewAppsyncFieldInterface {
    if (ts.isNewExpression(node)) {
      return isFunctionlessClassOfKind(
        node.expression,
        AppsyncField.FunctionlessType
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

  function isTable(node: ts.Node) {
    return isFunctionlessClassOfKind(node, Table.FunctionlessType);
  }

  function isStepFunction(node: ts.Node) {
    return (
      isFunctionlessClassOfKind(node, StepFunction.FunctionlessType) ||
      isFunctionlessClassOfKind(node, ExpressStepFunction.FunctionlessType)
    );
  }

  function isNewStepFunction(node: ts.Node): node is NewStepFunctionInterface {
    if (ts.isNewExpression(node)) {
      return isStepFunction(node.expression);
    }
    return false;
  }

  function isFunctionlessFunction(node: ts.Node) {
    return isFunctionlessClassOfKind(node, Function.FunctionlessType);
  }

  function isNewFunctionlessFunction(node: ts.Node): node is FunctionInterface {
    return (
      ts.isNewExpression(node) &&
      isFunctionlessFunction(node.expression) &&
      // only take the form with the arrow function at the end.
      (node.arguments?.length === 3
        ? ts.isArrowFunction(node.arguments[2])
        : node.arguments?.length === 4
        ? ts.isArrowFunction(node.arguments[3])
        : false)
    );
  }

  function isApiIntegration(node: ts.Node): node is ts.NewExpression {
    return (
      ts.isNewExpression(node) &&
      isFunctionlessClassOfKind(node.expression, ApiMethod.FunctionlessType)
    );
  }

  function getApiMethodKind(node: ts.NewExpression): ApiMethodKind | undefined {
    if (isApiIntegration(node)) {
      const type = checker.getTypeAtLocation(node);
      const kind = type.getProperty("kind");
      if (kind) {
        const kindType = checker.getTypeOfSymbolAtLocation(kind, node);
        if (kindType.isStringLiteral()) {
          if (isApiMethodKind(kindType.value)) {
            return kindType.value;
          }
        }
      }
    }
    return undefined;
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
        checker
          .getBaseTypes(type as ts.InterfaceType)
          ?.some((t) => isCDKConstruct(t))) ??
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

  function getFunctionlessTypeKind(
    type: ts.Type
  ): ts.Type | string | undefined {
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
        } else {
          return type;
        }
      }
    }
    return undefined;
  }

  function typeMatch(
    type: ts.Type,
    predicate: (type: ts.Type) => boolean
  ): boolean {
    if (type.isUnionOrIntersection()) {
      return predicate(type) || type.types.some((t) => typeMatch(t, predicate));
    }
    return predicate(type);
  }

  function isPromiseSymbol(symbol: ts.Symbol): boolean {
    return checker.getFullyQualifiedName(symbol) === "Promise";
  }

  function isArraySymbol(symbol: ts.Symbol): boolean {
    return checker.getFullyQualifiedName(symbol) === "Array";
  }

  function isPromiseArray(type: ts.Type): boolean {
    const symbol = type.getSymbol();
    if (!symbol) {
      return false;
    }
    const typeParams = checker.getTypeArguments(type as ts.TypeReference);
    if (isArraySymbol(symbol) && typeParams?.length === 1) {
      const [param] = typeParams;
      // the type contains any type, union or intersection which is a Promise
      return typeMatch(param, (t) => {
        const symbol = t.getSymbol();
        return symbol ? isPromiseSymbol(symbol) : false;
      });
    }
    return false;
  }

  /**
   * Checks for typescript in the form `Promise.all(...)`
   */
  function isPromiseAllCall(node: ts.Node): boolean {
    return (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "all" &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === "Promise"
    );
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

  function isIntegrationNode(node: ts.Node): boolean {
    const exprType = checker.getTypeAtLocation(node);
    const exprKind = exprType.getProperty("kind");
    if (exprKind) {
      const exprKindType = checker.getTypeOfSymbolAtLocation(exprKind, node);
      return exprKindType.isStringLiteral();
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

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
