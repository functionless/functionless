import {
  AssetHashType,
  aws_lambda,
  DockerImage,
  Tokenization,
} from "aws-cdk-lib";
import { CallExpr, isVariableReference } from "./expression";
import { VTL } from "./vtl";
import { ASL } from "./asl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";
import { NativeFunctionDecl, isNativeFunctionDecl } from "./declaration";
import { Construct } from "constructs";
import { AnyFunction } from "./util";
import { runtime } from "@pulumi/pulumi";
import path from "path";
import fs from "fs";
import { Err, isErr } from "./error";
import { IntegrationImpl, Integration } from "./integration";
import { Lambda, EventBridge } from "aws-sdk";

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

abstract class FunctionBase<P, O> implements IFunction<P, O>, Integration<FunctionBase<P, O>> {
  readonly kind = "Function" as const;
  readonly native: NativeIntegration<FunctionBase<P, O>>;
  readonly functionlessKind = "Function";
  public static readonly FunctionlessType = "Function";

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
      bootstrap: (context: Function<any, any>) => {
        this.resource.grantInvoke(context.resource);
      },
      /**
       * This method is called from the calling runtime lambda code (context) to invoke this lambda function.
       */
      call: async (args, prewarmContext) => {
        const [payload] = args;
        const lambdaClient = prewarmContext.lambda();
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
      /**
       * Code that runs once per lambda invocation
       * The pre-warm client supports singleton invocation of clients (or other logic) across all integrations in the caller function.
       */
      preWarm: (preWarmContext: NativePreWarmContext) => {
        preWarmContext.lambda();
      },
    };
  }

  public vtl(call: CallExpr, context: VTL) {
    const payloadArg = call.getArgument("payload")?.expr;
    const payload = payloadArg ? context.eval(payloadArg) : "$null";

    const request = context.var(
      `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
    );
    return context.json(request);
  }

  public asl(call: CallExpr, context: ASL) {
    const payloadArg = call.getArgument("payload");
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
    props?: Omit<aws_lambda.FunctionProps, "code" | "handler" | "runtime">
  );
  /**
   * @private
   */
  constructor(
    scope: Construct,
    id: string,
    func: NativeFunctionDecl | Err,
    props?: Omit<aws_lambda.FunctionProps, "code" | "handler" | "runtime">
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
    props?: Omit<aws_lambda.FunctionProps, "code" | "handler" | "runtime">
  ) {
    let _resource: aws_lambda.IFunction;
    let integrations: Integration[] = [];
    let callbackLambdaCode: CallbackLambdaCode | undefined = undefined;
    if (func && id) {
      if (isNativeFunctionDecl(func)) {
        callbackLambdaCode = new CallbackLambdaCode(func.closure);
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

    // retrieve and bootstrap all found native integrations. Will fail if the integration does not support native integration.
    const nativeIntegrationsPrewarm = integrations
      .map((i) => new IntegrationImpl(i))
      .map((integration) => {
        const integ = integration.native;
        integ.bootstrap(this);
        return integ;
      })
      .filter((i) => i.preWarm)
      .map((i) => i.preWarm);
    // Start serializing process, add the callback to the promises so we can later ensure completion
    callbackLambdaCode &&
      Function.promises.push(
        callbackLambdaCode.generate(nativeIntegrationsPrewarm)
      );
  }

  public static fromFunction<P, O>(
    func: aws_lambda.IFunction
  ): ImportedFunction<P, O> {
    return new ImportedFunction<P, O>(func);
  }
}

export class ImportedFunction<P, O> extends FunctionBase<P, O> {
  constructor(func: aws_lambda.IFunction) {
    return super(func) as unknown as ImportedFunction<P, O>;
  }
}

type ConditionalFunction<P, O> = P extends undefined
  ? (payload?: P) => O
  : (payload: P) => O;

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
    private func: (preWarmContext: NativePreWarmContext) => AnyFunction
  ) {
    super();
  }

  public bind(scope: Construct): aws_lambda.CodeConfig {
    this.scope = scope;
    // Lets give the function something lightweight while we process the closure.
    return aws_lambda.Code.fromInline(
      "If you are seeing this in your lambda code, ensure generate is called and then consult the README."
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
    const preWarmContext = new NativePreWarmContext();
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
      const id = new RegExp("\\${Token\\[TOKEN\\.([0-9]*)\\]}", "g").exec(
        t
      )?.[1];
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

    // console.log(resultText);

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

export interface NativeIntegration<F extends AnyFunction> {
  bootstrap: (context: Function<any, any>) => void;
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

export class NativePreWarmContext {
  private readonly cache: Record<string, any>;

  constructor() {
    this.cache = {};
  }

  public lambda(): Lambda {
    return this.getOrInit("LAMBDA", () => new Lambda());
  }

  public eventBridge(): EventBridge {
    return this.getOrInit("EVENT_BRIDGE", () => new EventBridge());
  }

  public registerCustom<T>(
    key: string,
    init: () => T,
    allowExists: boolean = false
  ): T {
    if (key in this.cache && !allowExists) {
      throw Error(
        `Prewarm Context key ${key} already exists. Use context.custom to get the object or set allowExists to true.`
      );
    }
    return this.getOrInit<T>(key, init);
  }

  public custom<T>(key: string): T {
    return this.getOrFail<T>(key);
  }

  private getOrInit<T>(key: string, create: () => T): T {
    if (!this.cache[key]) {
      this.cache[key] = create();
    }
    return this.cache[key];
  }

  private getOrFail<T>(key: string): T {
    if (!this.cache[key]) {
      throw Error(
        `Prewarm Context key ${key} does not exist. Initialize it with context.registerCustom.`
      );
    }
    return this.cache[key];
  }
}
