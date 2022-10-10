import {
  AnyFunction,
  AwaitExpr,
  CallExpr,
  forEachChild,
  FunctionlessNode,
  isAnyFunction,
  isAwaitExpr,
  isCallExpr,
  isReferenceExpr,
  ReferenceExpr,
  tryResolveReferences,
} from "@functionless/ast";
import { reflect } from "@functionless/ast";

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
  F extends AnyFunction = AnyFunction
> extends Partial<IntegrationMethods<F>> {
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
  readonly unhandledContext?: (kind: string, contextKind: string) => Error;
}

/**
 * Alias that removes computed inputs from the integration interface
 */
export type IntegrationInput<
  K extends string = string,
  F extends AnyFunction = AnyFunction
> = Omit<Integration<K, F>, "__functionBrand">;

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

export function findDeepIntegrations(
  ast: FunctionlessNode
): CallExpr<ReferenceExpr>[] {
  const nodes: CallExpr<ReferenceExpr>[] = [];
  const seen = new Set();
  forEachChild(ast, function visit(node: FunctionlessNode): void {
    if (isCallExpr(node)) {
      const integrations = tryFindIntegrations(node.expr);
      if (integrations) {
        nodes.push(
          ...integrations.map((integration) =>
            node.fork(
              new CallExpr(
                node.span,
                new ReferenceExpr(node.expr.span, "", () => integration, 0, 0),
                node.args.map((arg) => arg.clone()),
                false
              )
            )
          )
        );
      }
    } else if (isReferenceExpr(node)) {
      (function visitValue(value: any): void {
        if (seen.has(value)) {
          return;
        }
        seen.add(value);
        if (isAnyFunction(value)) {
          const ast = reflect(value);
          if (ast) {
            visit(ast);
          }
        } else if (Array.isArray(value)) {
          value.forEach(visitValue);
        } else if (value && typeof value === "object") {
          Object.values(value).forEach(visitValue);
        }
      })(node.ref());
    }

    forEachChild(node, visit);
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
  return tryResolveReferences(node, undefined).filter((i) => {
    return isIntegration(i);
  });
}
