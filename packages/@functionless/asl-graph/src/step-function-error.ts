/**
 * An Error that can be thrown from within a StepFunction or ExpressStepFunction.
 *
 * It encodes a `Fail` state in ASL.
 * ```json
 * {
 *   "Type": "Fail",
 *   "Error": <error>,
 *   "Cause": JSON.stringify(<cause>)
 * }
 * ```
 *
 * For example:
 * ```ts
 * throw new StepFunctionError("MyError", { "key": "value"});
 * ```
 *
 * Produces the following Fail state:
 * ```json
 * {
 *   "Type": "Fail",
 *   "Error": "MyError",
 *   "Cause": "{\"key\":\"value\""}"
 * }
 * ```
 */
// @ts-ignore - TODO: rename error and cause
export class StepFunctionError extends Error {
  static readonly kind = "StepFunctionError";

  public static isConstructor(a: any): a is typeof StepFunctionError {
    return a === StepFunctionError || a?.kind === StepFunctionError.kind;
  }

  constructor(
    /**
     * The name of the Error to place in the Fail state.
     */
    readonly error: string,
    /*
     * A JSON object to be encoded as the `Cause`.
     *
     * Due to limitations in Step Functions, all values in the {@link cause} must be
     * a literal value - no references or calls are allowed.
     *
     * ```ts
     * // valid
     * new StepFunctionError("Error", { data: "prop" })
     * // invalid
     * new StepFunctionError("Error", { data: ref })
     * new StepFunctionError("Error", { data: call() })
     * ```
     */
    readonly cause: StepFunctionCause
  ) {
    super();
  }
}

/**
 * Data types allowed as a Step Function Cause.
 */
export type StepFunctionCause =
  | null
  | boolean
  | number
  | string
  | StepFunctionCause[]
  | {
      [prop: string]: StepFunctionCause;
    };

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
