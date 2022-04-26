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
import { IntegrationHandler } from "./integration";

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

abstract class FunctionBase<P, O> implements IFunction<P, O>, IntegrationHandler {
  readonly kind = "Function" as const;
  readonly functionlessKind = "Function";
  public static readonly FunctionlessType = "Function";

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: ConditionalFunction<P, O>;

  constructor(readonly resource: aws_lambda.IFunction) {}

  vtl(call: CallExpr, context: VTL) {
    const payloadArg = call.getArgument("payload")?.expr;
    const payload = payloadArg ? context.eval(payloadArg) : "$null";

    const request = context.var(
      `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
    );
    return context.json(request);
  }

  asl(call: CallExpr, context: ASL) {
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

  native(context: Function<any, any>) {
    this.resource.grantInvoke(context.resource);
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
    if (func && id) {
      if (isNativeFunctionDecl(func)) {
        _resource = new aws_lambda.Function(resource, id, {
          ...props,
          runtime: aws_lambda.Runtime.NODEJS_14_X,
          handler: "index.handler",
          code: new CallbackLambdaCode(func.closure),
        });
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
    return super(_resource) as unknown as Function<P, O>;
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
export class CallbackLambdaCode extends aws_lambda.Code {
  constructor(private func: AnyFunction) {
    super();
  }

  public bind(scope: Construct): aws_lambda.CodeConfig {
    Function.promises.push(this.generate(scope));

    // Lets give the function something lightweight while we process the closure.
    return aws_lambda.Code.fromInline(
      "If you are seeing this in your lambda code, consult the README."
    ).bind(scope);
  }

  /**
   * Thanks to cloudy for the help getting this to work.
   * https://github.com/skyrpex/cloudy/blob/main/packages/cdk/src/aws-lambda/callback-function.ts#L518-L540
   * https://twitter.com/samgoodwin89/status/1516887131108438016?s=20&t=7GRGOQ1Bp0h_cPsJgFk3Ww
   */
  async generate(scope: Construct) {
    let tokens: string[] = [];
    const result = await runtime.serializeFunction(this.func, {
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
    });

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
