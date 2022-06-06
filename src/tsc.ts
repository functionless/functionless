import path from "path";
import fs from "fs-extra";

import ts from "typescript";
import { makeFunctionlessChecker } from "./checker";
import { compile } from "./compile";
import { formatDiagnosticsWithColorAndContext } from "./format-error";
import { validate } from "./validate";

export interface TscProps {
  /**
   * Whether to emit .d.ts and .js files or only validate.
   *
   * @default true
   */
  emit?: boolean;
  /**
   * Whether to run TypeScript's default type checking.
   *
   * @default true
   */
  checkTsErrors?: boolean;
}

/**
 * Programmatically runs the typescript compiler.
 *
 * This is useful for debugging the transformer logic.
 */
export async function tsc(
  projectRoot: string = process.cwd(),
  props?: TscProps
) {
  const tsConfigPath = path.join(projectRoot, "tsconfig.dev.json");
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

  const checker = makeFunctionlessChecker(program.getTypeChecker());

  if (props?.emit !== false) {
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
  }

  const tsDiagnostics =
    props?.checkTsErrors !== false ? program.getSemanticDiagnostics() : [];
  const functionlessDiagnostics = program
    .getSourceFiles()
    .flatMap((sf) => validate(ts, checker, sf));

  const semanticDiagnostics = [...tsDiagnostics, ...functionlessDiagnostics];

  process.stderr.write(
    formatDiagnosticsWithColorAndContext(semanticDiagnostics, compilerHost)
  );

  if (semanticDiagnostics.length > 0) {
    throw new Error(
      `Compilation Failed with ${semanticDiagnostics.length} diagnostic errors`
    );
  }
}
