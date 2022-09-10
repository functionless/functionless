import type { AwsMethod } from "./api";
import { ExpressStepFunction } from "./step-function";

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
   * To workaround, use a `Function` to implement the arithmetic expression. Be aware that this comes with added cost and operational risk.
   *
   * ```ts
   * const add = new Function(scope, "add", (input: { a: number, b: number }) => input.a + input.b);
   *
   * new StepFunction(scope, id, async (input: { num: number }) => {
   *   await add({a: input.number, b: 1});
   * });
   * ```
   */
  export const Cannot_perform_arithmetic_or_bitwise_computations_on_variables_in_Step_Function: ErrorCode =
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
   * Please [report this issue](https://github.com/functionless/functionless/issues).
   */
  export const Unexpected_Error: ErrorCode = {
    code: 10005,
    type: ErrorType.ERROR,
    title: "Unexpected Error",
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
  export const Unsupported_initialization_of_resources: ErrorCode = {
    code: 10008,
    type: ErrorType.ERROR,
    title: "Unsupported initialization of Resources in a runtime closure",
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
   *        Table: table,
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
   *     Table: table,
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
   *   Table: table,
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
   *   Table: table,
   *   Key: {
   *     // etc.
   *   }
   * })
   * ```
   */
  export const Expected_an_object_literal: ErrorCode = {
    code: 10012,
    type: ErrorType.ERROR,
    title: "Expected an object literal",
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
   *       Table: table,
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
   * new EventBus(stack, 'bus').all().map(async event => ({ html: await func(event.detail.url) }));
   * ```
   *
   * Workaround - Send the event to a function.
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
   * {@link EventBus} Rules do not support Integrations.
   *
   * ```ts
   * const validate = new Function<string, string>(stack, 'validate', async (input) => {
   *    return axios.get(`https://mydomain/validate/${input}`);
   * })
   *
   * // invalid
   * new EventBus(stack, 'bus').when(async (event) => await validate(input.detail.value)).pipe(...);
   * ```
   *
   * Workaround - Send the event to a function.
   *
   * ```ts
   * // valid
   * new EventBus(stack, 'bus').all().pipe(new Function(stack, 'webpuller', async (event) => {
   *    if(await validate(event.source)) {
   *       ...
   *    }
   * });
   * ```
   */
  export const EventBus_Rules_do_not_support_Integrations: ErrorCode = {
    code: 10015,
    type: ErrorType.ERROR,
    title: "EventBus Rules do not support integrations",
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
   * new AppsyncResolver(..., async () => {
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
      code: 10016,
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
      code: 10017,
      type: ErrorType.ERROR,
      title: "Arrays of Integration must be immediately wrapped in Promise.all",
    };

  /**
   * Unsupported use of Promises
   *
   * In {@link StepFunction} and {@link ExpressStepFunction}, `Promise.all` can be used to turn an array of promises into a single promise. However, it must directly wrap a method which returns an array of promises.
   *
   * ```ts
   * const func = new Function(stack, id, async () => {});
   *
   * new StepFunction(stack, id, async () => {
   *    const c = [1,2];
   *    // invalid
   *    const p = await Promise.all(c);
   *    // valid
   *    const t = await Promise.all([1,2].map(i => func()));
   * });
   * ```
   *
   * {@link AppsyncResolver} and {@link AppsyncField} do not support `Promise.all` or arrays of `Promises`. AWS App Sync does not support concurrent or dynamic invocation of integrations.
   *
   * ```ts
   * const func = new Function(stack, id, async () => {});
   *
   * new AppsyncResolver(..., async ($context) => {
   *     // valid - series of integration invocations
   *     const t = await func();
   *     const tt = await func();
   *     // invalid - concurrent invocation
   *     const arr = await Promise.all([1,2].map(() => func()));
   *     // invalid - dynamic invocation
   *     const arr = await Promise.all($context.arguments.arr.map(() => func()));
   * });
   * ```
   */
  export const Unsupported_Use_of_Promises: ErrorCode = {
    code: 10018,
    type: ErrorType.ERROR,
    title: "Unsupported use of Promises",
  };

  /**
   * Unable to find reference out of application function.
   *
   * Functionless processes your application code to find infrastructure references, wire up permissions, build clients, and more.
   * All infrastructure must be created outside of your application logic closures.
   * References to those resources (Integrations) must be traceable back to their location outside of your application functions.
   *
   * ```ts
   * const func = new Function(...);
   *
   * new Function(stack, 'id', {
   *    // valid
   *    func();
   *    const f = func();
   *    // valid
   *    f();
   *    const a = { f };
   *    // valid
   *    a.f();
   *    // and more
   * })
   * ```
   *
   * Functionless attempts to handle all valid typescript referencing scenarios, but some may be missed.
   *
   * If this error is thrown and the reference should be valid, please [create an issue](https://github.com/functionless/functionless/issues).
   */
  export const Unable_to_find_reference_out_of_application_function: ErrorCode =
    {
      code: 10019,
      type: ErrorType.ERROR,
      title: "Unable to find reference out of application function",
    };

  /**
   * Appsync Integration invocations must be unidirectional and defined statically.
   *
   * As stated in the [AppSync Pipeline Resolvers Documents](https://docs.aws.amazon.com/appsync/latest/devguide/pipeline-resolvers.html):
   *
   * > Pipeline resolver execution flow is unidirectional and defined statically on the resolver.
   *
   * ```ts
   * const func = new Function(stack, 'id', async () => {});
   *
   * new AppsyncResolver(..., async ($context) => {
   *    // valid
   *    const f = await func();
   *    // valid
   *    await func();
   *    if($context.arguments.value) {
   *       // invalid - not statically defined
   *       await func();
   *    }
   *    while($context.arguments.value) {
   *       // invalid
   *       await func();
   *    }
   *    // valid
   *    return func();
   * });
   * ```
   *
   * Workaround:
   *
   * One workaround would be to invoke a `Function` (or {@link ExpressStepFunction}) which handles the conditional parts of the workflow.
   *
   * The result of this example would be to call the `conditionalFunc` statically and call `func` conditionally.
   *
   * ```ts
   * const func = new Function(stack, 'id', async () => {});
   *
   * const conditionalFunc = new Function(stack, 'id', async (value) => {
   *    if(value) {
   *       return func();
   *    }
   *    return null;
   * })
   *
   * new AppsyncResolver(..., async ($context) => {
   *    const conditionalResult = await conditionalFunc();
   *    return conditionalResult;
   * });
   * ```
   */
  export const Appsync_Integration_invocations_must_be_unidirectional_and_defined_statically: ErrorCode =
    {
      code: 10020,
      type: ErrorType.ERROR,
      title:
        "Appsync Integration invocations must be unidirectional and defined statically",
    };

  /**
   * Unsupported Feature
   *
   * Generic error for unsupported features.
   *
   * See error message provided for more details.
   */
  export const Unsupported_Feature: ErrorCode = {
    code: 10021,
    type: ErrorType.ERROR,
    title: "Unsupported feature",
  };

  /**
   * Step Functions does not support undefined
   *
   * In Step Functions, a property cannot be undefined when assigned to an object or passed into a state.
   *
   * For consistency, `undefined` is not allowed anytime a value is returned, for example in a ternary expression (`x ? undefined : value`).
   * The `undefined` literal is allowed for comparison. `if(x === undefined){}`.
   *
   * ```ts
   * const func = new Function(stack, 'func', () => { return undefined; })
   * new StepFunction<{ val: string | undefined }, undefined>(stack, 'sfn', async (input) => {
   *    const v = {
   *       // invalid - could be undefined
   *       val: input.val
   *    }
   *
   *    // invalid
   *    v ? undefined : "a"
   *
   *    // invalid, function outputs undefined.
   *    const output = await func();
   *
   *    // invalid - could be undefined
   *    return input.val;
   * });
   * ```
   *
   * 1. Workaround - use null instead of undefined
   *
   *    * ```ts
   * const func = new Function(stack, 'func', () => { return null; })
   * new StepFunction<{ val: string | null }, null>(stack, 'sfn', async () => {
   *    const v = {
   *       // valid
   *       val: null
   *    }
   *
   *    // valid
   *    v ? null : "a"
   *
   *    // valid, function outputs undefined.
   *    const output = await func();
   *
   *    // valid
   *    return null;
   * });
   * ```
   *
   * 2. Workaround - resolve undefined to null or a value before assignment
   *
   *    * ```ts
   * const func = new Function(stack, 'func', () => { return undefined; })
   * new StepFunction<{ val: string | undefined }, null>(stack, 'sfn', async (undefined) => {
   *    const v = {
   *       // valid - could replace null with any defined value
   *       val: input.val ?? null
   *    }
   *
   *    // valid - could replace null with any defined value
   *    const output = (await func()) ?? null;
   *
   *    // valid - could replace null with any defined value
   *    return input.val ?? null;
   * });
   * ```
   *
   * 3. Workaround - check for undefined
   *
   * ```ts
   * const func = new Function(stack, 'func', () => { return { val: undefined }; })
   * new StepFunction<{ val: string | undefined }, null>(stack, 'sfn', async (undefined) => {
   *    let v;
   *    if(input.val) {
   *        v = {
   *           val: input.val
   *        }
   *    } else {
   *        v = {}
   *    }
   *
   *    // valid - could replace null with any defined value
   *    const output = await func();
   *    const val = output ? output : null;
   *
   *    // valid - could replace null with any defined value
   *    if(input.val) {
   *       return input.val;
   *    }
   *    return null;
   * });
   * ```
   */
  export const Step_Functions_does_not_support_undefined: ErrorCode = {
    code: 10022,
    type: ErrorType.ERROR,
    title: "Step Functions does not support undefined",
  };

  /**
   * Events passed to an {@link EventBus} in a {@link StepFunction} must be one or more literal objects and may not use the spread (`...`) syntax or computed properties.
   *
   * ```ts
   * const sfn = new StepFunction(stack, "sfn", async () => {
   *   const sourceName = "source";
   *   const event = { source: "lambda", "detail-type": "type", detail: {} };
   *   // invalid
   *   await bus.putEvents(event);
   *   // invalid
   *   await bus.putEvents({ ...event });
   *   // invalid
   *   await bus.putEvents(...[event]);
   *   // invalid
   *   await bus.putEvents({
   *     [sourceName]: "lambda",
   *     "detail-type": "type",
   *     detail: {},
   *   });
   *   // valid
   *   await bus.putEvents({
   *     source: "lambda",
   *     "detail-type": "type",
   *     detail: {},
   *   });
   * });
   * ```
   *
   * Workaround - `Function` can be used to generate dynamic event collections.
   *
   * ```ts
   * const sender = new Function(stack, "sender", async (event) => {
   *   const sourceName = "source";
   *   const event = { source: "lambda", "detail-type": "type", detail: {} };
   *   await bus.putEvents(event); // valid
   *   await bus.putEvents({ ...event }); // valid
   *   await bus.putEvents(...[event]); // valid
   *   // valid
   *   await bus.putEvents({
   *     [sourceName]: "lambda",
   *     "detail-type": "type",
   *     detail: {},
   *   });
   *   // valid
   *   await bus.putEvents({
   *     source: "lambda",
   *     "detail-type": "type",
   *     detail: {},
   *   });
   * });
   *
   * const sfn = new StepFunction(stack, "sfn", async () => {
   *   const event = { source: "lambda", "detail-type": "type", detail: {} };
   *   await sender(event);
   * });
   * ```
   *
   * The limitation is due to Step Function's lack of optional or default value retrieval for fields.
   * Attempting to access a missing field in ASL leads to en error.
   * This can be fixed using Choice/Conditions to check for the existence of a single field,
   * but would take all permutations of all optional fields to support optional field at runtime.
   * Due to this limitation, we currently compute the transformation at compile time using the fields present on the literal object.
   * For more details and process see: https://github.com/functionless/functionless/issues/101.
   */
  export const StepFunctions_calls_to_EventBus_PutEvents_must_use_object_literals: ErrorCode =
    {
      code: 10023,
      type: ErrorType.ERROR,
      title:
        "StepFunctions calls to EventBus putEvents must use object literals",
    };

  /**
   * StepFunctions supports throwing errors with causes, however those errors do not support dynamic values.
   *
   * https://docs.aws.amazon.com/step-functions/latest/dg/amazon-states-language-fail-state.html
   *
   * ```ts
   * new StepFunction<{ value: undefined }, void>(this, 'sfn', async (input) => {
   *    // invalid - the error cause is not constant
   *    throw new Error(input.value);
   * });
   * ```
   *
   * Workaround - Return with the error message encoded in payload and let the machine succeed.
   *
   * ```ts
   * new StepFunction<{ value: undefined }, { error?: string }>(this, 'sfn', async (input) => {
   *    // valid
   *    return {
   *       error: input.value
   *    }
   * });
   * ```
   */
  export const StepFunctions_error_cause_must_be_a_constant: ErrorCode = {
    code: 10024,
    type: ErrorType.ERROR,
    title: "StepFunctions error cause must be a constant",
  };

  /**
   * Step Functions - Invalid Collection access.
   *
   *   1. Arrays can be accessed with numbers
   *   2. Objects can be accessed with strings
   *   3. Access Elements must be constant values - Step Functions does not support access using dynamic variables
   *
   * ```ts
   * const func = new Function(this, 'func', async () => { return { index: 0, elm: "a" }; });
   * new StepFunction(stack, 'sfn', () => {
   *    const obj = { a: "val" };
   *    // valid
   *    obj.a;
   *    // valid
   *    obj["a"];
   *    // invalid
   *    obj[await func().elm];
   *
   *    const arr = [1];
   *    // valid
   *    arr[0]
   *    // invalid
   *    arr[await func().index];
   * });
   * ```
   *
   * Workaround - use `Function`
   *
   * ```ts
   * const accessor = new Function<{ obj: [key: string]: string, acc: string }, string>(
   *    stack,
   *    'func',
   *    async (input) => {
   *       return input.obj[input.acc];
   *    }
   * );
   *
   * new StepFunction(stack, 'sfn', () => {
   *    // valid
   *    await accessor(obj, a);
   * });
   * ```
   */
  export const StepFunctions_Invalid_collection_access: ErrorCode = {
    code: 10025,
    type: ErrorType.ERROR,
    title: "StepFunctions Invalid collection access",
  };

  /**
   * StepFunctions does not support dynamic property names
   *
   * new StepFunction(stack, 'sfn', async () => {
   *    const c = "c";
   *    const {
   *       a: "valid",
   *       ["b"]: "valid",
   *       [c]: "invalid",
   *       [someMethod()] :"invalid"
   *    }
   * });
   *
   * Workaround - use `Function`
   *
   * const assign = new Function<{
   *    obj: { [key: string]: string },
   *    key: string, value: string
   * }>(stack, 'func', async (input) => {
   *     return {
   *        ...input.obj,
   *        [input.key]: input.value
   *     }
   * });
   * new StepFunction(stack, 'sfn', async () => {
   *    return await assign({}, someMethod(), "value");
   * })
   */
  export const StepFunctions_property_names_must_be_constant: ErrorCode = {
    code: 10026,
    type: ErrorType.ERROR,
    title: "StepFunction property names must be constant",
  };

  /**
   * Invalid Input
   *
   * Generic error code for when the user provided an unexpected input as documented and reflected in the types.
   *
   * See the error message for more details.
   */
  export const Invalid_Input: ErrorCode = {
    code: 10027,
    type: ErrorType.ERROR,
    title: "Invalid Input",
  };

  /**
   * AppSync supports the use of many integrations like {@link Function} and {@link StepFunction}.
   * It also supports special utility functions through {@link $util}.
   *
   * Other references to data outside of of the {@link AppsyncResolver} or {@link AppsyncField} are not supported.
   *
   * ```ts
   * const myObject = new Object();
   * const func = new Function(this, 'func', async () => { ... });
   * new AppsyncResolver(..., async () => {
   *    // invalid
   *    myObject;
   *    // valid
   *    $util.autoUlid();
   *    // valid
   *    return func();
   * });
   * ```
   */
  export const AppSync_Unsupported_Reference: ErrorCode = {
    code: 10028,
    type: ErrorType.ERROR,
    title: "AppSync Unsupported Reference",
  };

  /**
   * ApiGateway supports the use of many integrations like {@link Function} and {@link StepFunction}.
   *
   * Other references to data outside of of the {@link AwsMethod} are not supported.
   *
   * ```ts
   * const myObject = new Object();
   * const func = new Function(this, 'func', async () => { ... });
   * new AwsMethod(..., async () => {
   *    // invalid
   *    myObject;
   *    // invalid
   *    $util.autoUlid();
   *    // valid
   *    return func();
   * }, ...);
   * ```
   */
  export const ApiGateway_Unsupported_Reference: ErrorCode = {
    code: 10029,
    type: ErrorType.ERROR,
    title: "ApiGateway Unsupported Reference",
  };

  /**
   * Errors in Step Functions can only be thrown in one of two ways:
   *
   * 1. by throwing javascript's `Error` class
   * ```ts
   * throw Error("message");
   * throw new Error("message");
   * ```
   * 2. by throwing the `StepFunctionError` class
   * ```ts
   * throw new StepFunctionError("CustomErrorName", { error: "data" })
   * ```
   */
  export const StepFunction_Throw_must_be_Error_or_StepFunctionError_class: ErrorCode =
    {
      code: 10030,
      type: ErrorType.ERROR,
      title: "StepFunction throw must be Error or StepFunctionError class",
    };

  /**
   * Classes, methods and private identifiers are not yet supported by Functionless.
   *
   * To workaround, use Functions.
   *
   * ```ts
   * function foo () { .. }
   * const foo = () => { .. }
   * ```
   *
   * @see https://github.com/functionless/functionless/issues/362
   */
  export const Classes_are_not_supported: ErrorCode = {
    code: 10031,
    type: ErrorType.ERROR,
    title: "Classes are not yet supported by Functionless",
  };

  /*
   * Event Bridge does not allow for truthy comparisons.
   *
   * ```ts
   * .when(id, event => event.detail.prop)
   * ```
   *
   * To workaround, be explicit with `===`
   * ```ts
   * .when(id, event => event.detail.prop === true)
   * ```
   */
  export const EventBridge_DoesNotSupport_TruthyComparison: ErrorCode = {
    code: 10032,
    type: ErrorType.ERROR,
    title: "Event Bridge does not support a truthy comparison",
  };

  /**
   * Step Functions does not natively support dynamic object manipulation.
   *
   * Due to this limitation, `...rest` is not supported when destructuring objects.
   *
   * ```ts
   * new StepFunction(..., async () => {
   *    const value = { a: "a", b: "b", c: "c" };
   *    // valid
   *    const { a, b } = value;
   *    // invalid
   *    const { a, b, ...rest } = value;
   * });
   * ```
   *
   * In the above example, we'd expect `rest` to look like `{ c: "c" }`,
   * but Step Functions Amazon States Language does not natively support a way
   * to enumerate the fields of an object or delete fields from an object without first
   * knowing all field names in an object.
   *
   * Workaround - Explicit
   *
   * If `...rest` is being used as a convince, a work around is to just be explicit.
   *
   * ```ts
   * new StepFunction(..., async () => {
   *    const value = { a: "a", b: "b", c: "c" };
   *    // valid
   *    const { a, b } = value;
   *    // invalid
   *    const rest = { c: value.c };
   * });
   * ```
   *
   * Workaround - Lambda
   *
   * Sometimes `...rest` is used as part of the program logic, for example,
   * if some fields of an object are known while others are not
   * or to remove known fields from an object.
   *
   * ```ts
   * const extractAAndB = new Function<
   *   { a: string; b: string; [key: string]: string },
   *   { a: string; b: string; rest: { [key: string]: string } }
   * >(stack, "func", async ({ a, b, ...rest }) => ({ a, b, rest }));
   * new StepFunction(..., async () => {
   *    const value = { a: "a", b: "b", c: "c" };
   *    // valid
   *    const { a, b, rest } = await extractAAndB(value);
   * });
   * ```
   */
  export const StepFunctions_does_not_support_destructuring_object_with_rest: ErrorCode =
    {
      code: 10033,
      type: ErrorType.ERROR,
      title: "StepFunctions does not support destructuring object with rest",
    };

  /**
   * DEPRECATED - Step Function filter syntax contain the same limits as all other step function syntax.
   */
  export const StepFunction_invalid_filter_syntax: ErrorCode = {
    code: 10034,
    type: ErrorType.DEPRECATED,
    title: "StepFunction invalid filter syntax",
  };

  /**
   * StepFunctions could fail at runtime with mismatched index types.
   *
   * Javascript and Typescript support the normalization object property access
   * and array access when the index is a number or number as a string.
   *
   * Unfortunately SFN cannot repeat this normalization in an inexpensive way
   * (ex: checking all property access for correctness at runtime).
   *
   * The below is all valid typescript.
   *
   * ```ts
   * new StepFunction(stack, 'sfn', async () => {
   *    const obj = {1: "value"};
   *    const arr = [1];
   *
   *    // invalid - numeric object property access in SFN is invalid, key must be a string
   *    obj[1];
   *
   *    // invalid - string array access in SFN is invalid, index must be a number
   *    arr["0"];
   *
   *    // valid
   *    obj["1"];
   *    // valid
   *    arr[0];
   * });
   * ```
   */
  export const StepFunctions_mismatched_index_type: ErrorCode = {
    code: 10035,
    // Warn because we do not fail on this during synth, but SFN may fail during runtime.
    type: ErrorType.WARN,
    title: "StepFunctions mismatched index type.",
  };

  /**
   * The AWS SDK being used in the current resource is unsupported by that resource.
   *
   * Workaround:
   *
   * Most of the ASK APIs will work within
   */
  export const Unsupported_AWS_SDK_in_Resource: ErrorCode = {
    code: 10036,
    type: ErrorType.ERROR,
    title: "Unsupported AWS SDK in Resource.",
  };

  /**
   * Step Function Retry Invalid Input.
   *
   * `$SFN.Retry` can either retry on all errors or be given a constant,
   * array of literal objects ({@link Retry}) that determine which errors to retry on.
   * The array must have 1 or more literal {@link Retry} objects.
   *
   * ```ts
   * new StepFunction(stack, "sfn", async ()=> {
   *    // Valid
   *    await $SFN.retry(async () => func());
   *    // Valid
   *    await $SFN.retry([{ ErrorEquals: ["States.Timeout"] }], async () => func());
   *    // Valid
   *    await $SFN.retry([{ ErrorEquals: ["States.Timeout"], MaxAttempts: 5, IntervalSeconds: 2, BackoffRate: 0.5 }], async () => func());
   *    // Valid
   *    await $SFN.retry([{ ErrorEquals: ["States.Timeout"] }, { ErrorEquals: ["Lambda.TooManyRequestsException"] }], async () => func());
   *
   *    // Invalid - reference to retry objects
   *    await $SFN.retry(myRetryObjects, async () => func());
   *    // Invalid - reference to a retry object
   *    await $SFN.retry([retryObject], async () => func());
   *    // Invalid - reference to a error name
   *    await $SFN.retry([{ ErrorEquals: [ myErrorType ] }], async () => func());
   *    // Invalid - array is empty
   *    await $SFN.retry([], async () => func());
   * })
   * ```
   *
   * The limitation is due to Step Function's lack of support for dynamic paths (json paths) for retry configuration.
   *
   * https://docs.aws.amazon.com/step-functions/latest/dg/concepts-error-handling.html#error-handling-retrying-after-an-error
   */
  export const Step_Function_Retry_Invalid_Input: ErrorCode = {
    code: 10037,
    type: ErrorType.ERROR,
    title: "Step Function Retry Invalid Input.",
  };
}

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
