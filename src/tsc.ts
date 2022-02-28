import path from "path";
import fs from "fs-extra";
import ts from "typescript";
import { compile } from "./compile";

/**
 * Programmatically runs the typescript compiler.
 *
 * This is useful for debugging the transformer logic.
 */
export async function tsc(projectRoot: string = process.cwd()) {
  const tsConfigPath = path.join(projectRoot, "tsconfig.json");
  let tsConfig: {
    include: string[];
    exclude?: string[];
    compilerOptions: ts.CompilerOptions;
  };
  if (await fs.pathExists(tsConfigPath)) {
    tsConfig = ts.readConfigFile(tsConfigPath, ts.sys.readFile)?.config;
  } else {
    tsConfig = {
      include: ["src"],
      compilerOptions: {
        outDir: "lib",
        rootDir: ".",
      },
    };
  }

  const commandLine = ts.parseJsonConfigFileContent(
    tsConfig,
    ts.sys,
    projectRoot
  );

  const compilerHost = ts.createCompilerHost(commandLine.options, true);

  const program = ts.createProgram(
    commandLine.fileNames,
    commandLine.options,
    compilerHost
  );

  program.emit(
    undefined,
    async (fileName, data, _cancellationToken, onError) => {
      try {
        await fs.promises.mkdir(path.dirname(fileName), { recursive: true });

        await fs.promises.writeFile(fileName, data);
      } catch (err) {
        if (onError) {
          onError((err as any).message);
        }
      }
    },
    undefined,
    undefined,
    {
      before: [compile(program)],
    }
  );

  const semanticDiagnostics = program.getSemanticDiagnostics();

  if (semanticDiagnostics.length > 0) {
    process.stderr.write(
      ts.formatDiagnosticsWithColorAndContext(semanticDiagnostics, compilerHost)
    );
    throw new Error(
      `Compilation Failed with ${semanticDiagnostics.length} diagnostic errors`
    );
  }
}
