// @ts-ignore - imported for tsdoc
import type { AwsMethod } from "./api";
const BASE_URL = process.env.FUNCTIONLESS_LOCAL
  ? `http://localhost:3000`
  : `https://functionless.org`;

/**
 * Error to throw during synth failures
 */
export class SynthError extends Error {
  constructor(readonly code: ErrorCode, message?: string) {
    super(formatErrorMessage(code, message));
  }
}

/**
 * Formats an error message consistently across Functionless.
 *
 * Includes a deep link url to functionless.org's error code page.
 *
 * ```
 * [messageText | code.MessageText]
 *
 * http://functionless.org/docs/error-codes/#[Anchor from Message Text]
 * ```
 */
export const formatErrorMessage = (code: ErrorCode, messageText?: string) => `${
  messageText ?? code.messageText
}

${formatErrorUrl(code)}`;

/**
 * Deep link to functionless.org's error code page.
 *
 * `http://functionless.org/docs/error-codes/#[Anchor from Message Text]`
 */
export const formatErrorUrl = (code: ErrorCode) =>
  `${BASE_URL}/docs/error-codes#${code.messageText
    .toLowerCase()
    .replace(/\s/g, "-")}`;

export interface ErrorCode {
  code: number;
  messageText: string;
}

export namespace ErrorCodes {
  /**
   * The computations that [Amazon States Language](https://docs.aws.amazon.com/step-functions/latest/dg/concepts-amazon-states-language.html)
   * can do is restricted by JSON Path and the limited [Intrinsic Functions](https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-intrinsic-functions.html). Currently, arithmetic expressions are not supported.
   * ```ts
   * // ok
   * new StepFunction(scope, id, () => 1 + 2);
   *
   * // illegal!
   * new StepFunction(scope, id, (input: { num: number }) => input.number + 1);
   * ```
   *
   * To workaround, use a Lambda Function to implement the arithmetic expression. Be aware that this comes with added cost and operational risk.
   *
   * ```ts
   * const add = new Function(scope, "add", (input: { a: number, b: number }) => input.a + input.b);
   *
   * new StepFunction(scope, id, async (input: { num: number }) => {
   *   await add({a: input.number, b: 1});
   * });
   * ```
   */
  export const Cannot_perform_arithmetic_on_variables_in_Step_Function: ErrorCode =
    {
      code: 100,
      messageText: "Cannot perform arithmetic on variables in Step Function",
    };

  /**
   * During CDK synth a function was encountered which was not compiled by the Functionless compiler plugin.
   * This suggests that the plugin was not correctly configured for this project.
   *
   * Ensure you follow the instructions at https://functionless.org/docs/getting-started.
   */
  export const FunctionDecl_not_compiled_by_Functionless: ErrorCode = {
    code: 101,
    messageText: "Function not compiled by Functionless plugin",
  };

  /**
   * The argument must be an inline Function.
   *
   * ```ts
   * // invalid - `func` must be an inline Function
   * new Function(this, id, func);
   * ```
   *
   * To fix, inline the `func` implementation.
   *
   * ```ts
   * // option 1 - arrow function
   * new Function(this, id, () => { .. });
   *
   * // option 2 - function
   * new Function(this, id, function () { .. });
   * ```
   */
  export const Argument_must_be_an_inline_Function: ErrorCode = {
    code: 102,
    messageText: `Argument must be an inline Function`,
  };

  /**
   * When using the {@link AwsMethod}, the `request` argument must be a function
   * with exactly one integration call.
   *
   * ```ts
   * new AwsMethod(
   *   {
   *     httpMethod: "GET",
   *     resource: api.root
   *   },
   *   ($input) => {
   *     return $AWS.DynamoDB.GetItem({ .. });
   *   },
   *   // etc.
   * )
   * ```
   */
  export const AwsMethod_request_must_have_exactly_one_integration_call: ErrorCode =
    {
      code: 103,
      messageText: `AwsMethod request must have exactly one integration call`,
    };

  /**
   * Lambda Function closure synthesis runs async, but CDK does not normally support async.
   *
   * In order for the synthesis to complete successfully
   * 1. Use autoSynth `new App({ authSynth: true })` or `new App()` with the CDK Cli (`cdk synth`)
   * 2. Use `await asyncSynth(app)` exported from Functionless in place of `app.synth()`
   * 3. Manually await on the closure serializer promises `await Promise.all(Function.promises)`
   *
   * https://github.com/functionless/functionless/issues/128
   */
  export const Function_Closure_Serialization_Incomplete: ErrorCode = {
    code: 102,
    messageText: "Function closure serialization was not allowed to complete",
  };

  /**
   * Generic error message to denote errors that should not happen and are not the fault of the Functionless library consumer.
   */
  export const Unexpected_Error: ErrorCode = {
    code: 103,
    messageText: "Unexpected Error, please report this issue",
  };

  /**
   * Incorrect State Machine Type Imported
   *
   * Functionless {@link StepFunction}s are separated into {@link ExpressStepFunction} and {@link StepFunction}
   * based on being {@link aws_stepfunctions.StateMachineType.EXPRESS} or {@link aws_stepfunctions.StateMachineType.STANDARD}
   * respectively.
   *
   * In order to ensure correct function of Functionless integrations, the correct import statement must be used.
   *
   * ```ts
   * const sfn = new aws_stepfunctions.StateMachine(scope, 'standardMachine', {...});
   * // valid
   * StateMachine.fromStepFunction(sfn);
   * // invalid - not an express machine
   * ExpressStateMachine.fromStepFunction(sfn);
   *
   * const exprSfn = new aws_stepfunctions.StateMachine(scope, 'standardMachine', {
   *    stateMachineType: aws_stepfunctions.StateMachineType.EXPRESS,
   * });
   * // valid
   * ExpressStateMachine.fromStepFunction(exprSfn);
   * // invalid - not a standard machine
   * StateMachine.fromStepFunction(exprSfn);
   * ```
   */
  export const Incorrect_StateMachine_Import_Type = {
    code: 104,
    messageText: "Incorrect state machine type imported",
  };

  /**
   * Unsafe usage of Secrets.
   *
   * The use of secrets is unsafe or not supported by Functionless.
   *
   * @see https://github.com/functionless/functionless/issues/252 to track supported secret patterns.
   */
  export const Unsafe_use_of_secrets = {
    code: 105,
    messageText: "Unsafe use of secrets",
  };

  /**
   * Unsupported initialization of Resources in a Function closure
   *
   * 1. Valid - EventBus resource is created outside of the closure.
   * ```ts
   * const bus = new EventBus(this, 'bus');
   * const function = new Function(this, 'func', () => {
   *    bus.putEvents(...);
   * });
   * ```
   *
   * 2. Invalid - EventBus resource is created in the closure.
   * ```ts
   * const function = new Function(this, 'func', () => {
   *    new EventBus(this, 'bus').putEvents(...);
   * });
   * ```
   *
   * 3. Invalid - EventBus resource is created in a method called by the closure.
   * ```ts
   * function bus() {
   *    return new EventBus(this, 'bus');
   * }
   * const function = new Function(this, 'func', () => {
   *    bus().putEvents(...);
   * });
   * ```
   *
   * 4. Valid - EventBus resource is created outside of the closure and called methods.
   * ```ts
   * const bus = new EventBus(this, 'bus');
   * function bus() {
   *    return bus;
   * }
   * const function = new Function(this, 'func', () => {
   *    bus().putEvents(...);
   * });
   * ```
   */
  export const Unsupported_initialization_of_resources_in_function = {
    code: 106,
    messageText:
      "Unsupported initialization of Resources in a Function closure",
  };

  /**
   * Cannot use Infrastructure resource in Function closure.
   *
   * The `.resource` property of `Function`, `StepFunction`, `ExpressStepFunction`, `EventBus`, and `Table` are not available
   * in Native Function Closures.
   *
   * ```ts
   * const table = new Table(this, 'table', { ... });
   * new Function(this, 'func', async () => {
   *    // valid use of a Table
   *    const $AWS.DynamoDB.GetItem({
   *        TableName: table,
   *        ...
   *    })
   *    // invalid - .resource is not available
   *    const index = table.resource.tableStreamArn;
   * });
   * ```
   *
   * ### Workaround - Functionless Resource Properties
   *
   * In many cases, common properties are available on the Functionless Resource, for example:
   *
   * ```ts
   * const table = new Table(this, 'table', { ... });
   * new Function(this, 'func', async () => {
   *    const tableArn = table.tableArn;
   * });
   * ```
   *
   * ### Workaround - Dereference
   *
   * For some properties, referencing to a variable outside of the closure will work.
   *
   * ```ts
   * const table = new Table(this, 'table', { ... });
   * const tableStreamArn = table.resource.tableStreamArn;
   * new Function(this, 'func', async () => {
   *    const tableStreamArn = tableStreamArn;
   * });
   * ```
   *
   * ### Workaround - Environment Variable
   *
   * Finally, if none of the above work, the lambda environment variables can be used.
   *
   * ```ts
   * const table = new Table(this, 'table', { ... });
   * new Function(this, 'func', {
   *    environment: {
   *       STREAM_ARN: table.resource.tableStreamArn
   *    }
   * }, async () => {
   *    const tableStreamArn = process.env.STREAM_ARN;
   * });
   * ```
   */
  export const Cannot_use_infrastructure_Resource_in_Function_closure = {
    code: 107,
    messageText: "Cannot use infrastructure Resource in Function closure",
  };
}
