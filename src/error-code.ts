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
  messageText ?? code.title
}

${formatErrorUrl(code)}`;

/**
 * Deep link to functionless.org's error code page.
 *
 * `http://functionless.org/docs/error-codes/#[Anchor from Message Text]`
 */
export const formatErrorUrl = (code: ErrorCode) =>
  `${BASE_URL}/docs/error-codes#${code.title
    .toLowerCase()
    .replace(/\s/g, "-")}`;

export enum ErrorType {
  "ERROR" = "ERROR",
  "WARN" = "WARN",
  "INFO" = "INFO",
  "DEPRECATED" = "DEPRECATED",
}

export interface ErrorCode {
  /**
   * Error code, a unique number between 10000 and 99999.
   *
   * New error codes should be sequential.
   */
  readonly code: number;
  /**
   * The type of the error, determine how the error is displayed in the language service and on the website.
   */
  readonly type: ErrorType;
  /**
   * Title of the error which will appear on `https://functionless.org/docs/error-codes` and act as the deep link.
   * (https://functionless.org/docs/error-codes#title-with-dashes)
   */
  readonly title: string;
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
      code: 10000,
      type: ErrorType.ERROR,
      title: "Cannot perform arithmetic on variables in Step Function",
    };

  /**
   * During CDK synth a function was encountered which was not compiled by the Functionless compiler plugin.
   * This suggests that the plugin was not correctly configured for this project.
   *
   * Ensure you follow the instructions at https://functionless.org/docs/getting-started.
   */
  export const FunctionDecl_not_compiled_by_Functionless: ErrorCode = {
    code: 10001,
    type: ErrorType.ERROR,
    title: "Function not compiled by Functionless plugin",
  };

  /**
   * The argument must be an inline Function.
   *
   * ```ts
   * const func = () => {
   *   // ..
   * }
   * // invalid - `func` must be an inline Function
   * new Function(this, id, func);
   * ```
   *
   * To fix, inline the `func` implementation.
   *
   * ```ts
   * // option 1 - arrow function
   * new Function(this, id, async () => { .. });
   *
   * // option 2 - function
   * new Function(this, id, async function () { .. });
   * ```
   */
  export const Argument_must_be_an_inline_Function: ErrorCode = {
    code: 10002,
    type: ErrorType.ERROR,
    title: `Argument must be an inline Function`,
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
      code: 10003,
      type: ErrorType.ERROR,
      title: `AwsMethod request must have exactly one integration call`,
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
    code: 10004,
    type: ErrorType.ERROR,
    title: "Function closure serialization was not allowed to complete",
  };

  /**
   * Generic error message to denote errors that should not happen and are not the fault of the Functionless library consumer.
   *
   * Please report this issue
   */
  export const Unexpected_Error: ErrorCode = {
    code: 10005,
    type: ErrorType.ERROR,
    title: "Unexpected Error, please report this issue",
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
  export const Incorrect_StateMachine_Import_Type: ErrorCode = {
    code: 10006,
    type: ErrorType.ERROR,
    title: "Incorrect state machine type imported",
  };

  /**
   * Unsafe usage of Secrets.
   *
   * The use of secrets is unsafe or not supported by Functionless.
   *
   * @see https://github.com/functionless/functionless/issues/252 to track supported secret patterns.
   */
  export const Unsafe_use_of_secrets: ErrorCode = {
    code: 10007,
    type: ErrorType.ERROR,
    title: "Unsafe use of secrets",
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
  export const Unsupported_initialization_of_resources_in_function: ErrorCode =
    {
      code: 10008,
      type: ErrorType.ERROR,
      title: "Unsupported initialization of Resources in a Function closure",
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
   * Workaround 1 - Functionless Resource Properties
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
   * Workaround 2 - Dereference
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
   * Workaround 3 - Environment Variable
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
  export const Cannot_use_infrastructure_Resource_in_Function_closure: ErrorCode =
    {
      code: 10009,
      type: ErrorType.ERROR,
      title: "Cannot use infrastructure Resource in Function closure",
    };

  /**
   * Computed Property Names are not supported in API Gateway.
   *
   * For example:
   * ```ts
   * new AwsMethod(
   *   ($input) => $AWS.DynamoDB.GetItem({
   *     TableName: table,
   *     // invalid, all property names must be literals
   *     [computedProperty]: prop
   *   })
   * );
   * ```
   *
   * To workaround, be sure to only use literal property names.
   */
  export const API_Gateway_does_not_support_computed_property_names: ErrorCode =
    {
      code: 10010,
      type: ErrorType.ERROR,
      title: "API Gateway does not supported computed property names",
    };

  /**
   * Due to limitations in API Gateway's VTL engine (no $util.toJson, for example)
   * it is not possible to fully support spread expressions.
   *
   * For example:
   * ```ts
   * new AwsMethod(
   *   () => {},
   *   ($input) => ({
   *     hello: "world",
   *     ...$input.data
   *   })
   * );
   * ```
   *
   * To workaround the limitation, explicitly specify each property.
   *
   * ```ts
   * new AwsMethod(
   *   () => {},
   *   ($input) => ({
   *     hello: "world",
   *     propA: $input.data.propA,
   *     propB: $input.data.propB,
   *   })
   * );
   * ```
   */
  export const API_Gateway_does_not_support_spread_assignment_expressions: ErrorCode =
    {
      code: 10011,
      type: ErrorType.ERROR,
      title: "API Gateway does not support spread assignment expressions",
    };

  /**
   * Due to limitations in respective Functionless interpreters, it is often a
   * requirement to specify an object literal instead of a variable reference.
   *
   * ```ts
   * const input = {
   *   TableName: table,
   *   Key: {
   *     // etc.
   *   }
   * };
   * // invalid - input must be an object literal
   * $AWS.DynamoDB.GetItem(input)
   * ```
   *
   * To work around, ensure that you specify an object literal.
   *
   * ```ts
   * $AWS.DynamoDB.GetItem({
   *   TableName: table,
   *   Key: {
   *     // etc.
   *   }
   * })
   * ```
   */
  export const Expected_an_object_literal: ErrorCode = {
    code: 10012,
    type: ErrorType.ERROR,
    title: "Expected_an_object_literal",
  };

  /**
   * Code running within an API Gateway's response mapping template must not attempt
   * to call any integration. It can only perform data transformation.
   *
   * ```ts
   * new AwsMethod(
   *   ...,
   *   () => {
   *     // INVALID! - you cannot call an integration from within a response mapping template
   *     return $AWS.DynamoDB.GetItem({
   *       TableName: table,
   *       ...
   *     });
   *   }
   * )
   * ```
   *
   * To workaround, make sure to only call an integration from within the `request` mapping function.
   */
  export const API_gateway_response_mapping_template_cannot_call_integration: ErrorCode =
    {
      code: 10013,
      type: ErrorType.ERROR,
      title: "API gateway response mapping template cannot call integration",
    };

  /**
   * {@link EventBus} Input Transformers do not support Integrations.
   *
   * ```ts
   * const func = new Function<string, string>(stack, 'func', async (input) => {
   *    return axios.get(input);
   * })
   *
   * // invalid
   * new EventBus(stack, 'bus').all().map(async event => { html: await func(event.detail.url) });
   * ```
   *
   * ### Workaround - Send the event to a function.
   *
   * ```ts
   * const func = new Function<string, string>(stack, 'func', async (input) => {
   *    return `transform${input}`;
   * })
   *
   * // valid
   * new EventBus(stack, 'bus').all().pipe(new Function(stack, 'webpuller', async (event) => ({
   *    html: await func(event.detail.url)
   * })));
   * ```
   */
  export const EventBus_Input_Transformers_do_not_support_Integrations: ErrorCode =
    {
      code: 10014,
      type: ErrorType.ERROR,
      title: "EventBus Input Transformers do not support integrations",
    };

  /**
   * Integrations within {@link StepFunction}, {@link ExpressStepFunction}, {@link AppsyncResolver}, and {@link AwsMethod} must be immediately awaited or returned.
   *
   * These services do not support references to asynchronous operations. In order to model an asynchronous call being handled synchronously, all integrations that return promises must be awaited or returned.
   *
   * ```ts
   * const func = new Function<string, string>(stack, 'func', async (input) => { return "hi" });
   *
   * new StepFunction(stack, 'sfn', async () => {
   *    // invalid
   *    const f = func();
   *    // valid
   *    const ff = await func();
   *    // valid
   *    return func();
   * });
   *
   * new AppsyncResolver(stack, 'resolver', async () => {
   *    // invalid
   *    const f = func();
   *    // valid
   *    const ff = await func();
   *    // valid
   *    return func();
   * })
   *
   * new AwsMethod(
   *    ...,
   *    async () => {
   *       // invalid
   *       const f = func();
   *       // valid
   *       const ff = await func();
   *       // valid
   *       return func();
   *    }
   * );
   * ```
   *
   * Some Resources like {@link Function} support synchronous or asynchronous handing of Integrations.
   *
   * ```ts
   * new Function(stack, 'func2' , async () => {
   *    // valid
   *    const f = func();
   *    // valid
   *    const ff = await func();
   *    const fDone = await f;
   *    // valid
   *    return func();
   * });
   * ```
   *
   * > In the case of {@link Function}, any valid NodeJS `Promise` feature is supported.
   */
  export const Integration_must_be_immediately_awaited_or_returned: ErrorCode =
    {
      code: 10015,
      type: ErrorType.ERROR,
      title: "Integration must be immediately awaited or returned",
    };

  /**
   * Arrays of integrations within {@link StepFunction}, {@link ExpressStepFunction} must be immediately wrapped in Promise.all.
   *
   * These services support concurrent invocation, but do not support manipulation of the references.
   *
   * ```ts
   * const func = new Function<string, string>(stack, 'func', async (input) => { return "hi" });
   *
   * new StepFunction(stack, 'sfn, async () => {
   *    // invalid
   *    const f = [1,2].map(await () => func());
   *    // valid
   *    const ff = await Promise.all([1,2].map(await () => func()));
   *    // valid
   *    return Promise.all([1,2].map(await () => func()));
   * });
   * ```
   *
   * Some Resources like {@link Function} support synchronous or asynchronous handing of Integrations.
   *
   * ```ts
   * new Function(stack, 'func2', async () => {
   *    // valid
   *    const f = [1,2].map(await () => func())
   *    const f2 = [1,2].map(await () => func());;
   *    return Promise.all([...f, ...f2]);
   * });
   * ```
   *
   * > In the case of {@link Function}, any valid NodeJS `Promise` feature is supported.
   */
  export const Arrays_of_Integration_must_be_immediately_wrapped_in_Promise_all: ErrorCode =
    {
      code: 10016,
      type: ErrorType.ERROR,
      title: "Arrays of Integration must be immediately wrapped in Promise.all",
    };
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
