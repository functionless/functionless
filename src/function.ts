import {
  AssetHashType,
  aws_lambda,
  DockerImage,
  Tokenization,
} from "aws-cdk-lib";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import { CallExpr, isVariableReference } from "./expression";
import { ASL } from "./asl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver, AppSyncVtlIntegration } from "./appsync";
import { NativeFunctionDecl, isNativeFunctionDecl } from "./declaration";
import { Construct } from "constructs";
import { AnyFunction } from "./util";
import { runtime } from "@pulumi/pulumi";
import path from "path";
import fs from "fs";
import { Err, isErr } from "./error";
import { IntegrationImpl, Integration } from "./integration";
import { Lambda, EventBridge, StepFunctions } from "aws-sdk";

export function isFunction<P = any, O = any>(a: any): a is IFunction<P, O> {
  return a?.kind === "Function";
}

export type AnyLambda = Function<any, any>;

export type FunctionClosure<P, O> = (payload: P) => Promise<O>;

export interface IFunction<P, O> {
  readonly functionlessKind: typeof Function.FunctionlessType;
  readonly kind: typeof Function.FunctionlessType;
  readonly resource: aws_lambda.IFunction;

  (...args: Parameters<ConditionalFunction<P, O>>): ReturnType<
    ConditionalFunction<P, O>
  >;
}

abstract class FunctionBase<P, O>
  implements IFunction<P, O>, Integration<FunctionBase<P, O>>
{
  readonly kind = "Function" as const;
  readonly native: NativeIntegration<FunctionBase<P, O>>;
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
        // TODO: what should the response type be?
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
}

interface FunctionBase<P, O> {
  (...args: Parameters<ConditionalFunction<P, O>>): ReturnType<
    ConditionalFunction<P, O>
  >;
}

const PromisesSymbol = Symbol.for("functionless.Function.promises");

export interface FunctionProps
  extends Omit<aws_lambda.FunctionProps, "code" | "handler" | "runtime"> {
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
  ) => Omit<Lambda.ClientConfiguration, keyof Lambda.ClientApiVersions>;
}

/**
 * Wraps an {@link aws_lambda.Function} with a type-safe interface that can be
 * called from within an {@link AppsyncResolver}.
 *
 * For example:
 * ```ts
 * const getPerson = Function.fromFunction<string, Person>(
 *   new aws_lambda.Function(..)
 * );
 *
 * new AppsyncResolver(() => {
 *   return getPerson("value");
 * })
 * ```
 */
export class Function<P, O> extends FunctionBase<P, O> {
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
  public static fromFunction<P, O>(
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
  constructor(
    scope: Construct,
    id: string,
    func: FunctionClosure<P, O>,
    props?: FunctionProps
  );
  /**
   * @private
   */
  constructor(
    scope: Construct,
    id: string,
    func: NativeFunctionDecl | Err,
    props?: FunctionProps
  );
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
    func?: NativeFunctionDecl | Err | FunctionClosure<P, O>,
    props?: FunctionProps
  ) {
    let _resource: aws_lambda.IFunction;
    let integrations: Integration[] = [];
    let callbackLambdaCode: CallbackLambdaCode | undefined = undefined;
    if (func && id) {
      if (isNativeFunctionDecl(func)) {
        callbackLambdaCode = new CallbackLambdaCode(func.closure, {
          clientConfigRetriever: props?.clientConfigRetriever,
        });
        _resource = new aws_lambda.Function(resource, id, {
          ...props,
          runtime: aws_lambda.Runtime.NODEJS_14_X,
          handler: "index.handler",
          code: callbackLambdaCode,
        });

        integrations = func.integrations;
      } else if (isErr(func)) {
        throw func.error;
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
    const nativeIntegrationsPrewarm = integrations.flatMap((i) => {
      const integ = new IntegrationImpl(i).native;
      integ.bind(this);
      return integ.preWarm ? [integ.preWarm] : [];
    });

    // Start serializing process, add the callback to the promises so we can later ensure completion
    callbackLambdaCode &&
      Function.promises.push(
        callbackLambdaCode.generate(nativeIntegrationsPrewarm)
      );
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
    // https://github.com/sam-goodwin/functionless/issues/128
    return aws_lambda.Code.fromInline(
      "If you are seeing this in your lambda code, ensure generate is called, then consult the README, and see https://github.com/sam-goodwin/functionless/issues/128."
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

    const result = await runtime.serializeFunction(
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
          }
          return true;
        },
      }
    );

    const tokenContext = tokens.map((t) => {
      const id = /\${Token\[TOKEN\.([0-9]*)\]}/g.exec(t)?.[1];
      return {
        id,
        token: t,
        // env variables must start with a alpha character
        env: `env__functionless${id}`,
      };
    });

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
   */
  bind: (context: Function<any, any>) => void;
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

export type ClientName = "LAMBDA" | "EVENT_BRIDGE" | "STEP_FUNCTIONS";

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
    init: (key, props) => new Lambda(props?.clientConfigRetriever?.(key)),
  },
  EVENT_BRIDGE: {
    key: "EVENT_BRIDGE",
    init: (key, props) => new EventBridge(props?.clientConfigRetriever?.(key)),
  },
  STEP_FUNCTIONS: {
    key: "STEP_FUNCTIONS",
    init: (key, props) =>
      new StepFunctions(props?.clientConfigRetriever?.(key)),
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
