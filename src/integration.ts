import { ApiGatewayVtlIntegration } from "./api";
import { AppSyncVtlIntegration } from "./appsync";
import { ASL, ASLGraph } from "./asl";
import { EventBus, EventBusTargetIntegration } from "./event-bridge";
import { AwaitExpr, CallExpr, ReferenceExpr } from "./expression";
import { Function, NativeIntegration } from "./function";
import {
  isAwaitExpr,
  isBindingElem,
  isBindingPattern,
  isCallExpr,
  isConditionExpr,
  isElementAccessExpr,
  isIdentifier,
  isPropAccessExpr,
  isReferenceExpr,
  isThisExpr,
  isVariableDecl,
} from "./guards";
import { FunctionlessNode } from "./node";
import { AnyFunction, evalToConstant } from "./util";
import { visitEachChild } from "./visit";
import { VTL } from "./vtl";

export const isIntegration = <I extends Integration<string, AnyFunction>>(
  i: any
): i is I => typeof i === "object" && "kind" in i;

export interface IntegrationCallExpr extends CallExpr {}

export function isIntegrationCallExpr(
  node: FunctionlessNode
): node is IntegrationCallExpr {
  if (isCallExpr(node)) {
    return tryFindIntegration(node.expr) !== undefined;
  }
  return false;
}

export type IntegrationCallPattern =
  | CallExpr
  | (AwaitExpr & { expr: CallExpr });

export function isIntegrationCallPattern(
  node: FunctionlessNode
): node is IntegrationCallPattern {
  return (
    (isAwaitExpr(node) && isIntegrationCallExpr(node.expr)) ||
    isIntegrationCallExpr(node)
  );
}

/**
 * Give the possible ways to define an integration, return just the call(ref) of the integration.
 */
export function getIntegrationExprFromIntegrationCallPattern(
  pattern: IntegrationCallPattern
): IntegrationCallExpr | undefined {
  if (isAwaitExpr(pattern)) {
    return getIntegrationExprFromIntegrationCallPattern(pattern.expr);
  } else if (isCallExpr(pattern)) {
    const integration = tryFindIntegration(pattern.expr);
    if (integration) {
      return pattern;
    }
  }
  return undefined;
}

/**
 * Maintain a typesafe runtime map of integration type keys to use elsewhere.
 *
 * For example, removing all but native integration from the {@link Function} closure.
 */
const INTEGRATION_TYPES: { [P in keyof IntegrationMethods<any>]: P } = {
  appSyncVtl: "appSyncVtl",
  apiGWVtl: "apiGWVtl",
  asl: "asl",
  native: "native",
  eventBus: "eventBus",
};

export const INTEGRATION_TYPE_KEYS = Object.values(INTEGRATION_TYPES);

/**
 * All integration methods supported by functionless.
 */
export interface IntegrationMethods<
  F extends AnyFunction,
  EventBusInteg extends EventBusTargetIntegration<
    any,
    any
  > = EventBusTargetIntegration<any, any>
> {
  /**
   * Integrate with AppSync VTL applications.
   * @private
   */
  appSyncVtl: AppSyncVtlIntegration;
  /**
   * Integrate with API Gateway VTL applications.
   * @private
   */
  apiGWVtl: ApiGatewayVtlIntegration;
  /**
   * Integrate with ASL applications like StepFunctions.
   *
   * TODO: Update to use an interface https://github.com/functionless/functionless/issues/197
   *
   * @private
   */
  asl: (call: CallExpr, context: ASL) => ASLGraph.NodeResults;
  eventBus: EventBusInteg;
  /**
   * Native javascript code integrations that execute at runtime like Lambda.
   */
  native: NativeIntegration<F>;
}

/**
 * Integration types supported by Functionless.
 *
 * Add an integration by creating any object that has a property named "kind" and either implements the
 * {@link Integration} interface or has methods that implement it (or both).
 *
 * Example showing both strategies:
 *
 * ```ts
 * export class Function implements {@link Integration} {
 *    readonly kind = "Function",
 *
 *    // Integration Handler for ASL
 *    public asl(call, context) {
 *       // return Step Function task.
 *    }
 *
 *    // Example class method - some wrapper function that generates special ASL tasks when using a Function.
 *    public specialPayload = makeIntegration<() => string>({
 *        kind: "Function.default",
 *        asl: (call, context) => {
 *            // return step function task
 *        }
 *    });
 * }
 *
 * // an interface to provide the actual callable methods to users
 * export interface Function {
 *    // call me to send a string payload
 *    (payload: String) => string
 * }
 *
 * // use
 *
 * const func1 = new Function(...);
 * // uses the ASL
 * new StepFunction(..., async () => {
 *    await func1("some string");
 *    // Calling our special method in a step function closure
 *    await func1.specialPayload();
 * })
 * ```
 *
 * If an integration does not support an integration type, leave the function undefined or throw an error.
 *
 * Implement the unhandledContext function to customize the error message for unsupported contexts.
 * Otherwise the error will be: `${this.name} is not supported by context ${context.kindStr}.`
 */
export interface Integration<
  K extends string = string,
  F extends AnyFunction = AnyFunction,
  EventBus extends EventBusTargetIntegration<
    any,
    any
  > = EventBusTargetIntegration<any, any>
> extends Partial<IntegrationMethods<F, EventBus>> {
  /**
   * Brand the Function, F, into this type so that sub-typing rules apply to the function signature.
   */
  __functionBrand: F;
  /**
   * Integration Handler kind - for example StepFunction.describeExecution
   */
  readonly kind: K;
  /**
   * Optional method that allows overriding the {@link Error} thrown when a integration is not supported by a handler.
   * @param kind - The Kind of the integration.
   * @param contextKind - the Kind of the context attempting to use the integration.
   */
  readonly unhandledContext?: (
    kind: string,
    contextKind: CallContext["kind"]
  ) => Error;
}

/**
 * Alias that removes computed inputs from the integration interface
 */
export type IntegrationInput<
  K extends string = string,
  F extends AnyFunction = AnyFunction
> = Omit<Integration<K, F>, "__functionBrand">;

/**
 * Internal wrapper class for Integration handlers that provides default error handling for unsupported integrations.
 *
 * Functionless wraps Integration at runtime with this class.
 * @private
 */
export class IntegrationImpl<F extends AnyFunction = AnyFunction>
  implements IntegrationMethods<F>
{
  readonly kind: string;
  constructor(readonly integration: Integration) {
    if (!integration) {
      throw Error("Integrations cannot be undefined.");
    }
    this.kind = integration.kind;
  }

  private assertIntegrationDefined<I>(
    contextKind: CallContext["kind"],
    integration?: I
  ): I {
    if (integration) {
      return integration;
    } else if (this.integration.unhandledContext) {
      throw this.integration.unhandledContext(this.kind, contextKind);
    }
    throw Error(`${this.kind} is not supported by context ${contextKind}.`);
  }

  public get appSyncVtl(): AppSyncVtlIntegration {
    return this.assertIntegrationDefined(
      "Velocity Template",
      this.integration.appSyncVtl
    );
  }

  public get apiGWVtl(): ApiGatewayVtlIntegration {
    return this.assertIntegrationDefined(
      // TODO: differentiate Velocity Template?
      "Velocity Template",
      this.integration.apiGWVtl
    );
  }

  // TODO: Update to use an interface https://github.com/functionless/functionless/issues/197
  public asl(call: CallExpr, context: ASL): ASLGraph.NodeResults {
    return this.assertIntegrationDefined(
      context.kind,
      this.integration.asl
    ).bind(this.integration)(call, context);
  }

  public get eventBus(): EventBusTargetIntegration<any, any> {
    return this.assertIntegrationDefined("EventBus", this.integration.eventBus);
  }

  public get native(): NativeIntegration<F> {
    return this.assertIntegrationDefined("Function", this.integration.native);
  }
}

export type IntegrationCall<K extends string, F extends AnyFunction> = {
  FunctionlessType: K;
  kind: K;
  __functionBrand: F;
} & F;

/**
 * Helper method which masks an {@link Integration} object as a function of any form.
 *
 * ```ts
 * export namespace MyIntegrations {
 *    export const callMe = makeIntegration<(payload: string) => void>({
 *       asl: (call, context) => { ... }
 *    })
 * }
 * ```
 *
 * Creates an integration object at callMe, which is callable by a user.
 *
 * ```ts
 * MyIntegrations.callMe("some string");
 * ```
 *
 * @private
 */
export function makeIntegration<K extends string, F extends AnyFunction>(
  integration: IntegrationInput<K, F>
): IntegrationCall<K, F> {
  return integration as unknown as IntegrationCall<K, F>;
}

export type CallContext = ASL | VTL | Function<any, any> | EventBus<any>;

export function findDeepIntegrations(
  ast: FunctionlessNode
): CallExpr<ReferenceExpr>[] {
  const nodes: CallExpr<ReferenceExpr>[] = [];
  visitEachChild(ast, function visit(node: FunctionlessNode): FunctionlessNode {
    if (isCallExpr(node)) {
      const integrations = tryFindIntegrations(node.expr);
      if (integrations) {
        nodes.push(
          ...integrations.map((integration) =>
            node.fork(
              new CallExpr(
                new ReferenceExpr("", () => integration),
                node.args.map((arg) => arg.clone())
              )
            )
          )
        );
      }
    }

    return visitEachChild(node, visit);
  });

  return nodes;
}

/**
 * A bottom-up algorithm that determines the ONLY {@link Integration} value that the {@link node}
 * will resolve to at runtime.
 *
 * If the {@link node} resolves to 0 or more than 1 {@link Integration} then `undefined` is returned.
 *
 * **Note**: This function is an intermediate helper until we migrate the interpreters to be more general
 * (likely by migrating to top-down algorithms, see https://github.com/functionless/functionless/issues/374#issuecomment-1203313604)
 *
 * @param node the node to resolve the {@link Integration} of.
 * @returns the ONLY {@link Integration} that {@link node} can resolve to, otherwise `undefined`.
 */
export function tryFindIntegration(
  node: FunctionlessNode
): Integration | undefined {
  const integrations = tryFindIntegrations(node);
  if (integrations?.length === 1) {
    return integrations[0];
  }
  return undefined;
}

/**
 * A bottom-up algorithm that determines all of the possible {@link Integration}s that a {@link node}
 * may resolve to at runtime.
 *
 * ```ts
 * declare const table1;
 * declare const table2;
 *
 * const tables = [table1, table2];
 *
 * const a = table1;
 *    // ^ [table1]
 *
 * for (const a of tables) {
 *   const b = a;
 *          // ^ [table1, table2]
 *
 *   const { appsync: { getItem } } = a;
 *                     // ^ [ table1.appsync.getItem, table2.appsync.getItem ]
 * }
 *
 * const a = tables[0];
 *          // ^ [table1]
 *
 * const { appsync: { getItem } } = table[0];
 *                   // ^ [ table1.appsync.getItem ]
 *
 * const { appsync: { getItem = table1.appsync.getItem } } = table[2];
 *                   // ^ [ table1.appsync.getItem ] (because of initializer)
 * ```
 *
 * @param node the node to resolve the possible {@link Integration}s of.
 * @returns a list of all the {@link Integration}s that the {@link node} could evaluate to.
 */
export function tryFindIntegrations(node: FunctionlessNode): Integration[] {
  return resolve(node, undefined).filter(isIntegration);

  /**
   * Resolve all of the possible values that {@link node} may resolve to at runtime.
   *
   * @param node
   * @param defaultValue default value to use if the value cannot be resolved (set by default initializers in BindingElement)
   * @returns an array of all the values the {@link node} resolves to.
   */
  function resolve(
    node: FunctionlessNode | undefined,
    defaultValue: FunctionlessNode | undefined
  ): any[] {
    if (node === undefined) {
      if (defaultValue === undefined) {
        return [];
      } else {
        return resolve(defaultValue, undefined);
      }
    } else if (isReferenceExpr(node) || isThisExpr(node)) {
      return [node.ref()];
    } else if (isIdentifier(node)) {
      return resolve(node.lookup(), defaultValue);
    } else if (isBindingElem(node)) {
      return resolve(node.parent, node.initializer).flatMap((value) => {
        if (isIdentifier(node.name)) {
          return [value[node.name.name]];
        } else {
          throw new Error("should be impossible");
        }
      });
    } else if (isBindingPattern(node)) {
      // we only ever evaluate `{ a }` or `[ a ]` when walking backwards from `a`
      // the BindingElem resolver case will pluck `a` from the object returned by this
      return resolve(node.parent, defaultValue);
    } else if (isVariableDecl(node)) {
      return resolve(node.initializer, defaultValue);
    } else if (isPropAccessExpr(node) || isElementAccessExpr(node)) {
      return resolve(node.expr, undefined).flatMap((expr) => {
        const key: any = isPropAccessExpr(node)
          ? node.name.name
          : evalToConstant(node.element)?.constant;
        if (key !== undefined) {
          return [(<any>expr)?.[key]];
        }
        return [];
      });
    } else if (isConditionExpr(node)) {
      return resolve(node.then, defaultValue).concat(
        resolve(node._else, defaultValue)
      );
    }
    return [];
  }
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
