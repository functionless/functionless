import { AnyFunction } from "./util";
import path from "path";
import { AssetHashType, aws_lambda, DockerImage } from "aws-cdk-lib";
import fs from "fs";
import { Construct } from "constructs";
// import { sleep } from "deasync";
import { createSyncFn } from "synckit";
import { runtime } from "@pulumi/pulumi";

// TODO, rename this, maybe just make a Code or Asset overload?
export class HandlerFunction extends aws_lambda.Code {
  constructor(private func: AnyFunction) {
    super();
  }

  bind(scope: Construct): aws_lambda.CodeConfig {
    const handleDest = path.resolve("./out.test", scope.node.addr);

    // Delete first to ensure we are not using an old version
    fs.existsSync(handleDest) && fs.unlinkSync(handleDest);

    this.generate(handleDest, this.func);

    const wait = createSyncFn(require.resolve("./generateWorker"));
    while (!wait(handleDest)) {}

    const asset = aws_lambda.Code.fromAsset("", {
      assetHashType: AssetHashType.OUTPUT,
      bundling: {
        image: DockerImage.fromRegistry("empty"),
        local: {
          tryBundle(outdir: string) {
            fs.copyFileSync(handleDest, path.resolve(outdir, "index.js"));
            return true;
          },
        },
      },
    });

    return asset.bind(scope);
  }

  generate(outputPath: string, func: AnyFunction) {
    console.log("Starting generate... " + outputPath);
    runtime
      .serializeFunction(func)
      .then((result) => {
        console.log("Generate started " + outputPath);
        fs.mkdirSync(path.dirname(outputPath), { recursive: true });
        console.log("Dir created " + outputPath);
        fs.writeFileSync(outputPath, result.text);
        console.log("done " + outputPath);
      })
      .catch((err) => {
        console.error(err);
        throw err;
      });
  }
}
