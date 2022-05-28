import ts from "typescript";
import path from "path";
import { PluginConfig, TransformerExtras } from "ts-patch";
import { BinaryOp } from "./expression";
import { FunctionlessNode } from "./node";
import { AppsyncResolver } from "./appsync";
import { assertDefined } from "./assert";
import { StepFunction, ExpressStepFunction } from "./step-function";
import { anyOf, hasParent } from "./util";
import minimatch from "minimatch";
import { EventBus, EventBusRule } from "./event-bridge";
import { EventBusTransform } from "./event-bridge/transform";
import { Function } from "./function";

export default compile;

/**
 * Configuration options for the functionless TS transform.
 */
export interface FunctionlessConfig extends PluginConfig {
  /**
   * Glob to exclude
   */
  exclude?: string[];
}

/**
 * TypeScript Transformer which transforms functionless functions, such as `AppsyncResolver`,
 * into an AST that can be interpreted at CDK synth time to produce VTL templates and AppSync
 * Resolver configurations.
 *
 * @param program the TypeScript {@link ts.Program}
 * @param config the {@link FunctionlessConfig}.
 * @param _extras
 * @returns the transformer
 */
export function compile(
  program: ts.Program,
  _config?: FunctionlessConfig,
  _extras?: TransformerExtras
): ts.TransformerFactory<ts.SourceFile> {
  const excludeMatchers = _config?.exclude
    ? _config.exclude.map((pattern) => minimatch.makeRe(path.resolve(pattern)))
    : [];
  const checker = program.getTypeChecker();
  return (ctx) => {
    const functionless = ts.factory.createUniqueName("functionless");
    return (sf) => {
      // Do not transform any of the files matched by "exclude"
      if (excludeMatchers.some((matcher) => matcher.test(sf.fileName))) {
        return sf;
      }

      const functionlessContext = {
        requireFunctionless: false,
        get functionless() {
          this.requireFunctionless = true;
          return functionless;
        },
      };

      const functionlessImport = ts.factory.createImportDeclaration(
        undefined,
        undefined,
        ts.factory.createImportClause(
          false,
          undefined,
          ts.factory.createNamespaceImport(functionless)
        ),
        ts.factory.createStringLiteral("functionless")
      );

      const statements = sf.statements.map(
        (stmt) => visitor(stmt) as ts.Statement
      );

      return ts.factory.updateSourceFile(
        sf,
        [
          // only require functionless if it is used.
          ...(functionlessContext.requireFunctionless
            ? [functionlessImport]
            : []),
          ...statements,
        ],
        sf.isDeclarationFile,
        sf.referencedFiles,
        sf.typeReferenceDirectives,
        sf.hasNoDefaultLib,
        sf.libReferenceDirectives
      );

      function visitor(node: ts.Node): ts.Node | ts.Node[] {
        const visit = () => {
          if (isAppsyncResolver(node)) {
            return visitAppsyncResolver(node as ts.NewExpression);
          } else if (isStepFunction(node)) {
            return visitStepFunction(node as ts.NewExpression);
          } else if (isReflectFunction(node)) {
            return errorBoundary(() =>
              toFunction("FunctionDecl", node.arguments[0])
            );
          } else if (isEventBusWhenFunction(node)) {
            return visitEventBusWhen(node);
          } else if (isEventBusRuleMapFunction(node)) {
            return visitEventBusMap(node);
          } else if (isNewEventBusRule(node)) {
            return visitEventBusRule(node);
          } else if (isNewEventBusTransform(node)) {
            return visitEventTransform(node);
          } else if (isNewFunctionlessFunction(node)) {
            return visitFunction(node, ctx);
          }
          return node;
        };
        // keep processing the children of the updated node.
        return ts.visitEachChild(visit(), visitor, ctx);
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

      function isStepFunction(node: ts.Node): node is ts.NewExpression & {
        arguments: [TsFunctionParameter, ...ts.Expression[]];
      } {
        if (ts.isNewExpression(node)) {
          return (
            isFunctionlessClassOfKind(node, StepFunction.FunctionlessType) ||
            isFunctionlessClassOfKind(
              node,
              ExpressStepFunction.FunctionlessType
            )
          );
        }
        return false;
      }

      /**
       * Various types that could be in a call argument position of a function parameter.
       */
      type TsFunctionParameter =
        | ts.FunctionExpression
        | ts.ArrowFunction
        | ts.Identifier
        | ts.PropertyAccessExpression
        | ts.ElementAccessExpression
        | ts.CallExpression;

      type EventBusRuleInterface = ts.NewExpression & {
        arguments: [
          ts.Expression,
          ts.Expression,
          ts.Expression,
          TsFunctionParameter
        ];
      };

      type EventBusTransformInterface = ts.NewExpression & {
        arguments: [TsFunctionParameter, ts.Expression];
      };

      type EventBusWhenInterface = ts.CallExpression & {
        arguments: [ts.Expression, ts.Expression, TsFunctionParameter];
      };

      type EventBusMapInterface = ts.CallExpression & {
        arguments: [TsFunctionParameter];
      };

      type FunctionInterface = ts.NewExpression & {
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
        return isFunctionlessClassOfKind(
          node,
          EventBusTransform.FunctionlessType
        );
      }

      function isNewFunctionlessFunction(
        node: ts.Node
      ): node is FunctionInterface {
        return (
          ts.isNewExpression(node) &&
          isFunctionlessClassOfKind(
            node.expression,
            Function.FunctionlessType
          ) &&
          // only take the form with the arrow function at the end.
          (node.arguments?.length === 3
            ? ts.isArrowFunction(node.arguments[2])
            : node.arguments?.length === 4
            ? ts.isArrowFunction(node.arguments[3])
            : false)
        );
      }

      /**
       * Heuristically evaluate the fqn of a symbol to be in a module and of a type name.
       *
       * /somePath/node_modules/{module}/somePath.{typeName}
       *
       * isInstanceOf(typeSymbol, "constructs", "Construct")
       * ex: /home/sussmans/functionless/node_modules/constructs/lib/index.js
       */
      function isInstanceOf(
        symbol: ts.Symbol,
        module: string,
        typeName: string
      ) {
        const find = /.*\/node_modules\/([^\/]*)\/.*\.(.*)$/g.exec(
          checker.getFullyQualifiedName(symbol)
        );

        const [_, mod, type] = find ?? [];

        return mod === module && type === typeName;
      }

      function isCDKConstruct(type: ts.Type): boolean {
        const typeSymbol = type.getSymbol();

        return (
          ((typeSymbol &&
            isInstanceOf(typeSymbol, "constructs", "Construct")) ||
            type.getBaseTypes()?.some((t) => isCDKConstruct(t))) ??
          false
        );
      }

      /**
       * Catches any errors and wraps them in a {@link Err} node.
       */
      function errorBoundary<T extends ts.Node>(
        func: () => T
      ): T | ts.NewExpression {
        try {
          return func();
        } catch (err) {
          const error =
            err instanceof Error ? err : Error("Unknown compiler error.");
          return newExpr("Err", [
            ts.factory.createNewExpression(
              ts.factory.createIdentifier(error.name),
              undefined,
              [ts.factory.createStringLiteral(error.message)]
            ),
          ]);
        }
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

      function visitStepFunction(call: ts.NewExpression): ts.Node {
        return ts.factory.updateNewExpression(
          call,
          call.expression,
          call.typeArguments,
          call.arguments?.map((arg) =>
            ts.isFunctionExpression(arg) || ts.isArrowFunction(arg)
              ? errorBoundary(() => toFunction("FunctionDecl", arg))
              : arg
          )
        );
      }

      function visitEventBusRule(call: EventBusRuleInterface): ts.Node {
        const [one, two, three, impl] = call.arguments;

        return ts.factory.updateNewExpression(
          call,
          call.expression,
          call.typeArguments,
          [
            one,
            two,
            three,
            errorBoundary(() => toFunction("FunctionDecl", impl)),
          ]
        );
      }

      function visitEventTransform(call: EventBusTransformInterface): ts.Node {
        const [impl, ...rest] = call.arguments;

        return ts.factory.updateNewExpression(
          call,
          call.expression,
          call.typeArguments,
          [errorBoundary(() => toFunction("FunctionDecl", impl)), ...rest]
        );
      }

      function visitEventBusWhen(call: EventBusWhenInterface): ts.Node {
        const [one, two, impl] = call.arguments;

        return ts.factory.updateCallExpression(
          call,
          call.expression,
          call.typeArguments,
          [one, two, errorBoundary(() => toFunction("FunctionDecl", impl))]
        );
      }

      function visitEventBusMap(call: EventBusMapInterface): ts.Node {
        const [impl] = call.arguments;

        return ts.factory.updateCallExpression(
          call,
          call.expression,
          call.typeArguments,
          [errorBoundary(() => toFunction("FunctionDecl", impl))]
        );
      }

      function visitAppsyncResolver(call: ts.NewExpression): ts.Node {
        if (call.arguments?.length === 1) {
          const impl = call.arguments[0];
          if (ts.isFunctionExpression(impl) || ts.isArrowFunction(impl)) {
            return ts.factory.updateNewExpression(
              call,
              call.expression,
              call.typeArguments,
              [errorBoundary(() => toFunction("FunctionDecl", impl, 1))]
            );
          }
        }
        return call;
      }

      function visitFunction(
        func: FunctionInterface,
        context: ts.TransformationContext
      ): ts.Node {
        const [_one, _two, _three, funcDecl] =
          func.arguments.length === 4
            ? func.arguments
            : [
                func.arguments[0],
                func.arguments[1],
                undefined,
                func.arguments[2],
              ];

        return ts.factory.updateNewExpression(
          func,
          func.expression,
          func.typeArguments,
          [
            _one,
            _two,
            ...(_three ? [_three] : []),
            errorBoundary(() => toNativeFunction(funcDecl, context)),
          ]
        );
      }

      interface NativeExprContext {
        preWarmContext: ts.Identifier;
        closureNode: TsFunctionParameter;
        /**
         * Register an {@link IntegrationInvocation} found when processing a native closure.
         *
         * @param node - should be an {@link Integration}
         * @param args - should be an array of {@link Argument}
         */
        registerIntegration: (
          node: ts.Expression,
          args: ts.ArrayLiteralExpression
        ) => void;
      }

      /**
       * A native function prepares a closure to be serialized,
       * transforms functionless {@link Integrations} to be invoked at runtime,
       * and extracts information needed to synthesize the Stack.
       *
       * Native Functions do not allow the creation of resources, CDK constructs or functionless.
       *
       * 1. Extracts functionless {@link Integrations} from the closure
       * 2. Wraps the closure in another arrow function which accepts a {@link NativePrewarmContext}.
       *    1. During synthesize (ex:, in a lambda {@link Function}) a prewarm context is generated
       *       and fed into the outer, generated closure.
       *    2. The {@link NativePreWarmContext} is a client/object cache which can be used to run once
       *       before the first invocation of a lambda function.
       * 3. Rewrites all of the integrations to invoke `await integration.native.call(args)` instead of `integration(args)`
       *    Also tries to simplify integration references to be outside of the closure.
       *    This reduces the amount of code and data that @functionless/nodejs-closure-serializer (a Pulumi closure serializer fork)
       *    tries to serialize during synthesis.
       * 4. Returns the {@link ParameterDecl}s for the closure
       *
       * @see Function for an example of how this is used.
       *
       * Input
       *
       * ```ts
       * const bus = new EventBus() // an example of an Integration, could be any Integration
       *
       * (arg1: string) => {
       *    bus({ source: "src" })
       * }
       * ```
       *
       * Output
       *
       * ```ts
       * const bus = new EventBus()
       * new NativeFunctionDecl(
       *     [new ParameterDecl("arg1")], // parameters
       *     (prewarmContext: NativePreWarmContext) =>
       *        (arg1: string) => {
       *            // call can make use of the cached clients in prewarmContext to avoid duplicate inline effect
       *            await bus.native.call(prewarmContext, { source: "src" });
       *        },
       *     [bus] // integrations
       * );
       * ```
       */
      function toNativeFunction(
        impl: TsFunctionParameter,
        context: ts.TransformationContext
      ): ts.NewExpression {
        if (
          !ts.isFunctionDeclaration(impl) &&
          !ts.isArrowFunction(impl) &&
          !ts.isFunctionExpression(impl)
        ) {
          throw new Error(
            `Functionless reflection only supports function parameters with bodies, no signature only declarations or references. Found ${impl.getText()}.`
          );
        }

        if (impl.body === undefined) {
          throw new Error(
            `cannot parse declaration-only function: ${impl.getText()}`
          );
        }

        // collection of integrations that are extracted from the closure
        const integrations: {
          expr: ts.Expression;
          args: ts.ArrayLiteralExpression;
        }[] = [];

        // a reference to a client/object cache which the integrations can use
        const preWarmContext =
          context.factory.createUniqueName("preWarmContext");

        // Context object which is available when transforming the tree
        const nativeExprContext: NativeExprContext = {
          // a reference to a prewarm context that will be passed into the closure during synthesis/runtime
          preWarmContext,
          // the closure node used to determine if variables are inside or outside of the closure
          closureNode: impl,
          // pass up integrations from inside of the closure
          registerIntegration: (integ, args) =>
            integrations.push({ expr: integ, args }),
        };

        const body = toNativeExpr(
          impl.body,
          context,
          nativeExprContext
        ) as ts.ConciseBody;

        // rebuilt the closure with the updated body
        const closure = ts.factory.createArrowFunction(
          impl.modifiers,
          impl.typeParameters,
          impl.parameters,
          impl.type,
          undefined,
          body
        );

        return newExpr("NativeFunctionDecl", [
          ts.factory.createArrayLiteralExpression(
            impl.parameters
              .map((param) => param.name.getText())
              .map((arg) =>
                newExpr("ParameterDecl", [ts.factory.createStringLiteral(arg)])
              )
          ),
          // (prewarmContext) => closure;
          context.factory.createArrowFunction(
            undefined,
            undefined,
            [
              context.factory.createParameterDeclaration(
                undefined,
                undefined,
                undefined,
                preWarmContext,
                undefined,
                undefined,
                undefined
              ),
            ],
            undefined,
            undefined,
            closure
          ),
          context.factory.createArrayLiteralExpression(
            integrations.map(({ expr, args }) =>
              context.factory.createObjectLiteralExpression([
                context.factory.createPropertyAssignment("integration", expr),
                context.factory.createPropertyAssignment("args", args),
              ])
            )
          ),
        ]);
      }

      function toNativeExpr(
        node: ts.Node,
        context: ts.TransformationContext,
        nativeExprContext: NativeExprContext
      ): ts.Node | undefined {
        if (ts.isCallExpression(node)) {
          // Integration nodes have a static "kind" property.
          if (isIntegrationNode(node.expression)) {
            const outOfScopeIntegrationReference = getOutOfScopeValueNode(
              node.expression,
              nativeExprContext.closureNode
            );

            if (!outOfScopeIntegrationReference) {
              // integration variables can be CDK constructs which will fail serialization.
              throw Error(
                "Integration Variable must be defined out of scope: " +
                  node.expression.getText()
              );
            }

            // add the function identifier to the integrations
            nativeExprContext.registerIntegration(
              outOfScopeIntegrationReference,
              // try to capture the arguments into the integration to use during synth (integration.native.bind).
              context.factory.createArrayLiteralExpression(
                node.arguments.map((arg) => {
                  return toExpr(arg, nativeExprContext.closureNode);
                })
              )
            );
            // call the integration call function with the prewarm context and arguments
            // At this point, we know native will not be undefined
            // await integration.native.call(args, preWarmContext)
            // TODO: Support both sync and async function invocations: https://github.com/sam-goodwin/functionless/issues/105

            return context.factory.createAwaitExpression(
              context.factory.createCallExpression(
                context.factory.createPropertyAccessExpression(
                  context.factory.createPropertyAccessExpression(
                    node.expression,
                    "native"
                  ),
                  "call"
                ),
                undefined,
                [
                  context.factory.createArrayLiteralExpression(node.arguments),
                  nativeExprContext.preWarmContext,
                ]
              )
            );
          }
        } else if (ts.isNewExpression(node)) {
          const newType = checker.getTypeAtLocation(node);
          // cannot create new resources in native runtime code.
          const functionlessKind = getFunctionlessTypeKind(newType);
          if (getFunctionlessTypeKind(newType)) {
            throw Error(
              `Cannot initialize new resources in a native function, found ${functionlessKind}.`
            );
          } else if (isCDKConstruct(newType)) {
            throw Error(
              `Cannot initialize new CDK resources in a native function, found ${
                newType.getSymbol()?.name
              }.`
            );
          }
        }

        // let everything else fall through, process their children too
        return ts.visitEachChild(
          node,
          (node) => toNativeExpr(node, context, nativeExprContext),
          context
        );
      }

      function toFunction(
        type: "FunctionDecl" | "FunctionExpr",
        impl: TsFunctionParameter,
        dropArgs?: number
      ): ts.Expression {
        if (
          !ts.isFunctionDeclaration(impl) &&
          !ts.isArrowFunction(impl) &&
          !ts.isFunctionExpression(impl)
        ) {
          throw new Error(
            `Functionless reflection only supports function parameters with bodies, no signature only declarations or references. Found ${impl.getText()}.`
          );
        }

        const params =
          dropArgs === undefined
            ? impl.parameters
            : impl.parameters.slice(dropArgs);

        if (impl.body === undefined) {
          throw new Error(
            `cannot parse declaration-only function: ${impl.getText()}`
          );
        }
        const body = ts.isBlock(impl.body)
          ? toExpr(impl.body, impl)
          : newExpr("BlockStmt", [
              ts.factory.createArrayLiteralExpression([
                newExpr("ReturnStmt", [toExpr(impl.body, impl)]),
              ]),
            ]);

        return newExpr(type, [
          ts.factory.createArrayLiteralExpression(
            params
              .map((param) => param.name.getText())
              .map((arg) =>
                newExpr("ParameterDecl", [ts.factory.createStringLiteral(arg)])
              )
          ),
          body,
        ]);
      }

      function toExpr(
        node: ts.Node | undefined,
        scope: ts.Node
      ): ts.Expression {
        if (node === undefined) {
          return ts.factory.createIdentifier("undefined");
        } else if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
          return toFunction("FunctionExpr", node);
        } else if (ts.isExpressionStatement(node)) {
          return newExpr("ExprStmt", [toExpr(node.expression, scope)]);
        } else if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
          const exprType = checker.getTypeAtLocation(node.expression);
          const functionBrand = exprType.getProperty("__functionBrand");
          let signature: ts.Signature | undefined;
          if (functionBrand !== undefined) {
            const functionType = checker.getTypeOfSymbolAtLocation(
              functionBrand,
              node.expression
            );
            const signatures = checker.getSignaturesOfType(
              functionType,
              ts.SignatureKind.Call
            );

            if (signatures.length === 1) {
              signature = signatures[0];
            } else {
              throw new Error(
                `Lambda Functions with multiple signatures are not currently supported.`
              );
            }
          } else {
            signature = checker.getResolvedSignature(node);
          }
          if (signature && signature.parameters.length > 0) {
            return newExpr(ts.isCallExpression(node) ? "CallExpr" : "NewExpr", [
              toExpr(node.expression, scope),
              ts.factory.createArrayLiteralExpression(
                signature.parameters.map((parameter, i) =>
                  newExpr("Argument", [
                    (parameter.declarations?.[0] as ts.ParameterDeclaration)
                      ?.dotDotDotToken
                      ? newExpr("ArrayLiteralExpr", [
                          ts.factory.createArrayLiteralExpression(
                            node.arguments
                              ?.slice(i)
                              .map((x) => toExpr(x, scope)) ?? []
                          ),
                        ])
                      : toExpr(node.arguments?.[i], scope),
                    ts.factory.createStringLiteral(parameter.name),
                  ])
                )
              ),
            ]);
          } else {
            return newExpr("CallExpr", [
              toExpr(node.expression, scope),
              ts.factory.createArrayLiteralExpression(
                node.arguments?.map((arg) =>
                  newExpr("Argument", [
                    toExpr(arg, scope),
                    ts.factory.createIdentifier("undefined"),
                  ])
                ) ?? []
              ),
            ]);
          }
        } else if (ts.isBlock(node)) {
          return newExpr("BlockStmt", [
            ts.factory.createArrayLiteralExpression(
              node.statements.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (ts.isIdentifier(node)) {
          if (node.text === "undefined") {
            return newExpr("UndefinedLiteralExpr", []);
          } else if (node.text === "null") {
            return newExpr("NullLiteralExpr", []);
          }
          if (isIntegrationNode(node)) {
            // if this is a reference to a Table or Lambda, retain it
            return ref(node);
          }

          const symbol = checker.getSymbolAtLocation(node);
          /**
           * If the identifier is not within the closure, we attempt to enclose the reference in its own closure.
           * const val = "hello";
           * reflect(() => return { value: val }; );
           *
           * result
           *
           * return { value: () => val };
           */
          if (symbol) {
            const ref = outOfScopeIdentifierToRef(symbol, scope);
            if (ref) {
              return ref;
            }
          }

          return newExpr("Identifier", [
            ts.factory.createStringLiteral(node.text),
          ]);
        } else if (ts.isPropertyAccessExpression(node)) {
          if (isIntegrationNode(node)) {
            // if this is a reference to a Table or Lambda, retain it
            return ref(node);
          }
          const type = checker.getTypeAtLocation(node.name);
          return newExpr("PropAccessExpr", [
            toExpr(node.expression, scope),
            ts.factory.createStringLiteral(node.name.text),
            type
              ? ts.factory.createStringLiteral(checker.typeToString(type))
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isElementAccessExpression(node)) {
          const type = checker.getTypeAtLocation(node.argumentExpression);
          return newExpr("ElementAccessExpr", [
            toExpr(node.expression, scope),
            toExpr(node.argumentExpression, scope),
            type
              ? ts.factory.createStringLiteral(checker.typeToString(type))
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (
          ts.isVariableStatement(node) &&
          node.declarationList.declarations.length === 1
        ) {
          return toExpr(node.declarationList.declarations[0], scope);
        } else if (ts.isVariableDeclaration(node)) {
          return newExpr("VariableStmt", [
            ts.factory.createStringLiteral(node.name.getText()),
            ...(node.initializer ? [toExpr(node.initializer, scope)] : []),
          ]);
        } else if (ts.isIfStatement(node)) {
          return newExpr("IfStmt", [
            // when
            toExpr(node.expression, scope),
            // then
            toExpr(node.thenStatement, scope),
            // else
            ...(node.elseStatement ? [toExpr(node.elseStatement, scope)] : []),
          ]);
        } else if (ts.isConditionalExpression(node)) {
          return newExpr("ConditionExpr", [
            // when
            toExpr(node.condition, scope),
            // then
            toExpr(node.whenTrue, scope),
            // else
            toExpr(node.whenFalse, scope),
          ]);
        } else if (ts.isBinaryExpression(node)) {
          const op = getOperator(node.operatorToken);
          if (op === undefined) {
            throw new Error(
              `invalid Binary Operator: ${node.operatorToken.getText()}`
            );
          }
          return newExpr("BinaryExpr", [
            toExpr(node.left, scope),
            ts.factory.createStringLiteral(op),
            toExpr(node.right, scope),
          ]);
        } else if (ts.isPrefixUnaryExpression(node)) {
          if (
            node.operator !== ts.SyntaxKind.ExclamationToken &&
            node.operator !== ts.SyntaxKind.MinusToken
          ) {
            throw new Error(
              `invalid Unary Operator: ${ts.tokenToString(node.operator)}`
            );
          }
          return newExpr("UnaryExpr", [
            ts.factory.createStringLiteral(
              assertDefined(
                ts.tokenToString(node.operator),
                `Unary operator token cannot be stringified: ${node.operator}`
              )
            ),
            toExpr(node.operand, scope),
          ]);
        } else if (ts.isReturnStatement(node)) {
          return newExpr(
            "ReturnStmt",
            node.expression
              ? [toExpr(node.expression, scope)]
              : [newExpr("NullLiteralExpr", [])]
          );
        } else if (ts.isObjectLiteralExpression(node)) {
          return newExpr("ObjectLiteralExpr", [
            ts.factory.createArrayLiteralExpression(
              node.properties.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (ts.isPropertyAssignment(node)) {
          return newExpr("PropAssignExpr", [
            ts.isStringLiteral(node.name) || ts.isIdentifier(node.name)
              ? string(node.name.text)
              : toExpr(node.name, scope),
            toExpr(node.initializer, scope),
          ]);
        } else if (ts.isComputedPropertyName(node)) {
          return newExpr("ComputedPropertyNameExpr", [
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isShorthandPropertyAssignment(node)) {
          return newExpr("PropAssignExpr", [
            newExpr("Identifier", [
              ts.factory.createStringLiteral(node.name.text),
            ]),
            toExpr(node.name, scope),
          ]);
        } else if (ts.isSpreadAssignment(node)) {
          return newExpr("SpreadAssignExpr", [toExpr(node.expression, scope)]);
        } else if (ts.isSpreadElement(node)) {
          return newExpr("SpreadElementExpr", [toExpr(node.expression, scope)]);
        } else if (ts.isArrayLiteralExpression(node)) {
          return newExpr("ArrayLiteralExpr", [
            ts.factory.updateArrayLiteralExpression(
              node,
              node.elements.map((x) => toExpr(x, scope))
            ),
          ]);
        } else if (node.kind === ts.SyntaxKind.NullKeyword) {
          return newExpr("NullLiteralExpr", [
            ts.factory.createIdentifier("false"),
          ]);
        } else if (ts.isNumericLiteral(node)) {
          return newExpr("NumberLiteralExpr", [node]);
        } else if (
          ts.isStringLiteral(node) ||
          ts.isNoSubstitutionTemplateLiteral(node)
        ) {
          return newExpr("StringLiteralExpr", [node]);
        } else if (ts.isLiteralExpression(node)) {
          // const type = checker.getTypeAtLocation(node);
          // if (type.symbol.escapedName === "boolean") {
          //   return newExpr("BooleanLiteralExpr", [node]);
          // }
        } else if (
          node.kind === ts.SyntaxKind.TrueKeyword ||
          node.kind === ts.SyntaxKind.FalseKeyword
        ) {
          return newExpr("BooleanLiteralExpr", [node as ts.Expression]);
        } else if (ts.isForOfStatement(node) || ts.isForInStatement(node)) {
          if (ts.isVariableDeclarationList(node.initializer)) {
            if (node.initializer.declarations.length === 1) {
              const varDecl = node.initializer.declarations[0];
              if (ts.isIdentifier(varDecl.name)) {
                // for (const i in list)
                return newExpr(
                  ts.isForOfStatement(node) ? "ForOfStmt" : "ForInStmt",
                  [
                    toExpr(varDecl, scope),
                    toExpr(node.expression, scope),
                    toExpr(node.statement, scope),
                  ]
                );
              } else if (ts.isArrayBindingPattern(varDecl.name)) {
                // for (const [a, b] in list)
              }
            }
          }
        } else if (ts.isTemplateExpression(node)) {
          const exprs = [];
          if (node.head.text) {
            exprs.push(string(node.head.text));
          }
          for (const span of node.templateSpans) {
            exprs.push(toExpr(span.expression, scope));
            if (span.literal.text) {
              exprs.push(string(span.literal.text));
            }
          }
          return newExpr("TemplateExpr", [
            ts.factory.createArrayLiteralExpression(exprs),
          ]);
        } else if (ts.isBreakStatement(node)) {
          return newExpr("BreakStmt", []);
        } else if (ts.isContinueStatement(node)) {
          return newExpr("ContinueStmt", []);
        } else if (ts.isTryStatement(node)) {
          return newExpr("TryStmt", [
            toExpr(node.tryBlock, scope),
            node.catchClause
              ? toExpr(node.catchClause, scope)
              : ts.factory.createIdentifier("undefined"),
            node.finallyBlock
              ? toExpr(node.finallyBlock, scope)
              : ts.factory.createIdentifier("undefined"),
          ]);
        } else if (ts.isCatchClause(node)) {
          return newExpr("CatchClause", [
            node.variableDeclaration
              ? toExpr(node.variableDeclaration, scope)
              : ts.factory.createIdentifier("undefined"),
            toExpr(node.block, scope),
          ]);
        } else if (ts.isThrowStatement(node)) {
          return newExpr("ThrowStmt", [toExpr(node.expression, scope)]);
        } else if (ts.isTypeOfExpression(node)) {
          return newExpr("TypeOfExpr", [toExpr(node.expression, scope)]);
        } else if (ts.isWhileStatement(node)) {
          return newExpr("WhileStmt", [
            toExpr(node.expression, scope),
            ts.isBlock(node.statement)
              ? toExpr(node.statement, scope)
              : // re-write a standalone statement as as BlockStmt
                newExpr("BlockStmt", [
                  ts.factory.createArrayLiteralExpression([
                    toExpr(node.statement, scope),
                  ]),
                ]),
          ]);
        } else if (ts.isDoStatement(node)) {
          return newExpr("DoStmt", [
            ts.isBlock(node.statement)
              ? toExpr(node.statement, scope)
              : // re-write a standalone statement as as BlockStmt
                newExpr("BlockStmt", [
                  ts.factory.createArrayLiteralExpression([
                    toExpr(node.statement, scope),
                  ]),
                ]),
            toExpr(node.expression, scope),
          ]);
        } else if (ts.isParenthesizedExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (ts.isAsExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (ts.isTypeAssertionExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (ts.isNonNullExpression(node)) {
          return toExpr(node.expression, scope);
        } else if (node.kind === ts.SyntaxKind.ThisKeyword) {
          // assuming that this is used in a valid location, create a closure around that instance.
          return ref(ts.factory.createIdentifier("this"));
        }

        throw new Error(
          `unhandled node: ${node.getText()} ${ts.SyntaxKind[node.kind]}`
        );
      }

      function ref(node: ts.Expression) {
        return newExpr("ReferenceExpr", [
          ts.factory.createStringLiteral(exprToString(node)),
          ts.factory.createArrowFunction(
            undefined,
            undefined,
            [],
            undefined,
            undefined,
            node
          ),
        ]);
      }

      /**
       * Follow the parent of the symbol to determine if the identifier shares the same scope as the current closure being compiled.
       * If not within the scope of the current closure, return a reference that returns the external value if possible.
       * const val = "hello";
       * reflect(() => return { value: val }; );
       *
       * result
       *
       * return { value: () => val };
       */
      function outOfScopeIdentifierToRef(
        symbol: ts.Symbol,
        scope: ts.Node
      ): ts.NewExpression | undefined {
        if (symbol) {
          if (symbol.valueDeclaration) {
            // Identifies if Shorthand Property Assignment value declarations return the shorthand prop assignment and not the value.
            // const value = "hello"
            // const v = { value } <== shorthand prop assignment.
            // The checker supports getting the value assignment symbol, recursively call this method on the new symbol instead.
            if (ts.isShorthandPropertyAssignment(symbol.valueDeclaration)) {
              const updatedSymbol = checker.getShorthandAssignmentValueSymbol(
                symbol.valueDeclaration
              );
              return updatedSymbol
                ? outOfScopeIdentifierToRef(updatedSymbol, scope)
                : undefined;
            } else if (ts.isVariableDeclaration(symbol.valueDeclaration)) {
              if (
                symbol.valueDeclaration.initializer &&
                !hasParent(symbol.valueDeclaration, scope)
              ) {
                return ref(ts.factory.createIdentifier(symbol.name));
              }
            }
          }
        }
        return;
      }

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
      function flattenDestructuredAssignment(
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
            return flattenDestructuredAssignment(element.parent.parent);
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
       *     busbus(...)
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
                  const flattened = flattenDestructuredAssignment(
                    symbol.valueDeclaration
                  );
                  console.log(ts.SyntaxKind[flattened.kind]);
                  return getOutOfScopeValueNode(flattened, scope);
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
          const outOfScope = getOutOfScopeValueNode(
            expression.expression,
            scope
          );
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
            return updatedSymbol
              ? isSymbolOutOfScope(updatedSymbol, scope)
              : false;
          } else if (ts.isVariableDeclaration(symbol.valueDeclaration)) {
            return !hasParent(symbol.valueDeclaration, scope);
          } else if (ts.isBindingElement(symbol.valueDeclaration)) {
            /* 
              check if the binding element's declaration is within the scope or not.

              example: if the scope if func's body

              ({ a }) => {
                const { b } = a;
                const func = ({ c }) => {
                  const { d: { x, y } } = b;
                }
              }

              // in scope: c, x, y
              // out of scope: a, b
            */
            const declaration = getDestructuredDeclaration(
              symbol.valueDeclaration
            );
            return !hasParent(declaration, scope);
          }
        } else if (symbol.declarations && symbol.declarations.length > 0) {
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

      function exprToString(node: ts.Expression): string {
        if (ts.isIdentifier(node)) {
          return node.text;
        } else if (ts.isPropertyAccessExpression(node)) {
          return `${exprToString(node.expression)}.${exprToString(node.name)}`;
        } else if (ts.isElementAccessExpression(node)) {
          return `${exprToString(node.expression)}[${exprToString(
            node.argumentExpression
          )}]`;
        } else {
          return "";
        }
      }

      function string(literal: string): ts.Expression {
        return newExpr("StringLiteralExpr", [
          ts.factory.createStringLiteral(literal),
        ]);
      }

      function newExpr(type: FunctionlessNode["kind"], args: ts.Expression[]) {
        return ts.factory.createNewExpression(
          ts.factory.createPropertyAccessExpression(
            functionlessContext.functionless,
            type
          ),
          undefined,
          args
        );
      }

      function isIntegrationNode(node: ts.Node): boolean {
        const exprType = checker.getTypeAtLocation(node);
        const exprKind = exprType.getProperty("kind");
        if (exprKind) {
          const exprKindType = checker.getTypeOfSymbolAtLocation(
            exprKind,
            node
          );
          return exprKindType.isStringLiteral();
        }
        return false;
      }
    };
  };
}

function getOperator(op: ts.BinaryOperatorToken): BinaryOp | undefined {
  return OperatorMappings[op.kind as keyof typeof OperatorMappings];
}

const OperatorMappings: Record<number, BinaryOp> = {
  [ts.SyntaxKind.EqualsToken]: "=",
  [ts.SyntaxKind.PlusToken]: "+",
  [ts.SyntaxKind.MinusToken]: "-",
  [ts.SyntaxKind.AmpersandAmpersandToken]: "&&",
  [ts.SyntaxKind.BarBarToken]: "||",
  [ts.SyntaxKind.ExclamationEqualsToken]: "!=",
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "!=",
  [ts.SyntaxKind.EqualsEqualsToken]: "==",
  [ts.SyntaxKind.EqualsEqualsEqualsToken]: "==",
  [ts.SyntaxKind.LessThanEqualsToken]: "<=",
  [ts.SyntaxKind.LessThanToken]: "<",
  [ts.SyntaxKind.GreaterThanEqualsToken]: ">=",
  [ts.SyntaxKind.GreaterThanToken]: ">",
  [ts.SyntaxKind.ExclamationEqualsToken]: "!=",
  [ts.SyntaxKind.ExclamationEqualsEqualsToken]: "!=",
  [ts.SyntaxKind.InKeyword]: "in",
} as const;

// const isTsStatement = (node: ts.Node): node is ts.Statement =>
//   "_statementBrand" in node;

// const isTsExpression = (node: ts.Node): node is ts.Expression =>
//   "_expressionBrand" in node;

// const isTsDeclaration = (node: ts.Node): node is ts.Declaration =>
//   "_declarationBrand" in node;
