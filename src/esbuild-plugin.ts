import esbuild from "esbuild";
import typescript from "typescript";
import path from "path";
import compile, { FunctionlessConfig } from "./compile";
import { PluginConfig } from "ts-patch";

/**
 * Plugin which applies eventual transforms to file for use in es-build.
 *
 * Makes use of the typescript compile. Due to this, this plugin is not fast.
 *
 * Note: There is no external value provided by this plugin right now.
 * It is used by eventual's runtime to re-compile handler code relative to the project.
 *
 * @param baseDir to load the project and tsconfig from.
 */
export const esBuildPlugin = (baseDir: string): esbuild.Plugin => ({
  name: "functionless",
  setup(build) {
    const configFileName = typescript.findConfigFile(
      baseDir,
      typescript.sys.fileExists,
      "tsconfig.json"
    );

    if (!configFileName) {
      return;
    }

    const configFile = typescript.readConfigFile(
      configFileName,
      typescript.sys.readFile
    );

    const compilerOptions = typescript.parseJsonConfigFileContent(
      configFile.config,
      typescript.sys,
      path.dirname(configFileName)
    );

    const functionlessConfig = (
      compilerOptions.options.plugins as PluginConfig[] | undefined
    )?.find(
      (p): p is typeof p & FunctionlessConfig =>
        p?.transform?.startsWith("functionless") ?? false
    );

    if (!functionlessConfig) {
      return;
    }

    const compilerHost = typescript.createCompilerHost(
      compilerOptions.options,
      true
    );

    const program = typescript.createProgram(
      compilerOptions.fileNames,
      compilerOptions.options,
      compilerHost
    );

    build.onLoad({ filter: /\.tsx?$/ }, async (args) => {
      const source = program.getSourceFile(args.path);

      return new Promise((resolve) => {
        program.emit(
          source,
          (file, data) => {
            // is this OK?
            if (file.endsWith(".js")) {
              resolve({ contents: data });
            }
          },
          undefined,
          undefined,
          {
            before: [compile(program)],
          }
        );
      });
    });
  },
});
