import { anyOf, hasParent } from "@functionless/ast";
import ts from "typescript";
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

export function makeFunctionlessChecker(checker: ts.TypeChecker) {
  return {
    ...checker,
    getApiMethodKind,
    getFunctionlessTypeKind,
    getIntegrationNodeKind,
    getOutOfScopeValueNode,
    isApiIntegration,
    isAppsyncField,
    isAppsyncResolver,
    isArraySymbol,
    isCDKConstruct,
    isConstant,
    isEventBus,
    isEventBusWhenFunction,
    isForInVariable,
    isFunctionlessFunction,
    isFunctionlessType,
    isIdentifierOutOfScope,
    isIdentifierVariableReference,
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
   * Flattens {@link ts.BindingElement} (destructured assignments) to a series of
   * {@link ts.ElementAccessExpression} or {@link ts.PropertyAccessExpression}
   *
   * Caveat: It is not possible to flatten a destructured ParameterDeclaration (({ a }) => {}).
   *         Use {@link getDestructuredDeclaration} to determine if the {@link ts.BindingElement} is
   *         {@link ts.VariableDeclaration} or a {@link ts.ParameterDeclaration}.
   *
   * given a
   *
   * { a } = b;
   * -> b.a;
   *
   * { x: a } = b;
   * -> b.x;
   *
   * { "x-x": a } = b;
   * b["x-x"];
   *
   * { b: { a } } = c;
   * -> c.b.a;
   *
   * [a] = l;
   * -> l[0];
   *
   * [{ a }] = l;
   * -> l[0].a;
   *
   * { a } = b.c;
   * -> b.c.a;
   *
   * { [key]: a } = b;
   * b[key];
   */
  function flattenBindingElement(
    element: ts.BindingElement
  ): ts.ElementAccessExpression | ts.PropertyAccessExpression {
    // if the binding renames the property, get the original
    // { a : x } -> a
    // { a } -> a
    // [a] -> 0
    const name = ts.isArrayBindingPattern(element.parent)
      ? element.pos
      : // binding renames the property or is a nested binding pattern.
      element.propertyName
      ? element.propertyName
      : // the "name" can be a binding pattern. In that case the propertyName will be set.
        (element.name as ts.Identifier);

    const getParent = () => {
      // { a } = b;
      if (ts.isVariableDeclaration(element.parent.parent)) {
        if (!element.parent.parent.initializer) {
          throw Error(
            "Expected a initializer on a destructured assignment: " +
              element.getText()
          );
        }
        return element.parent.parent.initializer;
      } else if (ts.isBindingElement(element.parent.parent)) {
        return flattenBindingElement(element.parent.parent);
      } else {
        throw Error(
          "Cannot flatten destructured parameter: " + element.getText()
        );
      }
    };

    const parent = getParent();

    // always use element access as this will work for all possible values.
    // [parent][name]
    return typeof name !== "number" && ts.isIdentifier(name)
      ? ts.factory.createPropertyAccessExpression(parent, name)
      : ts.factory.createElementAccessExpression(
          parent,
          typeof name !== "number" && ts.isComputedPropertyName(name)
            ? name.expression
            : name
        );
  }

  /**
   * Finds the top level declaration of a destructured binding element.
   * Supports arbitrary nesting.
   *
   * const { a } = b; -> VariableDeclaration { initializer = b }
   * const [a] = b; -> VariableDeclaration { initializer = b }
   * ({ a }) => {} -> ParameterDeclaration { { a } }
   * ([a]) => {} -> ParameterDeclaration { { a } }
   */
  function getDestructuredDeclaration(
    element: ts.BindingElement
  ): ts.VariableDeclaration | ts.ParameterDeclaration {
    if (ts.isBindingElement(element.parent.parent)) {
      return getDestructuredDeclaration(element.parent.parent);
    }
    return element.parent.parent;
  }

  /**
   * Attempts to find the a version of a reference that is outside of a certain scope.
   *
   * This is useful for finding variables that have been instantiated outside of a closure, but
   * renamed inside of the closure.
   *
   * When serializing the lambda functions, we want references from outside of the closure if possible.
   *
   * ```ts
   * const bus = new EventBus()
   * new Function(() => {
   *     const busbus = bus;
   *     busbus.putEvents(...)
   * })
   * ```
   *
   * Can also follow property access.
   *
   * ```ts
   * const x = { y : () => {} };
   *
   * () => {
   *    const z = x;
   *    z.y() // x.y() is returned
   * }
   * ```
   *
   * getOutOfScopeValueNode(z.y) => x.y
   *
   * ```ts
   * const x = () => {};
   *
   * () => {
   *    const z = { y: x };
   *    z.y()
   * }
   * ```
   *
   * getOutOfScopeValueNode(z.y) => x
   *
   * The call to busbus can be resolved to bus if the scope is the array function.
   */
  function getOutOfScopeValueNode(
    expression: ts.Expression,
    scope: ts.Node
  ): ts.Expression | undefined {
    const symbol = checker.getSymbolAtLocation(expression);
    if (symbol) {
      if (isSymbolOutOfScope(symbol, scope)) {
        return expression;
      } else {
        if (ts.isIdentifier(expression)) {
          if (symbol.valueDeclaration) {
            if (
              ts.isVariableDeclaration(symbol.valueDeclaration) &&
              symbol.valueDeclaration.initializer
            ) {
              return getOutOfScopeValueNode(
                symbol.valueDeclaration.initializer,
                scope
              );
            } else if (ts.isBindingElement(symbol.valueDeclaration)) {
              /* when we find an identifier that was created using a binding assignment
                      flatten it and run the flattened form through again.
                      const b = { a: 1 };
                      () => {
                        const c = b;
                        const { a } = c;
                      }
                      -> b["a"];
                    */
              const flattened = flattenBindingElement(symbol.valueDeclaration);
              return getOutOfScopeValueNode(flattened, scope);
            } else if (ts.isIdentifier(symbol.valueDeclaration)) {
              return symbol.valueDeclaration;
            } else if (ts.isParameter(symbol.valueDeclaration)) {
              /**
               * Cases like parameter
               *
               * (table) => {
               *    new StepFunction(async () => { return table.appsync.getItem(...) });
               * }
               */
              return ts.factory.createIdentifier(symbol.name);
            }
          }
        }
      }
    }
    if (
      ts.isPropertyAccessExpression(expression) ||
      ts.isElementAccessExpression(expression)
    ) {
      if (symbol && symbol.valueDeclaration) {
        if (
          ts.isPropertyAssignment(symbol.valueDeclaration) &&
          anyOf(
            ts.isIdentifier,
            ts.isPropertyAccessExpression,
            ts.isElementAccessExpression
          )(symbol.valueDeclaration.initializer)
        ) {
          // this variable is assigned to by another variable, follow that node
          return getOutOfScopeValueNode(
            symbol.valueDeclaration.initializer,
            scope
          );
        }
      }
      // this node is assigned a value, attempt to rewrite the parent
      const outOfScope = getOutOfScopeValueNode(expression.expression, scope);
      return outOfScope
        ? ts.isElementAccessExpression(expression)
          ? ts.factory.updateElementAccessExpression(
              expression,
              outOfScope,
              expression.argumentExpression
            )
          : ts.factory.updatePropertyAccessExpression(
              expression,
              outOfScope,
              expression.name
            )
        : undefined;
    }
    return undefined;
  }

  /**
   * Checks to see if a symbol is defined with the given scope.
   *
   * Any symbol that has no declaration or has a value declaration in the scope is considered to be in scope.
   * Imports are considered out of scope.
   *
   * ```ts
   * () => { // scope
   *  const x = "y";
   *  x // in scope
   * }
   * ```
   *
   * ```ts
   * const x = "y"; // out of scope
   * () => { // scope
   *  x // in scope
   * }
   * ```
   *
   * ```ts
   * import x from y;
   *
   * () => { // scope
   *  x // out of scope
   * }
   * ```
   *
   * ```ts
   * () => {
   *    const { x } = y;
   *    x // in scope
   * }
   * ```
   *
   * ```ts
   * ({ x }) => {
   *    x // in scope
   * }
   * ```
   */
  function isSymbolOutOfScope(symbol: ts.Symbol, scope: ts.Node): boolean {
    if (symbol.valueDeclaration) {
      if (ts.isShorthandPropertyAssignment(symbol.valueDeclaration)) {
        const updatedSymbol = checker.getShorthandAssignmentValueSymbol(
          symbol.valueDeclaration
        );
        return updatedSymbol ? isSymbolOutOfScope(updatedSymbol, scope) : false;
      } else if (
        ts.isVariableDeclaration(symbol.valueDeclaration) ||
        ts.isClassDeclaration(symbol.valueDeclaration) ||
        ts.isParameter(symbol.valueDeclaration)
      ) {
        return !hasParent(symbol.valueDeclaration, scope);
      } else if (ts.isBindingElement(symbol.valueDeclaration)) {
        /*
          check if the binding element's declaration is within the scope or not.

          example: if the scope ifq func's body

          ({ a }) => {
            const { b } = a;
            const func = ({ c }) => {
              const { d: { x, y } } = b;
            }
          }

          // in scope: c, x, y
          // out of scope: a, b
        */
        const declaration = getDestructuredDeclaration(symbol.valueDeclaration);
        return !hasParent(declaration, scope);
      } else if (
        ts.isPropertyDeclaration(symbol.valueDeclaration) ||
        ts.isPropertySignature(symbol.valueDeclaration)
      ) {
        // explicit return false. We always want to check the parent of the declaration or signature.
        return false;
      }
    } else if (symbol.declarations?.[0]) {
      const [decl] = symbol.declarations;
      // import x from y
      if (
        ts.isImportClause(decl) ||
        ts.isImportSpecifier(decl) ||
        ts.isNamespaceImport(decl)
      ) {
        return true;
      }
    }
    return false;
  }

  /**
   * Checks if the {@link id} is a reference to a variable or a name as part of another structure.
   *
   * ```ts
   * const a;
   *    // ^ a name within a VariableDeclaration
   * const { a }
   *      // ^ a name within a BindingElement
   * const { a: b }
   *         // ^ propertyName within a BindingElement
   * const { a : b = c }
   *              // ^ this is a reference to a variable
   * const [ a ];
   *      // ^ a name within a BindingElement
   * const [ a = b ]
   *          // ^ a reference to a variable
   *
   * reference;
   * // ^ a reference to a variable
   *
   * reference.name;
   *         // ^ a name within a PropertyAccessExpression
   *
   * class A
   *       ^F
   * function foo() {}
   *           ^F
   * interface foo {}
   *            ^F
   * type A
   *      ^F
   * ```
   * @param id the identifier node
   */
  function isIdentifierVariableReference(id: ts.Identifier) {
    if (ts.isBindingElement(id.parent)) {
      // { a: b = c }
      //   ^F ^F  ^T
      return id.parent.initializer === id;
    } else if (ts.isParameter(id.parent)) {
      // function foo(a = b)
      //              ^F  ^T
      return id.parent.initializer === id;
    } else if (ts.isVariableDeclaration(id.parent)) {
      // const a = b;
      //       ^F  ^T
      return id.parent.initializer === id;
    } else if (ts.isPropertyAccessExpression(id.parent)) {
      // event.bus
      // ^T    ^F
      return id.parent.expression === id;
    } else if (
      ts.isClassDeclaration(id.parent) ||
      ts.isClassExpression(id.parent) ||
      ts.isFunctionDeclaration(id.parent) ||
      ts.isFunctionExpression(id.parent) ||
      ts.isInterfaceDeclaration(id.parent) ||
      ts.isTypeAliasDeclaration(id.parent)
    ) {
      // class A
      //       ^F

      // function foo() {}
      //          ^F

      // interface foo {}
      //           ^F

      // type A
      //      ^F
      return id.parent.name !== id;
    } else if (ts.isTypeReferenceNode(id.parent)) {
      // foo<T>
      //     ^F
      return false;
    }

    return true;
  }

  /**
   * Determines if an identifier is out of scope.
   *
   * Returns false if the symbol isn't found or if it is a in a type reference.
   */
  function isIdentifierOutOfScope(node: ts.Identifier, scope: ts.Node) {
    if (!isIdentifierVariableReference(node)) {
      // not a variable reference
      return false;
    }
    const symbol = checker.getSymbolAtLocation(node);
    return (
      !ts.isTypeReferenceNode(node.parent) &&
      symbol &&
      isSymbolOutOfScope(symbol, scope)
    );
  }

  // findParent(node, ts.isForInStatement)
  function isForInVariable(node: ts.Identifier) {
    const symbol = checker.getSymbolAtLocation(node);
    if (symbol) {
      return (
        symbol.valueDeclaration &&
        ts.isVariableDeclaration(symbol.valueDeclaration) &&
        ts.isVariableDeclarationList(symbol.valueDeclaration.parent) &&
        ts.isForInStatement(symbol?.valueDeclaration.parent.parent)
      );
    }
    return false;
  }

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
        return exprDecl.name?.text === "reflect";
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
        ? ts.isArrowFunction(node.arguments[2]!)
        : node.arguments?.length === 4
        ? ts.isArrowFunction(node.arguments[3]!)
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
    if (isArraySymbol(symbol) && typeParams?.[0]) {
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
      ts.isTemplateHead(node) ||
      ts.isTemplateMiddle(node) ||
      ts.isTemplateTail(node) ||
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
          ts.SymbolFlags.Variable
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
      isBinaryArithmeticToken(node.operatorToken.kind)
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

  function getIntegrationNodeKind(node: ts.Node): string | undefined {
    const exprType = checker.getTypeAtLocation(node);
    const exprKind = exprType.getProperty("kind");
    if (exprKind) {
      const exprKindType = checker.getTypeOfSymbolAtLocation(exprKind, node);
      if (exprKindType.isStringLiteral()) {
        return exprKindType.value;
      }
    }
    return undefined;
  }

  function isIntegrationNode(node: ts.Node): boolean {
    if (ts.isIdentifier(node) && !isIdentifierVariableReference(node)) {
      // this identifier does not point to a value
      return false;
    }
    const exprType = checker.getTypeAtLocation(node);
    const exprKind = exprType.getProperty("kind");
    if (exprKind) {
      const exprKindType = checker.getTypeOfSymbolAtLocation(exprKind, node);
      return exprKindType.isStringLiteral();
    }
    return false;
  }
}

const BinaryArithmeticOperators = [
  ts.SyntaxKind.PlusToken, // +
  ts.SyntaxKind.MinusToken, // -
  ts.SyntaxKind.AsteriskToken, // *
  ts.SyntaxKind.SlashToken, // /
  ts.SyntaxKind.PercentToken, // %
  ts.SyntaxKind.PlusEqualsToken, // +=
  ts.SyntaxKind.MinusEqualsToken, // -=
  ts.SyntaxKind.AsteriskEqualsToken, // *=
  ts.SyntaxKind.SlashEqualsToken, // /=
  ts.SyntaxKind.PercentEqualsToken, // %=
] as const;

const UnaryArithmeticOperators = [
  ts.SyntaxKind.PlusToken, // +
  ts.SyntaxKind.MinusToken, // -
  ts.SyntaxKind.AsteriskAsteriskToken, // **
  ts.SyntaxKind.MinusMinusToken, // --
  ts.SyntaxKind.PlusPlusToken, // ++
] as const;

export type BinaryArithmeticToken = typeof BinaryArithmeticOperators[number];
export type UnaryArithmeticToken = typeof UnaryArithmeticOperators[number];

/**
 * Check if a {@link token} is an {@link BinaryArithmeticToken}: `+`, `-`, `*` or `/`.
 */
export function isBinaryArithmeticToken(
  token: ts.SyntaxKind
): token is BinaryArithmeticToken {
  return BinaryArithmeticOperators.includes(token as BinaryArithmeticToken);
}

/**
 * Check if a {@link token} is an {@link UnaryArithmeticToken}: `++`, `--`, or `**`.
 */
export function isUnaryArithmeticToken(
  token: ts.SyntaxKind
): token is UnaryArithmeticToken {
  return UnaryArithmeticOperators.includes(token as UnaryArithmeticToken);
}

/**
 * Invokes a predicate on the ancestors of the given node until:
 * * the predicate is true
 * * there is no parent
 * * or the limit parameter is hit
 *
 * @param limit - An upper bound node to stop processing at.
 */
export function findParent<T extends ts.Node>(
  node: ts.Node,
  predicate: (node: ts.Node) => node is T,
  limit?: ts.Node
): T | undefined {
  if (!node.parent || (limit && limit === node.parent)) {
    return undefined;
  } else if (predicate(node.parent)) {
    return node.parent;
  } else {
    return findParent(node.parent, predicate);
  }
}

/**
 * Visits all types in union or intersection types with a predicate.
 */
export function typeMatch(
  type: ts.Type,
  predicate: (type: ts.Type) => boolean
): boolean {
  if (type.isUnionOrIntersection()) {
    return predicate(type) || type.types.some((t) => typeMatch(t, predicate));
  }
  return predicate(type);
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
