import fs from "fs";
import path from "path";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { serializeFunction } from "@functionless/nodejs-closure-serializer";
import {
  AssetHashType,
  aws_dynamodb,
  aws_events_targets,
  aws_lambda,
  CfnResource,
  DockerImage,
  Resource,
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
import AWS from "aws-sdk";
import { Construct } from "constructs";
import type { AppSyncVtlIntegration } from "./appsync";
import { ASL } from "./asl";
import {
  NativeFunctionDecl,
  isNativeFunctionDecl,
  IntegrationInvocation,
} from "./declaration";
import { Err, isErr } from "./error";
import {
  IEventBus,
  isEventBus,
  Event,
  Rule,
  PredicateRuleBase,
} from "./event-bridge";
import {
  EventBusEvent,
  EventBusTargetIntegration,
  makeEventBusIntegration,
} from "./event-bridge/event-bus";
import { CallExpr, Expr, isVariableReference } from "./expression";
import {
  IntegrationImpl,
  Integration,
  INTEGRATION_TYPE_KEYS,
} from "./integration";
import { AnyFunction, anyOf } from "./util";

export function isFunction<P = any, O = any>(a: any): a is IFunction<P, O> {
  return a?.kind === "Function";
}

export type AnyLambda = Function<any, any>;

export interface FunctionEventBusTargetProps
  extends Omit<aws_events_targets.LambdaFunctionProps, "event"> {}

export type FunctionClosure<P, O> = (
  payload: P,
  context: Context
) => Promise<O>;

/**
 * Returns the payload type on the {@link IFunction}.
 */
export type FunctionPayload<F extends IFunction<any, any>> = [F] extends [
  IFunction<infer P, any>
]
  ? P
  : never;
/**
 * Returns the output type on the {@link IFunction}.
 */
export type FunctionOutput<F extends IFunction<any, any>> = [F] extends [
  IFunction<any, infer O>
]
  ? O
  : never;

type FunctionAsyncOnFailureDestination<P> =
  | aws_lambda.FunctionProps["onFailure"]
  | IEventBus<AsyncResponseFailureEvent<P>>
  | IFunction<AsyncResponseFailure<P>, any>;

type FunctionAsyncOnSuccessDestination<P, O> =
  | aws_lambda.FunctionProps["onSuccess"]
  | IEventBus<AsyncResponseSuccessEvent<P, O>>
  | IFunction<AsyncResponseSuccess<P, O>, any>;

/**
 * Wrapper around {@link aws_lambda.EventInvokeConfigOptions} which allows users to provide Functionless
 * {@link EventBus} and {@link Function} for the onSuccess and onFailure async event destinations.
 */
export interface EventInvokeConfigOptions<P, O>
  extends Omit<aws_lambda.EventInvokeConfigOptions, "onSuccess" | "onFailure"> {
  onSuccess?: FunctionAsyncOnSuccessDestination<P, O>;
  onFailure?: FunctionAsyncOnFailureDestination<P>;
}

export interface IFunction<P, O>
  extends Integration<
    "Function",
    ConditionalFunction<P, O>,
    EventBusTargetIntegration<P, FunctionEventBusTargetProps | undefined>
  > {
  readonly functionlessKind: typeof Function.FunctionlessType;
  readonly kind: typeof Function.FunctionlessType;
  readonly resource: aws_lambda.IFunction;

  (...args: Parameters<ConditionalFunction<P, O>>): ReturnType<
    ConditionalFunction<P, O>
  >;

  /**
   * Event Source for the {@link Function} onSuccess async invocation destination.
   *
   * For Lambda, the onSuccess destination must first be configured via either
   * the {@link Function} constructor or by using {@link IFunction.configureAsyncInvoke}
   * and that destination must match the bus provided here.
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
  onSuccess(
    bus: IEventBus<AsyncResponseSuccessEvent<P, O>>,
    id: string
  ): Rule<AsyncResponseSuccessEvent<P, O>>;
  /**
   * Event Source for the {@link Function} onFailure async invocation destination.
   *
   * For Lambda, the onFailure destination must first be configured via either
   * the {@link Function} constructor or by using {@link IFunction.configureAsyncInvoke}
   * and that destination must match the bus provided here.
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
  onFailure(
    bus: IEventBus<AsyncResponseFailureEvent<P>>,
    id: string
  ): Rule<AsyncResponseFailureEvent<P>>;

  /**
   * Set the async invocation options on a function. Can be use to set the onSuccess and onFailure destinations.
   *
   * Wraps the method provided by {@link aws_lambda.IFunction} to support Functionless resources directly.
   *
   * If onSuccess or onFailure were already set either through {@link FunctionProps} or {@link IFunction.configureAsyncInvoke}
   * This method will fail.
   */
  configureAsyncInvoke(config: EventInvokeConfigOptions<P, O>): void;

  readonly eventBus: EventBusTargetIntegration<
    P,
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

abstract class FunctionBase<in P, O>
  implements
    IFunction<P, O>,
    Integration<"Function", ConditionalFunction<P, O>>
{
  readonly kind = "Function" as const;
  readonly native: NativeIntegration<ConditionalFunction<P, O>>;
  readonly functionlessKind = "Function";
  public static readonly FunctionlessType = "Function";

  readonly appSyncVtl: AppSyncVtlIntegration;

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: ConditionalFunction<P, O>;

  constructor(readonly resource: aws_lambda.IFunction) {
    const functionName = this.resource.functionName;

    // Native is used when this function is called from another lambda function's serialized closure.
    // define this here to closure the functionName without using `this`
    this.native = {
      /**
       * Wire up permissions for this function to be called by the calling function
       */
      bind: (context: Function<any, any>) => {
        this.resource.grantInvoke(context.resource);
      },
      /**
       * Code that runs once per lambda invocation
       * The pre-warm client supports singleton invocation of clients (or other logic) across all integrations in the caller function.
       */
      preWarm: (preWarmContext: NativePreWarmContext) => {
        preWarmContext.getOrInit(PrewarmClients.LAMBDA);
      },
      /**
       * This method is called from the calling runtime lambda code (context) to invoke this lambda function.
       */
      call: async (args, prewarmContext) => {
        const [payload] = args;
        const lambdaClient = prewarmContext.getOrInit(PrewarmClients.LAMBDA);
        const response = (
          await lambdaClient
            .invoke({
              FunctionName: functionName,
              ...(payload ? { Payload: JSON.stringify(payload) } : undefined),
            })
            .promise()
        ).Payload?.toString();
        return response ? JSON.parse(response) : undefined;
      },
    };

    this.appSyncVtl = {
      dataSourceId: () => resource.node.addr,
      dataSource(api, id) {
        return new appsync.LambdaDataSource(api, id, {
          api,
          lambdaFunction: resource,
        });
      },
      request(call, context) {
        const payloadArg = call.getArgument("payload");
        const payload = payloadArg?.expr
          ? context.eval(payloadArg.expr)
          : "$null";

        const request = context.var(
          `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
        );
        return context.json(request);
      },
    };
  }

  public asl(call: CallExpr, context: ASL) {
    const payloadArg = call.getArgument("payload")?.expr;
    this.resource.grantInvoke(context.role);
    return {
      Type: "Task" as const,
      Resource: "arn:aws:states:::lambda:invoke",
      Parameters: {
        FunctionName: this.resource.functionName,
        [`Payload${payloadArg && isVariableReference(payloadArg) ? ".$" : ""}`]:
          payloadArg ? ASL.toJson(payloadArg) : undefined,
      },
      ResultSelector: "$.Payload",
    };
  }

  protected static normalizeAsyncDestination<P, O>(
    destination:
      | FunctionAsyncOnSuccessDestination<P, O>
      | FunctionAsyncOnFailureDestination<P>
  ): IDestination | undefined {
    return destination === undefined
      ? undefined
      : isEventBus<EventBusEvent<Extract<typeof destination, IEventBus<any>>>>(
          destination
        )
      ? new EventBridgeDestination(destination.bus)
      : isFunction<
          FunctionPayload<Extract<typeof destination, IFunction<any, any>>>,
          FunctionOutput<Extract<typeof destination, IFunction<any, any>>>
        >(destination)
      ? new LambdaDestination(destination.resource)
      : destination;
  }

  public configureAsyncInvoke(config: EventInvokeConfigOptions<P, O>): void {
    this.resource.configureAsyncInvoke({
      ...config,
      onSuccess: FunctionBase.normalizeAsyncDestination<P, O>(config.onSuccess),
      onFailure: FunctionBase.normalizeAsyncDestination<P, O>(config.onFailure),
    });
  }

  public onSuccess(
    bus: IEventBus<AsyncResponseSuccessEvent<P, O>>,
    id: string
  ): Rule<AsyncResponseSuccessEvent<P, O>> {
    return new PredicateRuleBase<AsyncResponseSuccessEvent<P, O>>(
      bus.bus,
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

  public onFailure(
    bus: IEventBus<AsyncResponseFailureEvent<P>>,
    id: string
  ): Rule<AsyncResponseFailureEvent<P>> {
    return new PredicateRuleBase<AsyncResponseFailureEvent<P>>(
      bus.bus,
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

  public readonly eventBus = makeEventBusIntegration<
    P,
    FunctionEventBusTargetProps | undefined
  >({
    target: (props, targetInput) =>
      new aws_events_targets.LambdaFunction(this.resource, {
        ...props,
        event: targetInput,
      }),
  });
}

interface FunctionBase<in P, O> {
  (...args: Parameters<ConditionalFunction<P, O>>): ReturnType<
    ConditionalFunction<P, O>
  >;
}

const PromisesSymbol = Symbol.for("functionless.Function.promises");

export interface FunctionProps<P = any, O = any>
  extends Omit<
    aws_lambda.FunctionProps,
    "code" | "handler" | "runtime" | "onSuccess" | "onFailure"
  > {
  /**
   * Method which allows runtime computation of AWS client configuration.
   * ```ts
   * new Lambda(clientConfigRetriever('LAMBDA'))
   * ```
   *
   * @param clientName optionally return a different client config based on the {@link ClientName}.
   *
   */
  clientConfigRetriever?: (
    clientName: ClientName | string
  ) => Omit<AWS.Lambda.ClientConfiguration, keyof AWS.Lambda.ClientApiVersions>;
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
  onSuccess?: FunctionAsyncOnSuccessDestination<P, O>;
  /**
   * The destination for successful invocations.
   *
   * @default - no destination
   */
  onFailure?: FunctionAsyncOnFailureDestination<P>;
}

const isNativeFunctionOrError = anyOf(isErr, isNativeFunctionDecl);

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
export class Function<in P, O> extends FunctionBase<P, O> {
  /**
   * Dangling promises which are processing Function handler code from the function serializer.
   * To correctly resolve these for CDK synthesis, either use `asyncSynth()` or use `cdk synth` in the CDK cli.
   * https://twitter.com/samgoodwin89/status/1516887131108438016?s=20&t=7GRGOQ1Bp0h_cPsJgFk3Ww
   */
  public static readonly promises = ((global as any)[PromisesSymbol] =
    (global as any)[PromisesSymbol] ?? []);

  /**
   * Wrap a {@link aws_lambda.Function} with Functionless.
   *
   * A wrapped function can be invoked, but the code is provided in the CDK Construct.
   */
  public static fromFunction<P = any, O = any>(
    func: aws_lambda.IFunction
  ): ImportedFunction<P, O> {
    return new ImportedFunction<P, O>(func);
  }

  /**
   * Create a lambda function using a native typescript closure.
   *
   * ```ts
   * new Function<{ val: string }, string>(this, 'myFunction', async (event) => event.val);
   * ```
   */
  constructor(scope: Construct, id: string, func: FunctionClosure<P, O>);
  constructor(
    scope: Construct,
    id: string,
    props: FunctionProps<P, O>,
    func: FunctionClosure<P, O>
  );
  /**
   * @private
   */
  constructor(
    scope: Construct,
    id: string,
    props: FunctionProps<P, O>,
    func: NativeFunctionDecl | Err
  );
  /**
   * @private
   */
  constructor(scope: Construct, id: string, func: NativeFunctionDecl | Err);
  /**
   * Wrap an existing lambda function with Functionless.
   * @deprecated use `Function.fromFunction()`
   */
  constructor(resource: aws_lambda.IFunction);
  /**
   * @private
   */
  constructor(
    resource: aws_lambda.IFunction | Construct,
    id?: string,
    propsOrFunc?:
      | FunctionProps<P, O>
      | NativeFunctionDecl
      | Err
      | FunctionClosure<P, O>,
    funcOrNothing?: NativeFunctionDecl | Err | FunctionClosure<P, O>
  ) {
    let _resource: aws_lambda.IFunction;
    let integrations: IntegrationInvocation[] = [];
    let callbackLambdaCode: CallbackLambdaCode | undefined = undefined;
    if (id && propsOrFunc) {
      const func = isNativeFunctionOrError(propsOrFunc)
        ? propsOrFunc
        : isNativeFunctionOrError(funcOrNothing)
        ? funcOrNothing
        : undefined;
      const props = isNativeFunctionOrError(propsOrFunc)
        ? undefined
        : (propsOrFunc as FunctionProps<P, O>);

      if (isErr(func)) {
        throw func.error;
      } else if (isNativeFunctionDecl(func)) {
        callbackLambdaCode = new CallbackLambdaCode(func.closure, {
          clientConfigRetriever: props?.clientConfigRetriever,
        });
        const { onSuccess, onFailure, ...restProps } = props ?? {};
        _resource = new aws_lambda.Function(resource, id!, {
          ...restProps,
          runtime: aws_lambda.Runtime.NODEJS_14_X,
          handler: "index.handler",
          code: callbackLambdaCode,
          onSuccess: FunctionBase.normalizeAsyncDestination<P, O>(onSuccess),
          onFailure: FunctionBase.normalizeAsyncDestination<P, O>(onFailure),
        });

        integrations = func.integrations;
      } else {
        throw Error(
          "Expected lambda to be passed a compiled function closure or a aws_lambda.IFunction"
        );
      }
    } else {
      _resource = resource as aws_lambda.IFunction;
    }
    super(_resource);

    // retrieve and bind all found native integrations. Will fail if the integration does not support native integration.
    const nativeIntegrationsPrewarm = integrations.flatMap(
      ({ integration, args }) => {
        const integ = new IntegrationImpl(integration).native;
        integ.bind(this, args);
        return integ.preWarm ? [integ.preWarm] : [];
      }
    );

    // Start serializing process, add the callback to the promises so we can later ensure completion
    if (callbackLambdaCode) {
      Function.promises.push(
        callbackLambdaCode.generate(nativeIntegrationsPrewarm)
      );
    }
  }
}

/**
 * A {@link Function} which wraps a CDK function.
 *
 * An imported function can be invoked, but the code is provided in the CDK Construct.
 */
export class ImportedFunction<P, O> extends FunctionBase<P, O> {
  /**
   * Use {@link Function.fromFunction}
   * @internal
   */
  constructor(func: aws_lambda.IFunction) {
    return super(func) as unknown as ImportedFunction<P, O>;
  }
}

type ConditionalFunction<P, O> = P extends undefined
  ? (payload?: P) => O
  : (payload: P) => O;

interface CallbackLambdaCodeProps extends PrewarmProps {}

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
 * *
 */
export class CallbackLambdaCode extends aws_lambda.Code {
  private scope: Construct | undefined = undefined;

  constructor(
    private func: (preWarmContext: NativePreWarmContext) => AnyFunction,
    private props?: CallbackLambdaCodeProps
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
    integrationPrewarms: NativeIntegration<AnyFunction>["preWarm"][]
  ) {
    if (!this.scope) {
      throw Error("Must first be bound to a Construct using .bind().");
    }
    const scope = this.scope;
    let tokens: string[] = [];
    const preWarmContext = new NativePreWarmContext(this.props);
    const func = this.func(preWarmContext);

    const result = await serializeFunction(
      // factory function allows us to prewarm the clients and other context.
      () => {
        integrationPrewarms.forEach((i) => i?.(preWarmContext));
        return func;
      },
      {
        isFactoryFunction: true,
        serialize: (obj) => {
          if (typeof obj === "string") {
            const reversed =
              Tokenization.reverse(obj, { failConcat: false }) ??
              Tokenization.reverseString(obj).tokens;
            if (!Array.isArray(reversed) || reversed.length > 0) {
              if (Array.isArray(reversed)) {
                tokens = [...tokens, ...reversed.map((s) => s.toString())];
              } else {
                tokens = [...tokens, reversed.toString()];
              }
            }
          } else if (typeof obj === "object") {
            /**
             * Remove unnecessary fields from {@link CfnResource} that bloat or fail the closure serialization.
             */
            const transformCfnResource = (o: unknown): any => {
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
                const token = (<any>o).toString();
                // add to tokens to be turned into env variables.
                tokens = [...tokens, token];
                return token;
              }
              return o;
            };

            /**
             * When the StreamArn attribute is used in a Cfn template, but streamSpecification is
             * undefined, then the deployment fails. Lets make sure that doesn't happen.
             */
            const transformTable = (o: CfnResource): CfnResource => {
              if (
                o.cfnResourceType ===
                aws_dynamodb.CfnTable.CFN_RESOURCE_TYPE_NAME
              ) {
                const table = o as aws_dynamodb.CfnTable;
                if (!table.streamSpecification) {
                  const { attrStreamArn, ...rest } = table;

                  return rest as unknown as CfnResource;
                }
              }

              return o;
            };

            /**
             * CDK Tag manager bundles in ~200kb of junk we don't need at runtime,
             */
            const transformTaggableResource = (o: any) => {
              if (TagManager.isTaggable(o)) {
                const { tags, ...rest } = o;
                return rest;
              }
              return o;
            };

            /**
             * Remove unnecessary fields from {@link CfnTable} that bloat or fail the closure serialization.
             */
            const transformIntegration = (o: unknown): any => {
              if (o && typeof o === "object" && "kind" in o) {
                const integ = o as Integration<any>;
                const copy = {
                  ...integ,
                  native: {
                    call: integ?.native?.call,
                    preWarm: integ?.native?.preWarm,
                  },
                };

                INTEGRATION_TYPE_KEYS.filter((key) => key !== "native").forEach(
                  (key) => delete copy[key]
                );

                return copy;
              }
              return o;
            };

            return transformIntegration(transformCfnResource(obj));
          }
          return true;
        },
      }
    );

    const tokenContext = tokens.map((t) => {
      const id = /\${Token\[.*\.([0-9]*)\]}/g.exec(t)?.[1];
      if (!id) {
        throw Error("Unrecognized token format, no id found: " + t);
      }
      return {
        id,
        token: t,
        // env variables must start with a alpha character
        env: `env__functionless${id}`,
      };
    });

    // replace all tokens in the form "${Token[{anything}.{id}]}" -> process.env.env__functionless{id}
    // this doesn't solve for tokens like "arn:${Token[{anything}.{id}]}:something" -> "arn:" + process.env.env__functionless{id} + ":something"
    const resultText = tokenContext.reduce(
      // TODO: support templated strings
      (r, t) => r.split(`"${t.token}"`).join(`process.env.${t.env}`),
      result.text
    );

    const asset = aws_lambda.Code.fromAsset("", {
      assetHashType: AssetHashType.OUTPUT,
      bundling: {
        image: DockerImage.fromRegistry("empty"),
        // This forces the bundle directory and cache key to be unique. It does nothing else.
        user: scope.node.addr,
        local: {
          tryBundle(outdir: string) {
            fs.writeFileSync(path.resolve(outdir, "index.js"), resultText);
            return true;
          },
        },
      },
    });

    if (!(scope instanceof aws_lambda.Function)) {
      throw new Error(
        "CallbackLambdaCode can only be used on aws_lambda.Function"
      );
    }

    tokenContext.forEach((t) => scope.addEnvironment(t.env, t.token));

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
  }
}

/**
 * Interface to consume to add an Integration to Native Lambda Functions.
 *
 * ```ts
 * new Function(this, 'func', () => {
 *    mySpecialIntegration()
 * })
 *
 * const mySpecialIntegration = makeIntegration<() => void>({
 *    native: {...} // an instance of NativeIntegration
 * })
 * ```
 */
export interface NativeIntegration<F extends AnyFunction> {
  /**
   * Called by any {@link Function} that will invoke this integration during CDK Synthesis.
   * Add permissions, create connecting resources, validate.
   *
   * @param context - The function invoking this function.
   * @param args - The functionless encoded AST form of the arguments passed to the integration.
   */
  bind: (context: Function<any, any>, args: Expr[]) => void;
  /**
   * @param args The arguments passed to the integration function by the user.
   * @param preWarmContext contains singleton instances of client and other objects initialized outside of the native
   *                       function handler.
   */
  call: (
    args: Parameters<F>,
    preWarmContext: NativePreWarmContext
  ) => Promise<ReturnType<F>>;
  /**
   * Method called outside of the handler to initialize things like the PreWarmContext
   */
  preWarm?: (preWarmContext: NativePreWarmContext) => void;
}

export type ClientName =
  | "LAMBDA"
  | "EVENT_BRIDGE"
  | "STEP_FUNCTIONS"
  | "DYNAMO";

interface PrewarmProps {
  clientConfigRetriever?: FunctionProps["clientConfigRetriever"];
}

export interface PrewarmClientInitializer<T, O> {
  key: T;
  init: (key: string, props?: PrewarmProps) => O;
}

/**
 * Known, shared clients to use.
 *
 * Any object can be used by using the {@link PrewarmClientInitializer} interface directly.
 *
 * ```ts
 * context.getOrInit({
 *   key: 'customClient',
 *   init: () => new anyClient()
 * })
 * ```
 */
export const PrewarmClients = {
  LAMBDA: {
    key: "LAMBDA",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").Lambda)(props?.clientConfigRetriever?.(key)),
  },
  EVENT_BRIDGE: {
    key: "EVENT_BRIDGE",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").EventBridge)(props?.clientConfigRetriever?.(key)),
  },
  STEP_FUNCTIONS: {
    key: "STEP_FUNCTIONS",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").StepFunctions)(
        props?.clientConfigRetriever?.(key)
      ),
  },
  DYNAMO: {
    key: "DYNAMO",
    init: (key, props) =>
      // eslint-disable-next-line @typescript-eslint/no-require-imports, import/no-extraneous-dependencies
      new (require("aws-sdk").DynamoDB)(props?.clientConfigRetriever?.(key)),
  },
} as Record<ClientName, PrewarmClientInitializer<ClientName, any>>;

/**
 * A client/object cache which Native Functions can use to
 * initialize objects once and before the handler is invoked.
 *
 * The same instance will be passed to both the `.call` and `.prewarm` methods
 * of a {@link NativeIntegration}. `prewarm` is called once when the function starts,
 * before the handler.
 *
 * Register and initialize clients by using `getOrInit` with a key and a initializer.
 *
 * ```ts
 * context.getOrInit(PrewarmClients.LAMBDA)
 * ```
 *
 * or register anything by doing
 *
 * ```ts
 * context.getOrInit({
 *   key: 'customClient',
 *   init: () => new anyClient()
 * })
 * ```
 *
 * To get without potentially initializing the client, use `get`:
 *
 * ```ts
 * context.get("LAMBDA")
 * context.get("customClient")
 * ```
 */
export class NativePreWarmContext {
  private readonly cache: Record<string, any>;

  constructor(private props?: PrewarmProps) {
    this.cache = {};
  }

  public get<T>(key: ClientName | string): T | undefined {
    return this.cache[key];
  }

  public getOrInit<T>(client: PrewarmClientInitializer<any, T>): T {
    if (!this.cache[client.key]) {
      this.cache[client.key] = client.init(client.key, this.props);
    }
    return this.cache[client.key];
  }
}
