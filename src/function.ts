import { AssetHashType, aws_lambda, DockerImage } from "aws-cdk-lib";
import { CallExpr, isVariableReference } from "./expression";
import { isVTL, VTL } from "./vtl";
import { ASL, isASL, Task } from "./asl";

// @ts-ignore - imported for typedoc
import type { AppsyncResolver } from "./appsync";
import { makeCallable } from "./callable";
import { NativeFunctionDecl, isNativeFunctionDecl } from "./declaration";
import { Construct } from "constructs";
import { AnyFunction } from "./util";
import { runtime } from "@pulumi/pulumi";
import path from "path";
import fs from "fs";

export function isFunction<P = any, O = any>(a: any): a is Function<P, O> {
  return a?.kind === "Function";
}

export type AnyLambda = Function<any, any>;

export type FunctionClosure<P, O> = (payload: P) => Promise<O>;

/**
 * Wraps an {@link aws_lambda.Function} with a type-safe interface that can be
 * called from within an {@link AppsyncResolver}.
 *
 * For example:
 * ```ts
 * const getPerson = new Function<string, Person>(
 *   new aws_lambda.Function(..)
 * );
 *
 * new AppsyncResolver(() => {
 *   return getPerson("value");
 * })
 * ```
 */
export class Function<P, O> {
  readonly kind = "Function" as const;
  public static readonly FunctionlessType = "Function";
  readonly resource: aws_lambda.IFunction;

  static promises: Promise<any>[] = [];

  // @ts-ignore - this makes `F` easily available at compile time
  readonly __functionBrand: ConditionalFunction<P, O>;

  constructor(
    scope: Construct,
    id: string,
    func: NativeFunctionDecl,
    props?: Omit<aws_lambda.FunctionProps, "code" | "handler" | "runtime">
  );
  constructor(
    scope: Construct,
    id: string,
    func: FunctionClosure<P, O>,
    props?: Omit<aws_lambda.FunctionProps, "code" | "handler" | "runtime">
  );
  constructor(resource: aws_lambda.IFunction);
  constructor(
    resource: aws_lambda.IFunction | Construct,
    id?: string,
    func?: NativeFunctionDecl | FunctionClosure<P, O>,
    props?: Omit<aws_lambda.FunctionProps, "code" | "handler" | "runtime">
  ) {
    if (func && id) {
      if (isNativeFunctionDecl(func)) {
        this.resource = new aws_lambda.Function(resource, id, {
          ...props,
          runtime: aws_lambda.Runtime.NODEJS_14_X,
          handler: "index.handler",
          code: new CallbackLambdaCode(func.closure),
        });
      } else {
        throw Error(
          "Expected lambda to be passed a compiled function closure or a aws_lambda.IFunction"
        );
      }
    } else {
      this.resource = resource as aws_lambda.IFunction;
    }

    return makeCallable(this, (call: CallExpr, context: VTL | ASL): any => {
      const payloadArg = call.getArgument("payload");

      if (isVTL(context)) {
        const payload = payloadArg?.expr
          ? context.eval(payloadArg.expr)
          : "$null";

        const request = context.var(
          `{"version": "2018-05-29", "operation": "Invoke", "payload": ${payload}}`
        );
        return context.json(request);
      } else if (isASL(context)) {
        this.resource.grantInvoke(context.role);
        const task: Partial<Task> = {
          Type: "Task",
          Resource: "arn:aws:states:::lambda:invoke",
          Parameters: {
            FunctionName: this.resource.functionName,
            [`Payload${
              payloadArg?.expr && isVariableReference(payloadArg.expr)
                ? ".$"
                : ""
            }`]: payloadArg ? ASL.toJson(payloadArg.expr) : null,
          },
          ResultSelector: "$.Payload",
        };
        return task;
      } else {
        console.error(`invalid Function call context`, context);
        throw new Error(`invalid Function call context: ${context}`);
      }
    });
  }
}

type ConditionalFunction<P, O> = P extends undefined
  ? () => O
  : (payload: P) => O;

export interface Function<P, O> {
  (...args: Parameters<ConditionalFunction<P, O>>): ReturnType<
    ConditionalFunction<P, O>
  >;
}

export class CallbackLambdaCode extends aws_lambda.Code {
  constructor(private func: AnyFunction) {
    super();
  }

  bind(scope: Construct): aws_lambda.CodeConfig {
    Function.promises.push(this.generate(scope));

    // Lets give the function something lightweight while we process the closure.
    return aws_lambda.Code.fromInline(
      "If you are seeing this in your lambda code, consult the README."
    ).bind(scope);
  }

  async generate(scope: Construct) {
    const result = await runtime.serializeFunction(this.func);

    const asset = aws_lambda.Code.fromAsset("", {
      assetHashType: AssetHashType.OUTPUT,
      bundling: {
        image: DockerImage.fromRegistry("empty"),
        // This forces the bundle directory and cache key to be unique. It does nothing else.
        user: scope.node.addr,
        local: {
          tryBundle(outdir: string) {
            fs.writeFileSync(path.resolve(outdir, "index.js"), result.text);
            return true;
          },
        },
      },
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
  }
}
