import { CallExpr } from "./expression";
import { ASL, State } from "./asl";
import { FunctionlessNode } from "./node";
import { VTL } from "./vtl";
import { AnyFunction } from "./util";
import { Function, NativeIntegration } from "./function";

/**
 * All integration methods supported by functionless.
 */
interface IntegrationMethods {
  /**
   * Integrate with VTL applications like AppAsync.
   * @private
   */
  vtl: (call: CallExpr, context: VTL) => string;
  /**
   * Integrate with ASL applications like StepFunctions.
   * @private
   */
  asl: (call: CallExpr, context: ASL) => Omit<State, "Next">;
  /**
   * Native javascript code integrations that execute at runtime like Lambda.
   */
  native: NativeIntegration<AnyFunction>;
}

/**
 * Integration types supported by Functionless.
 *
 * Add an integration by creating any object that has a property named "kind" and either implements the
 * {@link IIntegration} interface or has methods that implement it (or both).
 *
 * Example showing both strategies:
 *
 * ```ts
 * export class Function implements IntegrationHandler {
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
 * new StepFunction(..., () => {
 *    func1("some string");
 *    // Calling our special method in a step function closure
 *    func1.specialPayload();
 * })
 * ```
 *
 * If an integration does not support an integration type, leave the function undefined or throw an error.
 *
 * Implement the unhandledContext function to customize the error message for unsupported contexts.
 * Otherwise the error will be: `${this.name} is not supported by context ${context.kind}.`
 */
export type IIntegration = {
  // all integration methods are optional
  [integ in keyof IntegrationMethods]?: IntegrationMethods[integ];
} & {
  /**
   * Integration Handler kind - for example StepFunction.describeExecution
   */
  readonly kind: string;
  /**
   * Optional method that allows overriding the {@link Error} thrown when a integration is not supported by a handler.
   */
  readonly unhandledContext?: (kind: string, context: CallContext['kind']) => Error;
};

/**
 * Internal wrapper class for Integration handlers that provides default error handling for unsupported integrations.
 *
 * Functionless wraps IntegrationHandlers at runtime with this class.
 * @private
 */
export class Integration implements IntegrationMethods {
  readonly kind: string;
  constructor(readonly integration: IIntegration) {
    this.kind = integration.kind;
  }

  private unhandledContext<T>(context: CallContext['kind']): T {
    if (this.integration.unhandledContext) {
      throw this.integration.unhandledContext(this.kind, context);
    }
    throw Error(`${this.kind} is not supported by context ${context}.`);
  }

  public vtl(call: CallExpr, context: VTL): string {
    if (this.integration.vtl) {
      return this.integration.vtl(call, context);
    }
    return this.unhandledContext(context.kind);
  }

  public asl(call: CallExpr, context: ASL): Omit<State, "Next"> {
    if (this.integration.asl) {
      return this.integration.asl(call, context);
    }
    return this.unhandledContext(context.kind);
  }

  public get native(): NativeIntegration<AnyFunction> {
    if (this.integration.native) {
      return this.integration.native;
    }
    return this.unhandledContext('Function');
  }
}

export function makeIntegration<F extends AnyFunction>(
  integration: IIntegration
): F {
  return integration as unknown as F;
}

/**
 * @param call call expression that may reference a callable integration
 * @returns the reference to the callable function, e.g. a Lambda Function or method on a DynamoDB Table
 */
export function findIntegration(call: CallExpr): Integration | undefined {
  const integrationHandler = find(call.expr);
  return integrationHandler ? new Integration(integrationHandler) : undefined;

  function find(expr: FunctionlessNode): any {
    if (expr.kind === "PropAccessExpr") {
      return find(expr.expr)?.[expr.name];
    } else if (expr.kind === "Identifier") {
      return undefined;
    } else if (expr.kind === "ReferenceExpr") {
      return expr.ref();
    } else {
      return undefined;
    }
  }
}

export type CallContext = ASL | VTL | Function<any, any>;
