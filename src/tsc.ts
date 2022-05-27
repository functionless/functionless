import path from "path";
import fs from "fs-extra";

import ts from "typescript";
import { makeFunctionlessChecker } from "./checker";
import { compile } from "./compile";
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

declare module "typescript" {
  export const formatLocation: any;
  export const diagnosticCategoryName: any;
  export const padLeft: any;
  export const trimStringEnd: any;
}

function formatColorAndReset(text: string, formatStyle: string) {
  return formatStyle + text + resetEscapeSequence;
}

enum ForegroundColorEscapeSequences {
  Grey = "\u001b[90m",
  Red = "\u001b[91m",
  Yellow = "\u001b[93m",
  Blue = "\u001b[94m",
  Cyan = "\u001b[96m",
}

const gutterStyleSequence = "\u001b[7m";
const gutterSeparator = " ";
const resetEscapeSequence = "\u001b[0m";
const ellipsis = "...";
const halfIndent = "  ";
const indent = "    ";

function getCategoryFormat(
  category: ts.DiagnosticCategory
): ForegroundColorEscapeSequences {
  switch (category) {
    case ts.DiagnosticCategory.Error:
      return ForegroundColorEscapeSequences.Red;
    case ts.DiagnosticCategory.Warning:
      return ForegroundColorEscapeSequences.Yellow;
    case ts.DiagnosticCategory.Suggestion:
      throw new Error(
        "Should never get an Info diagnostic on the command line."
      );
    case ts.DiagnosticCategory.Message:
      return ForegroundColorEscapeSequences.Blue;
  }
}

export function formatDiagnosticsWithColorAndContext(
  diagnostics: readonly ts.Diagnostic[],
  host: ts.FormatDiagnosticsHost
): string {
  let output = "";
  for (const diagnostic of diagnostics) {
    if (diagnostic.file) {
      const { file, start } = diagnostic;
      output += ts.formatLocation(file, start!, host); // TODO: GH#18217
      output += " - ";
    }

    output += formatColorAndReset(
      ts.diagnosticCategoryName(diagnostic),
      getCategoryFormat(diagnostic.category)
    );
    output += formatColorAndReset(
      ` Functionless(${diagnostic.code}): `,
      ForegroundColorEscapeSequences.Grey
    );
    output += flattenDiagnosticMessageText(
      diagnostic.messageText,
      host.getNewLine()
    );

    if (diagnostic.file) {
      output += host.getNewLine();
      output += formatCodeSpan(
        diagnostic.file,
        diagnostic.start!,
        diagnostic.length!,
        "",
        getCategoryFormat(diagnostic.category),
        host
      ); // TODO: GH#18217
    }
    if (diagnostic.relatedInformation) {
      output += host.getNewLine();
      for (const {
        file,
        start,
        length,
        messageText,
      } of diagnostic.relatedInformation) {
        if (file) {
          output += host.getNewLine();
          output += halfIndent + ts.formatLocation(file, start!, host); // TODO: GH#18217
          output += formatCodeSpan(
            file,
            start!,
            length!,
            indent,
            ForegroundColorEscapeSequences.Cyan,
            host
          ); // TODO: GH#18217
        }
        output += host.getNewLine();
        output +=
          indent + flattenDiagnosticMessageText(messageText, host.getNewLine());
      }
    }
    output += host.getNewLine();
  }
  return output;
}

function formatCodeSpan(
  file: ts.SourceFile,
  start: number,
  length: number,
  indent: string,
  squiggleColor: ForegroundColorEscapeSequences,
  host: ts.FormatDiagnosticsHost
) {
  const { line: firstLine, character: firstLineChar } =
    ts.getLineAndCharacterOfPosition(file, start);
  const { line: lastLine, character: lastLineChar } =
    ts.getLineAndCharacterOfPosition(file, start + length);
  const lastLineInFile = ts.getLineAndCharacterOfPosition(
    file,
    file.text.length
  ).line;

  const hasMoreThanFiveLines = lastLine - firstLine >= 4;
  let gutterWidth = (lastLine + 1 + "").length;
  if (hasMoreThanFiveLines) {
    gutterWidth = Math.max(ellipsis.length, gutterWidth);
  }

  let context = "";
  for (let i = firstLine; i <= lastLine; i++) {
    context += host.getNewLine();
    // If the error spans over 5 lines, we'll only show the first 2 and last 2 lines,
    // so we'll skip ahead to the second-to-last line.
    if (hasMoreThanFiveLines && firstLine + 1 < i && i < lastLine - 1) {
      context +=
        indent +
        formatColorAndReset(
          ts.padLeft(ellipsis, gutterWidth),
          gutterStyleSequence
        ) +
        gutterSeparator +
        host.getNewLine();
      i = lastLine - 1;
    }

    const lineStart = ts.getPositionOfLineAndCharacter(file, i, 0);
    const lineEnd =
      i < lastLineInFile
        ? ts.getPositionOfLineAndCharacter(file, i + 1, 0)
        : file.text.length;
    let lineContent = file.text.slice(lineStart, lineEnd);
    lineContent = ts.trimStringEnd(lineContent); // trim from end
    lineContent = lineContent.replace(/\t/g, " "); // convert tabs to single spaces

    // Output the gutter and the actual contents of the line.
    context +=
      indent +
      formatColorAndReset(
        ts.padLeft(i + 1 + "", gutterWidth),
        gutterStyleSequence
      ) +
      gutterSeparator;
    context += lineContent + host.getNewLine();

    // Output the gutter and the error span for the line using tildes.
    context +=
      indent +
      formatColorAndReset(ts.padLeft("", gutterWidth), gutterStyleSequence) +
      gutterSeparator;
    context += squiggleColor;
    if (i === firstLine) {
      // If we're on the last line, then limit it to the last character of the last line.
      // Otherwise, we'll just squiggle the rest of the line, giving 'slice' no end position.
      const lastCharForLine = i === lastLine ? lastLineChar : undefined;

      context += lineContent.slice(0, firstLineChar).replace(/\S/g, " ");
      context += lineContent
        .slice(firstLineChar, lastCharForLine)
        .replace(/./g, "~");
    } else if (i === lastLine) {
      context += lineContent.slice(0, lastLineChar).replace(/./g, "~");
    } else {
      // Squiggle the entire line.
      context += lineContent.replace(/./g, "~");
    }
    context += resetEscapeSequence;
  }
  return context;
}

function flattenDiagnosticMessageText(
  diag: string | ts.DiagnosticMessageChain | undefined,
  newLine: string,
  indent = 0
): string {
  if (typeof diag === "string") {
    return diag;
  } else if (diag === undefined) {
    return "";
  }
  let result = "";
  if (indent) {
    result += newLine;

    for (let i = 0; i < indent; i++) {
      result += "  ";
    }
  }
  result += diag.messageText;
  indent++;
  if (diag.next) {
    for (const kid of diag.next) {
      result += flattenDiagnosticMessageText(kid, newLine, indent);
    }
  }
  return result;
}
