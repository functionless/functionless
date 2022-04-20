import { AnyFunction } from "./util";
import path from "path";
import {
  AssetHashType,
  aws_lambda,
  DockerImage,
  ISynthesisSession,
} from "aws-cdk-lib";
import fs from "fs";
import { Construct } from "constructs";
import { runtime } from "@pulumi/pulumi";
import { SynthesizeAsync } from "./app";
import { Code } from "aws-cdk-lib/aws-lambda";

export class HandleFunction extends Construct implements SynthesizeAsync {
  readonly resource: aws_lambda.IFunction;

  constructor(scope: Construct, id: string, private func: AnyFunction) {
    super(scope, id);

    this.resource = new aws_lambda.Function(this, "function", {
      runtime: aws_lambda.Runtime.NODEJS_14_X,
      handler: "index.handler",
      code: Code.fromInline("if I make it into prod, please tell someone"),
    });
  }

  async synthesizeAsync(_session: ISynthesisSession): Promise<void> {
    const result = await runtime.serializeFunction(this.func);

    const asset = aws_lambda.Code.fromAsset("", {
      assetHashType: AssetHashType.OUTPUT,
      bundling: {
        image: DockerImage.fromRegistry("empty"),
        local: {
          tryBundle(outdir: string) {
            fs.writeFileSync(path.resolve(outdir, "index.js"), result.text);
            return true;
          },
        },
      },
    });

    asset.bind(this.resource);
  }
}
