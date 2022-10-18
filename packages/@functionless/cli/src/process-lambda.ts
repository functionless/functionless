import path from "path";
import esbuild from "esbuild";
import fs from "fs/promises";
import { File } from "./tree/file";
import { esbuildResourceProcessor } from "./esbuild-resource-processor";
import { Target } from "./resource-plugins/loader";

/**
 * Bundle the lambda, and output bundle folder, as well as environment variables to set on the host functoin
 * @param file
 * @param target
 * @returns
 */
export async function processLambdaFunction(file: File, target: Target) {
  const bundleFolder = getBundleOutFolder(file);
  const outfile = path.join(bundleFolder, "index.js");
  await fs.mkdir(bundleFolder, {
    recursive: true,
  });
  const { plugin, env } = esbuildResourceProcessor(file, target);
  await esbuild.build({
    entryPoints: [file.filePath],
    bundle: true,
    platform: "node",
    outfile,
    plugins: [plugin],
    external: ["aws-sdk", "swc", "esbuild"],
    sourcemap: "linked",
    tsconfig: path.resolve(__dirname, "..", "tsconfig.json"),
    format: "cjs",
  });
  return { bundleFolder, env };
}

function getBundleOutFolder(file: File) {
  const outdir = path.join(process.cwd(), ".fl");
  return path.join(outdir, `${file.address.replaceAll("/", "_")}_lambda`);
}
