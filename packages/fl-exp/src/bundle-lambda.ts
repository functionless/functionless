import path from "path";
import esbuild from "esbuild";
import fs from "fs/promises";
import { resourceIdPlugin } from "./plugin";
import { Project } from "./project";

export async function bundleLambdaFunction(
  project: Project,
  filename: string,
  outFolder: string,
  roleArn?: string
) {
  const outfile = path.join(outFolder, "index.js");
  await fs.mkdir(outFolder, {
    recursive: true,
  });

  await esbuild.build({
    entryPoints: [filename],
    bundle: true,
    platform: "node",
    // format: "esm",
    outfile,
    plugins: [resourceIdPlugin(project, roleArn)],
    external: ["aws-sdk"],
    sourcemap: "inline",
    sourcesContent: true,
    minify: false,
  });
  return outfile;
}

export function getBundleOutFolder(id: string) {
  const outdir = path.join(process.cwd(), ".fl");
  return path.join(outdir, `${id.replaceAll("/", "_")}_lambda`);
}
