import fs from "fs";
import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import {
  AnyAsyncFunction,
  AnyFunction,
  BindFunctionName,
  CallExpr,
  Expr,
  findDeepReferences,
  FunctionLike,
  RegisterFunctionName,
} from "@functionless/ast";
import { serializeFunction } from "@functionless/nodejs-closure-serializer";
import {
  AssetHashType,
  aws_apigateway,
  aws_dynamodb,
  aws_events_targets,
  aws_lambda,
  CfnResource,
  DockerImage,
  IResolvable,
  Lazy,
  Reference,
  Resource,
  SecretValue,
  TagManager,
  Token,
  Tokenization,
} from "aws-cdk-lib";
import { IDestination } from "aws-cdk-lib/aws-lambda";
import {
  EventBridgeDestination,
  LambdaDestination,
} from "aws-cdk-lib/aws-lambda-destinations";
import type { Context } from "aws-lambda";
// eslint-disable-next-line import/no-extraneous-dependencies
import { Construct } from "constructs";
import esbuild from "esbuild";
import ts from "typescript";
import {
  ApiGatewayIntegration,
  ApiGatewayVtlIntegration,
} from "@functionless/aws-apigateway";
import {
  AppSyncIntegration,
  AppSyncVtlIntegration,
} from "@functionless/aws-appsync";
import { ASL, ASLGraph } from "@functionless/asl";
import {
  ErrorCodes,
  formatErrorMessage,
  SynthError,
} from "@functionless/error-code";
import {
  Event,
  EventBusTargetIntegration,
  EventBusIntegration,
} from "@functionless/aws-events";
import {
  isEventBus,
  IEventBus,
  Rule,
  PredicateRuleBase,
  isEventBusConstruct,
} from "@functionless/aws-events-constructs";
import { ReflectionSymbols, validateFunctionLike } from "@functionless/ast";
import { isSecret } from "@functionless/aws-secretsmanager-constructs";
import {
  serializeClosure,
  serializeCodeWithSourceMap,
} from "@functionless/serialize-closure";
import { isStepFunctionConstruct } from "@functionless/aws-stepfunctions-constructs";
import { isTableConstruct } from "@functionless/aws-dynamodb-constructs";
import {
  isNativeIntegration,
  LambdaClient,
  NativeIntegration,
  NativeRuntimeEnvironment,
  NativeRuntimeEnvironmentProps,
} from "@functionless/aws-lambda";

export const isIntegration = (i: any): i is any =>
  typeof i === "object" && "kind" in i;

export function isFunctionConstruct<Payload = any, Output = any>(
  a: any
): a is IFunction<Payload, Output> {
  return a?.kind === "Function";
}

export type AnyLambda = Function<any, any>;

export interface FunctionEventBusTargetProps
  extends Omit<aws_events_targets.LambdaFunctionProps, "event"> {}

export type FunctionClosure<in Payload, out Output> = (
  payload: Payload,
  context: Context
) => Promise<Output>;

const FUNCTION_CLOSURE_FLAG = "__functionlessClosure";

/**
 * Returns the payload type on the {@link IFunction}.
 */
export type FunctionPayloadType<Func extends IFunction<any, any>> = [
  Func
] extends [IFunction<infer P, any>]
  ? P
  : never;
/**
 * Returns the output type on the {@link IFunction}.
 */
export type FunctionOutputType<Func extends IFunction<any, any>> = [
  Func
] extends [IFunction<any, infer O>]
  ? O
  : never;

type FunctionAsyncOnFailureDestination<Payload> =
  | aws_lambda.FunctionProps["onFailure"]
  | IEventBus<AsyncResponseFailureEvent<Payload>>
  | IFunction<AsyncResponseFailure<Payload>, any>;

type FunctionAsyncOnSuccessDestination<Payload, Output> =
  | aws_lambda.FunctionProps["onSuccess"]
  | IEventBus<AsyncResponseSuccessEvent<Payload, Output>>
  | IFunction<AsyncResponseSuccess<Payload, Output>, any>;

/**
 * Wrapper around {@link aws_lambda.EventInvokeConfigOptions} which allows users to provide Functionless
 * {@link EventBus} and {@link Function} for the onSuccess and onFailure async event destinations.
 */
export interface EventInvokeConfigOptions<Payload, Output>
  extends Omit<aws_lambda.EventInvokeConfigOptions, "onSuccess" | "onFailure"> {
  onSuccess?: FunctionAsyncOnSuccessDestination<Payload, Output>;
  onFailure?: FunctionAsyncOnFailureDestination<Payload>;
}

/**
 * @typeParam Payload - The super-set payload type of the function.
 * @typeParam Output - The output type of the function.
 * @typeParam OutPayload - The covariant type of {@link Payload} used when the payload is output.
 *                         For example when the Payload is sent to a {@link Function} or {@link EventBus}
 *                         from onSuccess or onFailure event sources. This type parameter should be left
 *                         empty to be inferred. ex: `Function<Payload1, Output1 | Output2>`.
 */
export interface IFunction<in Payload, Output>
  extends AppSyncIntegration,
    ApiGatewayIntegration,
    EventBusIntegration<Payload, FunctionEventBusTargetProps | undefined>,
    NativeIntegration<ConditionalFunction<Payload, Output>> {
  readonly functionlessKind: typeof Function.FunctionlessType;
  readonly kind: typeof Function.FunctionlessType;
  readonly resource: aws_lambda.IFunction;

  (...args: Parameters<ConditionalFunction<Payload, Output>>): ReturnType<
    ConditionalFunction<Payload, Output>
  >;

  /**
   * Event Source for the {@link Function} onSuccess async invocation destination.
   *
   * For Lambda, the onSuccess destination is not enabled by default.
   * It must first be configured via either the {@link Function} constructor
   * or by using {@link IFunction.enableAsyncInvoke} and that destination must match the bus provided here.
   *
   * ```ts
   * const bus = new EventBus(stack, 'bus');
   * new Function(stack, 'func', { onSuccess: bus }, async () => {});
   * ```
   *
   * or
   *
   * ```ts
   * const bus = new EventBus(stack, 'bus');
   * const func = new Function(stack, 'func', async () => {});
   * // if onSuccess or onFailure is already set, this will fail.
   * func.enableAsyncInvoke({ onSuccess: bus });
   * ```
   *
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations
   *
   * The rule returned will contain the logic:
   *
   * ```ts
   * when(id, event => event.source === "lambda"
   *    && event["detail-type"] === "Lambda Function Invocation Result - Success"
   *      && event.resources.includes(this.resource.functionArn))
   * ```
   */
  onSuccess<OutPayload extends Payload>(
    bus: IEventBus<AsyncResponseSuccessEvent<OutPayload, Output>>,
    id: string
  ): Rule<AsyncResponseSuccessEvent<OutPayload, Output>>;
  /**
   * Event Source for the {@link Function} onFailure async invocation destination.
   *
   * The onFailure destination is not enabled by default.
   * It must first be configured via either the {@link Function} constructor
   * or by using {@link IFunction.enableAsyncInvoke} and that destination must match the bus provided here.
   *
   * ```ts
   * const bus = new EventBus(stack, 'bus');
   * new Function(stack, 'func', { onFailure: bus }, async () => {});
   * ```
   *
   * or
   *
   * ```ts
   * const bus = new EventBus(stack, 'bus');
   * const func = new Function(stack, 'func', async () => {});
   * // if onSuccess or onFailure is already set, this will fail.
   * func.enableAsyncInvoke({ onFailure: bus });
   * ```
   *
   * @see https://docs.aws.amazon.com/lambda/latest/dg/invocation-async.html#invocation-async-destinations
   *
   * The rule returned will contain the logic:
   *
   * ```ts
   * when(id, event => event.source === "lambda"
   *    && event["detail-type"] === "Lambda Function Invocation Result - Failure"
   *      && event.resources.includes(this.resource.functionArn))
   * ```
   */
  onFailure<OutPayload extends Payload>(
    bus: IEventBus<AsyncResponseFailureEvent<OutPayload>>,
    id: string
  ): Rule<AsyncResponseFailureEvent<OutPayload>>;

  /**
   * Set the async invocation options on a function. Can be use to enable and set the onSuccess and onFailure destinations.
   *
   * Wraps {@link aws_lambda.IFunction.configureAsyncInvoke} provided by CDK to support Functionless resources directly.
   *
   * If onSuccess or onFailure were already set either through {@link FunctionProps} or {@link IFunction.enableAsyncInvoke}
   * This method will fail.
   */
  enableAsyncInvoke<OutPayload extends Payload>(
    config: EventInvokeConfigOptions<OutPayload, Output>
  ): void;

  readonly eventBus: EventBusTargetIntegration<
    Payload,
    FunctionEventBusTargetProps | undefined
  >;
}

export interface AsyncResponseBase<P> {
  version: string;
  /**
   * ISO 8601
   */
  timestamp: string;
  requestPayload: P;
  responseContext: {
    statusCode: number;
    executedVersion: "$LATEST" | string;
    functionError: string;
  };
}

export type AsyncFunctionResponseEvent<P, O> =
  | AsyncResponseSuccessEvent<P, O>
  | AsyncResponseFailureEvent<P>;

export interface AsyncResponseSuccess<P, O> extends AsyncResponseBase<P> {
  responsePayload: O;
  requestContext: {
    requestId: string;
    functionArn: string;
    condition: "Success";
    approximateInvokeCount: number;
  };
}

export interface AsyncResponseFailure<P> extends AsyncResponseBase<P> {
  requestContext: {
    requestId: string;
    functionArn: string;
    condition: "RetriesExhausted" | "EventAgeExceeded" | string;
    approximateInvokeCount: number;
  };
  responsePayload: {
    errorMessage: string;
    errorType: string;
    stackTrace: string[];
  };
}

export interface AsyncResponseSuccessEvent<P, O>
  extends Event<
    AsyncResponseSuccess<P, O>,
    "Lambda Function Invocation Result - Success",
    "lambda"
  > {}
export interface AsyncResponseFailureEvent<P>
  extends Event<
    AsyncResponseFailure<P>,
    "Lambda Function Invocation Result - Failure",
    "lambda"
  > {}

abstract class FunctionBase<in Payload, Out>
  implements IFunction<Payload, Out>
{
  readonly kind = "Function" as const;
  readonly native: NativeIntegration<ConditionalFunction<Payload, Out>>;
  readonly functionlessKind = "Function";
  public static readonly FunctionlessType = "Function";

  readonly appSyncVtl: AppSyncVtlIntegration;
  readonly apiGWVtl: ApiGatewayVtlIntegration;

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: ConditionalFunction<Payload, Out>;

  constructor(readonly resource: aws_lambda.IFunction) {
    const functionName = this.resource.functionName;

    // Native is used when this function is called from another lambda function's serialized closure.
    // define this here to closure the functionName without using `this`
    this.native = {
      /**
       * Wire up permissions for this function to be called by the calling function
       */
      bind: (context) => {
        this.resource.grantInvoke(context);
      },
      /**
       * Code that runs once per lambda invocation
       * The pre-warm client supports singleton invocation of clients (or other logic) across all integrations in the caller function.
       */
      preWarm: (preWarmContext: NativeRuntimeEnvironment) => {
        preWarmContext.getOrInit(LambdaClient);
      },
      /**
       * This method is called from the calling runtime lambda code (context) to invoke this lambda function.
       */
      // @ts-ignore - Typescript fails when comparing Promise<O> with ReturnType<ConditionalFunction<P, O>> though they should be the same.
      call: async (args, prewarmContext) => {
        const [payload] = args;
        const lambdaClient = prewarmContext.getOrInit<AWS.Lambda>(LambdaClient);
        const response = (
          await lambdaClient
            .invoke({
              FunctionName: functionName,
              ...(payload ? { Payload: JSON.stringify(payload) } : undefined),
            })
            .promise()
        ).Payload?.toString();
        return (response ? JSON.parse(response) : undefined) as Out;
      },
    };

    this.appSyncVtl = <AppSyncVtlIntegration>{
      dataSourceId: () => resource.node.addr,
      dataSource(api, id) {
        return new appsync.LambdaDataSource(api, id, {
          api,
          lambdaFunction: resource,
        });
      },
      request(call, context) {
        const payloadArg = call.args[0]?.expr;
        const payload = payloadArg ? context.eval(payloadArg) : "$null";

        const request = context.var(
          `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
        );
        return context.json(request);
      },
    };

    this.apiGWVtl = {
      renderRequest: (call, context) => {
        const payloadArg = call.args[0]?.expr;
        return payloadArg ? context.exprToJson(payloadArg) : "$null";
      },

      createIntegration: (options) => {
        this.resource.grantInvoke(options.credentialsRole);
        return new aws_apigateway.LambdaIntegration(this.resource, {
          ...options,
          proxy: false,
          passthroughBehavior: aws_apigateway.PassthroughBehavior.NEVER,
        });
      },
    };
  }

  public readonly eventBus: EventBusTargetIntegration<
    Payload,
    FunctionEventBusTargetProps | undefined
  > = {
    __payloadBrand: undefined as any,
    target: (props: any, targetInput: any) =>
      new aws_events_targets.LambdaFunction(this.resource, {
        ...props,
        event: targetInput,
      }),
  } as any;

  public asl(call: CallExpr, context: ASL) {
    const payloadArg = call.args[0]?.expr;
    this.resource.grantInvoke(context.role);

    return payloadArg
      ? context.evalExprToJsonPathOrLiteral(payloadArg, (output) => {
          return context.stateWithHeapOutput(
            ASLGraph.taskWithInput(
              {
                Type: "Task",
                Resource: this.resource.functionArn,
                Next: ASLGraph.DeferNext,
              },
              output
            )
          );
        })
      : context.stateWithHeapOutput(
          ASLGraph.taskWithInput(
            {
              Type: "Task",
              Resource: this.resource.functionArn,
              Next: ASLGraph.DeferNext,
            },
            { jsonPath: context.context.null }
          )
        );
  }

  protected static normalizeAsyncDestination<P, O>(
    destination:
      | FunctionAsyncOnSuccessDestination<P, O>
      | FunctionAsyncOnFailureDestination<P>
  ): IDestination | undefined {
    return destination === undefined
      ? undefined
      : isEventBusConstruct<
          | IEventBus<AsyncResponseSuccessEvent<P, O>>
          | IEventBus<AsyncResponseFailureEvent<P>>
        >(destination)
      ? new EventBridgeDestination(destination.resource)
      : isFunctionConstruct<
          FunctionPayloadType<Extract<typeof destination, IFunction<any, any>>>,
          FunctionOutputType<Extract<typeof destination, IFunction<any, any>>>
        >(destination)
      ? new LambdaDestination(destination.resource)
      : destination;
  }

  public enableAsyncInvoke<OutPayload extends Payload>(
    config: EventInvokeConfigOptions<OutPayload, Out>
  ): void {
    this.resource.configureAsyncInvoke({
      ...config,
      onSuccess: FunctionBase.normalizeAsyncDestination<OutPayload, Out>(
        config.onSuccess
      ),
      onFailure: FunctionBase.normalizeAsyncDestination<OutPayload, Out>(
        config.onFailure
      ),
    });
  }

  public onSuccess<OutPayload extends Payload>(
    bus: IEventBus<AsyncResponseSuccessEvent<OutPayload, Out>>,
    id: string
  ): Rule<AsyncResponseSuccessEvent<OutPayload, Out>> {
    return new PredicateRuleBase<AsyncResponseSuccessEvent<OutPayload, Out>>(
      bus.resource,
      id,
      bus,
      /**
       * when(event => event.source === "lambda"
       *    && event["detail-type"] === "Lambda Function Invocation Result - Success"
       *      && event.resources.includes(this.resource.functionArn))
       */
      {
        doc: {
          source: { value: "lambda" },
          "detail-type": {
            value: "Lambda Function Invocation Result - Success",
          },
          resources: { value: this.resource.functionArn },
        },
      }
    );
  }

  public onFailure<OutPayload extends Payload>(
    bus: IEventBus<AsyncResponseFailureEvent<OutPayload>>,
    id: string
  ): Rule<AsyncResponseFailureEvent<OutPayload>> {
    return new PredicateRuleBase<AsyncResponseFailureEvent<OutPayload>>(
      bus.resource,
      id,
      bus,
      /**
       * when(event => event.source === "lambda"
       *    && event["detail-type"] === "Lambda Function Invocation Result - Failure"
       *      && event.resources.includes(this.resource.functionArn))
       */
      {
        doc: {
          source: { value: "lambda" },
          "detail-type": {
            value: "Lambda Function Invocation Result - Failure",
          },
          resources: { value: this.resource.functionArn },
        },
      }
    );
  }
}

interface FunctionBase<in Payload, Out> {
  (...args: Parameters<ConditionalFunction<Payload, Out>>): ReturnType<
    ConditionalFunction<Payload, Out>
  >;
}

export enum SerializerImpl {
  /**
   * The default serializer, uses the v8 inspector API to introspect closures.
   *
   * It is slow and has caveats such as not properly serializing stable references to variables.
   *
   * @see https://github.com/functionless/nodejs-closure-serializer
   */
  V1,
  /**
   * A new experimental serializer that makes use of Functionless's SWC AST
   * reflection library that decorates syntax for use at runtime.
   *
   * It has not been as well tested, but is fast, synchronous and has support for
   * stable references and other features.
   *
   * @see https://www.npmjs.com/package/@functionless/ast-reflection
   */
  V2,
  Default = V1,
}

const PromisesSymbol = Symbol.for("functionless.Function.promises");

export interface FunctionProps<in P = any, O = any, OutP extends P = P>
  extends Omit<
    aws_lambda.FunctionProps,
    "code" | "handler" | "runtime" | "onSuccess" | "onFailure"
  > {
  /**
   * Whether to generate source maps for serialized closures and
   * to set --enableSourceMaps on NODE_OPTIONS environment variable.
   *
   * Only supported when using {@link SerializerImpl.V2}.
   *
   * @default true
   */
  sourceMaps?: boolean;
  /**
   * Which {@link SerializerImpl} to use when serializing closures.
   *
   * @default {@link SerializerImpl.V1}
   */
  serializer?: SerializerImpl;
  /**
   * Method which allows runtime computation of AWS client configuration.
   * ```ts
   * new Lambda(clientConfigRetriever('LAMBDA'))
   * ```
   *
   * @param clientName optionally return a different client config based on the {@link ClientName}.
   *
   */
  clientConfigRetriever?: NativeRuntimeEnvironmentProps["clientConfigRetriever"];
  /**
   * The destination for failed invocations.
   *
   * Supports use of Functionless {@link IEventBus} or {@link IFunction}.
   *
   * ```ts
   * const bus = new EventBus<>
   * ```
   *
   * @default - no destination
   */
  onSuccess?: FunctionAsyncOnSuccessDestination<OutP, O>;
  /**
   * The destination for successful invocations.
   *
   * @default - no destination
   */
  onFailure?: FunctionAsyncOnFailureDestination<OutP>;
}

/**
 * A type-safe NodeJS Lambda Function generated from the closure provided.
 *
 * Can be called from within an {@link AppsyncResolver}.
 *
 * For example:
 * ```ts
 * const getPerson = new Function<string, Person>(stack, 'func', async () => {
 *  // get person logic
 * });
 *
 * new AppsyncResolver(() => {
 *   return getPerson("value");
 * })
 * ```
 *
 * Can wrap an existing {@link aws_lambda.Function}.
 *
 * ```ts
 * const getPerson = Function.fromFunction<string, Person>(
 *   new aws_lambda.Function(..)
 * );
 * ```
 */
export class Function<
  in Payload,
  Out = any,
  OutPayload extends Payload = Payload
> extends FunctionBase<Payload, Out> {
  /**
   * Dangling promises which are processing Function handler code from the function serializer.
   * To correctly resolve these for CDK synthesis, either use `asyncSynth()` or use `cdk synth` in the CDK cli.
   * https://twitter.com/samgoodwin89/status/1516887131108438016?s=20&t=7GRGOQ1Bp0h_cPsJgFk3Ww
   */
  public static readonly promises: Promise<void>[] = ((global as any)[
    PromisesSymbol
  ] = (global as any)[PromisesSymbol] ?? []);

  /**
   * Wrap a {@link aws_lambda.Function} with Functionless.
   *
   * A wrapped function can be invoked, but the code is provided in the CDK Construct.
   */
  public static fromFunction<Payload = any, Out = any>(
    func: aws_lambda.IFunction
  ): ImportedFunction<Payload, Out> {
    return new ImportedFunction<Payload, Out>(func);
  }

  /**
   * Create a lambda function using a native typescript closure.
   *
   * ```ts
   * new Function<{ val: string }, string>(this, 'myFunction', async (event) => event.val);
   * ```
   */
  constructor(
    scope: Construct,
    id: string,
    func: FunctionClosure<Payload, Out>
  );
  constructor(
    scope: Construct,
    id: string,
    props: FunctionProps<Payload, Out, OutPayload>,
    func: FunctionClosure<Payload, Out>
  );
  /**
   * @private
   */
  constructor(
    resource: Construct,
    id: string,
    propsOrFunc:
      | FunctionProps<Payload, Out, OutPayload>
      | FunctionClosure<Payload, Out>,
    funcOrNothing?: FunctionClosure<Payload, Out>,
    magic?: any
  ) {
    const func =
      typeof propsOrFunc === "function" ? propsOrFunc : funcOrNothing;

    if (!func) {
      throw new SynthError(
        ErrorCodes.Unexpected_Error,
        "Unexpected error: expected a function closure."
      );
    }

    const ast = validateFunctionLike(magic ? magic : func, "Function");

    const props =
      typeof propsOrFunc === "function"
        ? undefined
        : (propsOrFunc as FunctionProps<Payload, Out, OutPayload>);

    const callbackLambdaCode = new CallbackLambdaCode(func, {
      clientConfigRetriever: props?.clientConfigRetriever,
    });
    const { onSuccess, onFailure, ...restProps } = props ?? {};
    const _resource = new aws_lambda.Function(resource, id!, {
      ...restProps,
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: callbackLambdaCode,
      onSuccess: FunctionBase.normalizeAsyncDestination<OutPayload, Out>(
        onSuccess
      ),
      onFailure: FunctionBase.normalizeAsyncDestination<OutPayload, Out>(
        onFailure
      ),
      environment: {
        ...(props?.environment ?? {}),
        ...(props?.sourceMaps !== false
          ? {
              // merge --enableSourceMaps
              NODE_OPTIONS: `--enable-source-maps${
                props?.environment?.NODE_OPTIONS
                  ? ` ${props.environment.NODE_OPTIONS}`
                  : ""
              }`,
            }
          : {}),
        functionless_infer: Lazy.string({
          produce: () => {
            inferIamPolicies(ast, _resource);

            return "DONE";
          },
        }),
      },
    });

    super(_resource);

    // retrieve all found native integrations. Will fail if the integration does not support native integration.
    // TODO: move this logic into the synthesis phase, see https://github.com/functionless/functionless/issues/476
    const nativeIntegrationsPrewarm = findAllIntegrations(ast).flatMap(
      ({ integration }) => {
        const native = integration.native;
        if (native.preWarm) {
          return [native.preWarm];
        } else {
          return [];
        }
      }
    );

    // Start serializing process, add the callback to the promises so we can later ensure completion
    Function.promises.push(
      (async () => {
        const serializerImpl = props?.serializer ?? SerializerImpl.Default;
        const sourceMaps =
          props?.sourceMaps ??
          // if using SWC serializer, enable source maps by default
          // otherwise disable by default
          (serializerImpl === SerializerImpl.V2 ? true : false);
        try {
          await callbackLambdaCode.generate(
            nativeIntegrationsPrewarm,
            serializerImpl,
            sourceMaps
          );
        } catch (e) {
          if (e instanceof SynthError) {
            throw new SynthError(
              e.code,
              `While serializing ${_resource.node.path}:\n\n${e.message}`
            );
          } else if (e instanceof Error) {
            throw Error(
              `While serializing ${_resource.node.path}:\n\n${e.message}`
            );
          } else {
            throw e;
          }
        }
      })()
    );

    /**
     * Poison pill that forces Function synthesis to fail when the closure serialization has not completed.
     * Closure synthesis runs async, but CDK does not normally support async.
     * In order for the synthesis to complete successfully
     * 1. Use autoSynth `new App({ autoSynth: true })` or `new App()` with the CDK Cli (`cdk synth`)
     * 2. Use `await asyncSynth(app)` exported from Functionless in place of `app.synth()`
     * 3. Manually await on the closure serializer promises `await Promise.all(Function.promises)`
     * https://github.com/functionless/functionless/issues/128
     */
    _resource.node.addValidation({
      validate: () =>
        this.resource.node.metadata.find(
          (m) => m.type === FUNCTION_CLOSURE_FLAG
        )
          ? []
          : [
              formatErrorMessage(
                ErrorCodes.Function_Closure_Serialization_Incomplete
              ),
            ],
    });
  }
}

export function inferIamPolicies(
  decl: FunctionLike<AnyFunction>,
  func: aws_lambda.IFunction
) {
  findAllIntegrations(decl).forEach(({ integration, args }) => {
    integration.native.bind(func, args);
  });
}

export interface IntegrationInvocation {
  integration: {
    native: NativeIntegration<AnyFunction>;
  };
  args: Expr[];
}

export function findAllIntegrations(decl: FunctionLike<AnyFunction>) {
  return findDeepReferences(decl, isNativeIntegration).map(
    (i) =>
      <IntegrationInvocation>{
        args: i.args,
        integration: i.expr.ref(),
      }
  );
}

/**
 * A {@link Function} which wraps a CDK function.
 *
 * An imported function can be invoked, but the code is provided in the CDK Construct.
 */
export class ImportedFunction<Payload, Out> extends FunctionBase<Payload, Out> {
  /**
   * Use {@link Function.fromFunction}
   * @internal
   */
  constructor(func: aws_lambda.IFunction) {
    return super(func) as unknown as ImportedFunction<Payload, Out>;
  }
}

type ConditionalFunction<Payload, Out> = [Payload] extends [undefined]
  ? (payload?: Payload) => Promise<Out>
  : (payload: Payload) => Promise<Out>;

interface CallbackLambdaCodeProps extends NativeRuntimeEnvironmentProps {}

/**
 * A special lambda code wrapper that serializes whatever closure it is given.
 *
 * Caveat: Relies on async functions which may not finish when using CDK's app.synth()
 *
 * Ensure the generate function's promise is completed using something like Lambda.promises and the `asyncSynth` function.
 *
 * Use:
 * * Initialize the {@link CallbackLambdaCode} `const code = new CallbackLambdaCode()`
 * * First bind the code to a Function `new aws_lambda.Function(..., { code })`
 * * Then call generate `const promise = code.generate(integrations)`
 *
 */
export class CallbackLambdaCode extends aws_lambda.Code {
  private scope: Construct | undefined = undefined;

  constructor(
    private func: AnyAsyncFunction,
    private props: CallbackLambdaCodeProps
  ) {
    super();
  }

  public bind(scope: Construct): aws_lambda.CodeConfig {
    this.scope = scope;
    // Lets give the function something lightweight while we process the closure.
    // https://github.com/functionless/functionless/issues/128
    return aws_lambda.Code.fromInline(
      "If you are seeing this in your lambda code, ensure generate is called, then consult the README, and see https://github.com/functionless/functionless/issues/128."
    ).bind(scope);
  }

  /**
   * Thanks to cloudy for the help getting this to work.
   * https://github.com/skyrpex/cloudy/blob/main/packages/cdk/src/aws-lambda/callback-function.ts#L518-L540
   * https://twitter.com/samgoodwin89/status/1516887131108438016?s=20&t=7GRGOQ1Bp0h_cPsJgFk3Ww
   */
  public async generate(
    integrationPrewarms: NativeIntegration<AnyFunction>["preWarm"][],
    serializerImpl: SerializerImpl,
    sourceMaps: boolean
  ) {
    if (!this.scope) {
      throw new SynthError(
        ErrorCodes.Unexpected_Error,
        "Must first be bound to a Construct using .bind()."
      );
    }

    const scope = this.scope;

    if (!(scope instanceof aws_lambda.Function)) {
      throw new SynthError(
        ErrorCodes.Unexpected_Error,
        "CallbackLambdaCode can only be used on aws_lambda.Function"
      );
    }

    const [serialized, tokens] = await serialize(
      this.func,
      integrationPrewarms,
      serializerImpl,
      this.props
    );
    const bundledPackage = await bundle(serialized, sourceMaps);
    const bundled = bundledPackage.contents;

    const asset = aws_lambda.Code.fromAsset("", {
      assetHashType: AssetHashType.OUTPUT,
      bundling: {
        image: DockerImage.fromRegistry("empty"),
        // This forces the bundle directory and cache key to be unique. It does nothing else.
        user: scope.node.addr,
        local: {
          tryBundle(outdir, _opts) {
            fs.writeFileSync(path.resolve(outdir, "index.js"), bundled);
            return true;
          },
        },
      },
    });

    tokens.forEach((t) => {
      scope.addEnvironment(t.env, t.token);
    });

    const funcResource = scope.node.findChild(
      "Resource"
    ) as aws_lambda.CfnFunction;

    const codeConfig = asset.bind(scope);

    funcResource.code = {
      s3Bucket: codeConfig.s3Location?.bucketName,
      s3Key: codeConfig.s3Location?.objectKey,
      s3ObjectVersion: codeConfig.s3Location?.objectVersion,
      zipFile: codeConfig.inlineCode,
      imageUri: codeConfig.image?.imageUri,
    };

    asset.bindToResource(funcResource);

    // Clear the poison pill that causes the Function to fail synthesis.
    scope.node.addMetadata(FUNCTION_CLOSURE_FLAG, true);
  }
}

interface TokenContext {
  token: string;
  // env variables must start with a alpha character
  env: `env__functionless${string}`;
}

/**
 * Serializes a function to a string, extracting tokens and replacing some objects with a simpler form.
 */
export async function serialize(
  func: AnyAsyncFunction,
  integrationPrewarms: NativeIntegration<AnyFunction>["preWarm"][],
  serializerImpl: SerializerImpl = SerializerImpl.Default,
  props?: NativeRuntimeEnvironmentProps
): Promise<[string, TokenContext[]]> {
  let tokens: string[] = [];
  const preWarmContext = new NativeRuntimeEnvironment(props);

  const f = func;

  const preWarms = integrationPrewarms;
  const result =
    serializerImpl === SerializerImpl.V2
      ? serializeCodeWithSourceMap(
          serializeClosure(
            integrationPrewarms.length > 0
              ? () => {
                  preWarms.forEach((i) => i?.(preWarmContext));
                  return f;
                }
              : f,
            {
              shouldCaptureProp,
              serialize: serializeHook,
              isFactoryFunction: integrationPrewarms.length > 0,
            }
          )
        )
      : (
          await serializeFunction(
            // factory function allows us to prewarm the clients and other context.
            integrationPrewarms.length > 0
              ? () => {
                  integrationPrewarms.forEach((i) => i?.(preWarmContext));
                  return func;
                }
              : func,
            {
              isFactoryFunction: integrationPrewarms.length > 0,
              transformers: [
                (ctx) =>
                  /**
                   * TS Transformer for erasing calls to the generated `register` and `bind` functions
                   * from all emitted closures.
                   */
                  function eraseBindAndRegister(node: ts.Node): ts.Node {
                    if (
                      ts.isCallExpression(node) &&
                      ts.isIdentifier(node.expression)
                    ) {
                      if (node.expression.text === RegisterFunctionName) {
                        // register(func, ast)
                        // => func
                        return ts.visitEachChild(
                          node.arguments[0]!,
                          eraseBindAndRegister,
                          ctx
                        );
                      } else if (node.expression.text === BindFunctionName) {
                        // bind(func, self, ...args)
                        // => func.bind(self, ...args)
                        return ts.factory.createCallExpression(
                          eraseBindAndRegister(
                            node.arguments[0]!
                          ) as ts.Expression,
                          undefined,
                          node.arguments.map(
                            (arg) => eraseBindAndRegister(arg) as ts.Expression
                          )
                        );
                      }
                    }
                    return ts.visitEachChild(node, eraseBindAndRegister, ctx);
                  },
              ],
              serialize: serializeHook,
              shouldCaptureProp,
            }
          )
        ).text;

  /**
   * A map of token id to unique index.
   * Keeps the serialized function rom changing when the token IDs change.
   */
  const tokenIdLookup = new Map<string, number>();

  const tokenContext: TokenContext[] = tokens.map((t, i) => {
    const id = /\${Token\[.*\.([0-9]*)\]}/g.exec(t)?.[1];
    if (!id) {
      throw Error("Unrecognized token format, no id found: " + t);
    }

    const envId =
      id in tokenIdLookup
        ? tokenIdLookup.get(id)
        : tokenIdLookup.set(id, i).get(id);

    return {
      token: t,
      // env variables must start with a alpha character
      env: `env__functionless${envId}`,
    };
  });

  // replace all tokens in the form "${Token[{anything}.{id}]}" -> process.env.env__functionless{id}
  // this doesn't solve for tokens like "arn:${Token[{anything}.{id}]}:something" -> "arn:" + process.env.env__functionless{id} + ":something"
  const resultText = tokenContext.reduce(
    // TODO: support templated strings
    (r, t) => r.split(`"${t.token}"`).join(`process.env.${t.env}`),
    result
  );

  return [resultText, tokenContext];

  function shouldCaptureProp(
    _: any,
    propName: string | symbol | number
  ): boolean {
    // do not serialize the AST property on functions
    return propName !== ReflectionSymbols.AST;
  }

  function serializeHook(obj: any): any {
    if (typeof obj === "string") {
      const reversed =
        Tokenization.reverse(obj, { failConcat: false }) ??
        Tokenization.reverseString(obj).tokens;
      if (!Array.isArray(reversed) || reversed.length > 0) {
        if (Array.isArray(reversed)) {
          tokens = [
            ...tokens,
            ...reversed.map((s) => validateResolvable(s).toString()),
          ];
        } else {
          tokens = [...tokens, validateResolvable(reversed).toString()];
        }
      }
    } else if (typeof obj === "object") {
      return obj
        ? transformIntegration(transformResource(transformCfnResource(obj)))
        : obj;

      /**
       * Remove unnecessary fields from {@link CfnResource} that bloat or fail the closure serialization.
       */
      function transformCfnResource(o: unknown) {
        if (Resource.isResource(o as any)) {
          const { node, stack, env, ...rest } = o as unknown as Resource;
          return rest;
        } else if (CfnResource.isCfnResource(o as any)) {
          const {
            stack,
            node,
            creationStack,
            // don't need to serialize at runtime
            _toCloudFormation,
            // @ts-ignore - private - adds the tag manager, which we don't need
            cfnProperties,
            ...rest
          } = transformTable(o as CfnResource);
          return transformTaggableResource(rest);
        } else if (Token.isUnresolved(o)) {
          const reversed = validateResolvable(Tokenization.reverse(o)!);

          if (Reference.isReference(reversed)) {
            tokens.push(reversed.toString());
            return reversed.toString();
          } else if (SecretValue.isSecretValue(reversed)) {
            throw new SynthError(
              ErrorCodes.Unsafe_use_of_secrets,
              "Found unsafe use of SecretValue token in a Function."
            );
          } else if ("value" in reversed) {
            return (reversed as unknown as { value: any }).value;
          }
          // TODO: fail at runtime and warn at compiler time when a token cannot be serialized
          return {};
        }
        return o;
      }

      /**
       * When the StreamArn attribute is used in a Cfn template, but streamSpecification is
       * undefined, then the deployment fails. Lets make sure that doesn't happen.
       */
      function transformTable(o: CfnResource): CfnResource {
        if (
          o.cfnResourceType === aws_dynamodb.CfnTable.CFN_RESOURCE_TYPE_NAME
        ) {
          const table = o as aws_dynamodb.CfnTable;
          if (!table.streamSpecification) {
            const { attrStreamArn, ...rest } = table;

            return rest as unknown as CfnResource;
          }
        }

        return o;
      }

      /**
       * CDK Tag manager bundles in ~200kb of junk we don't need at runtime,
       */
      function transformTaggableResource(o: any) {
        if (TagManager.isTaggable(o)) {
          const { tags, ...rest } = o;
          return rest;
        }
        return o;
      }

      /**
       * Remove unnecessary fields from {@link CfnTable} that bloat or fail the closure serialization.
       */
      function transformIntegration(integ: unknown): any {
        if (integ && isIntegration(integ)) {
          // @ts-ignore
          const c = integ.native?.call;
          const call =
            typeof c !== "undefined"
              ? function (...args: any[]) {
                  return c(args, preWarmContext);
                }
              : function () {
                  throw new Error();
                };

          for (const prop in integ) {
            if (!INTEGRATION_TYPE_KEYS.includes(prop as any)) {
              // @ts-ignore
              call[prop] = integ[prop];
            }
          }

          return call;
        }
        return integ;
      }

      /**
       * TODO, make this configuration based.
       * https://github.com/functionless/functionless/issues/239
       */
      function transformResource(integ: unknown): any {
        if (isTableConstruct(integ)) {
          const { resource, appsync, ...rest } = integ as any;
          return rest;
        } else if (
          integ &&
          (isFunctionConstruct(integ) ||
            isStepFunctionConstruct(integ) ||
            isEventBus(integ) ||
            isEventBusConstruct(integ) ||
            isSecret(integ))
        ) {
          const { resource, ...rest } = integ as any;
          return rest;
        }
        return integ;
      }
    }
    return true;

    function validateResolvable(resolvable: IResolvable) {
      if (Token.isUnresolved(resolvable)) {
        const tokenSource = Tokenization.reverse(resolvable)!;
        if (SecretValue.isSecretValue(tokenSource)) {
          throw new SynthError(
            ErrorCodes.Unsafe_use_of_secrets,
            "Found unsafe use of SecretValue token in a Function."
          );
        }
      }
      return resolvable;
    }
  }
}

/**
 * Bundles a serialized function with esbuild.
 */
export async function bundle(
  text: string,
  sourceMap: boolean = false
): Promise<esbuild.OutputFile> {
  const bundle = await esbuild.build({
    stdin: {
      contents: text,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    metafile: true,
    platform: "node",
    target: "node14",
    external: ["aws-sdk", "aws-cdk-lib", "esbuild"],
    sourcemap: sourceMap ? "inline" : undefined,
  });

  // a bundled output will be one file
  return bundle.outputFiles[0]!;
}

/**
 * Maintain a typesafe runtime map of integration type keys to use elsewhere.
 *
 * For example, removing all but native integration from the {@link Function} closure.
 */
const INTEGRATION_TYPES = {
  appSyncVtl: "appSyncVtl",
  apiGWVtl: "apiGWVtl",
  asl: "asl",
  native: "native",
  eventBus: "eventBus",
};

const INTEGRATION_TYPE_KEYS = Object.values(INTEGRATION_TYPES);

// to prevent the closure serializer from trying to import all of functionless.
export const deploymentOnlyModule = true;
