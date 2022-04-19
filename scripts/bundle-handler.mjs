import esbuild from "esbuild";
import fs from "fs";
import { esBuildPlugin } from "../lib/esbuild-plugin.js";

/**
 * Script that bundles typescript using Eventual for our handlers using esbuild.
 * Mainly used in Assets to generate lambda function code, but could bundle any typescript asset.
 *
 * $ bundle-handler.mjs outputFile baseDirectory <<-EOM
 * some typescript contents
 * EOM
 *
 * @param outputFile - the file to bundle into
 * @param baseDirectory - The directory used to discover npm and typescript dependencies from
 * @param STDIN - some typescript to bundle using esbuild
 */

const [_1, _2, outputFile, baseDir] = process.argv;

console.log(outputFile, baseDir);

var stdinBuffer = await fs.readFileSync(0); // STDIN_FILENO = 0
const content = stdinBuffer.toString();

export const createEsbuildConfig = (content, outputFile) => ({
  stdin: {
    contents: content,
    loader: "ts",
    resolveDir: baseDir,
  },
  sourcemap: "inline",
  outfile: outputFile,
  platform: "node",
  bundle: true,
  external: ["aws-sdk"],
  minify: false,
  format: "esm",
  // Could be a risk of deps only support module for browser targets
  // Why? May improve tree shaking.
  mainFields: ["module", "main"],
  // Force tree shaking
  treeShaking: true,
  plugins: [esBuildPlugin(baseDir)],
});

await esbuild.build(createEsbuildConfig(content, outputFile));
